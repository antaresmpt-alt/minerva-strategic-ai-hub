import { NextRequest, NextResponse } from "next/server";
import type { CreativoVariant } from "@/lib/creativo-variants";
import { VARIANT_META } from "@/lib/creativo-variants";
import {
  buildEditUserPrompt,
  buildGenerateUserPrompt,
  buildRegenerateUserPrompt,
  type CreativoCopy,
} from "@/lib/creativo-prompts";
import {
  cropProductToVariant,
  enforceDimensions,
  generateCreativoImageFromParts,
} from "@/lib/creativo-gemini";
import { resolveCreativoImageModelForApi } from "@/lib/creativo-image-models";

export const runtime = "nodejs";
export const maxDuration = 120;

const VARIANTS: CreativoVariant[] = ["square", "horizontal", "vertical"];

function isVariant(v: string): v is CreativoVariant {
  return VARIANTS.includes(v as CreativoVariant);
}

function parseCopy(body: Record<string, unknown>): CreativoCopy {
  return {
    productName: String(body.productName ?? "").trim(),
    cta: String(body.cta ?? "").trim(),
    description: body.description ? String(body.description).trim() : undefined,
    originalPrice: body.originalPrice
      ? String(body.originalPrice).trim()
      : undefined,
    offerPrice: body.offerPrice ? String(body.offerPrice).trim() : undefined,
    discountPct: body.discountPct ? String(body.discountPct).trim() : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "generate");
    const variantRaw = String(body.variant ?? "");
    if (!isVariant(variantRaw)) {
      return NextResponse.json({ error: "variant inválida" }, { status: 400 });
    }
    const variant = variantRaw;
    const { w, h } = VARIANT_META[variant];
    const copy = parseCopy(body);

    if (!copy.productName || !copy.cta) {
      return NextResponse.json(
        { error: "Nombre del producto y CTA son obligatorios" },
        { status: 400 }
      );
    }

    const imageBase64 = String(body.imageBase64 ?? "").replace(
      /^data:image\/\w+;base64,/,
      ""
    );
    if (!imageBase64) {
      return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });
    }

    const inputBuf = Buffer.from(imageBase64, "base64");
    if (inputBuf.length < 32) {
      return NextResponse.json({ error: "Imagen no válida" }, { status: 400 });
    }

    const variantHint = VARIANT_META[variant].title;

    let imageModel: string;
    try {
      imageModel = resolveCreativoImageModelForApi(body.imageModel);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Modelo inválido";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let rawOut: Buffer;

    if (action === "edit") {
      const editInstruction = String(body.editInstruction ?? "").trim();
      if (!editInstruction) {
        return NextResponse.json(
          { error: "Instrucción de edición requerida" },
          { status: 400 }
        );
      }
      const prompt = buildEditUserPrompt(w, h, copy, editInstruction);
      const mimeIn = String(body.imageMime ?? "image/png").startsWith("image/")
        ? String(body.imageMime)
        : "image/png";
      rawOut = await generateCreativoImageFromParts({
        apiKey: key,
        model: imageModel,
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeIn,
              data: imageBase64,
            },
          },
        ],
      });
    } else if (action === "regenerate") {
      const prompt = buildRegenerateUserPrompt(w, h, copy, variantHint);
      const cropped = await cropProductToVariant(inputBuf, variant);
      rawOut = await generateCreativoImageFromParts({
        apiKey: key,
        model: imageModel,
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: cropped.mime,
              data: cropped.buffer.toString("base64"),
            },
          },
        ],
      });
    } else {
      const prompt = buildGenerateUserPrompt(w, h, copy, variantHint);
      const cropped = await cropProductToVariant(inputBuf, variant);
      rawOut = await generateCreativoImageFromParts({
        apiKey: key,
        model: imageModel,
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: cropped.mime,
              data: cropped.buffer.toString("base64"),
            },
          },
        ],
      });
    }

    const finalBuf = await enforceDimensions(rawOut, w, h);
    const outB64 = finalBuf.toString("base64");

    return NextResponse.json({
      imageBase64: outB64,
      mimeType: "image/png",
      variant,
      width: w,
      height: h,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
