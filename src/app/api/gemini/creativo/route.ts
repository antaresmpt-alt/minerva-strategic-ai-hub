import { NextRequest, NextResponse } from "next/server";
import type { CreativoVariant } from "@/lib/creativo-variants";
import { VARIANT_META } from "@/lib/creativo-variants";
import {
  buildGenerateUserPrompt,
  buildRegenerateUserPrompt,
  type CreativoCopy,
} from "@/lib/creativo-prompts";
import { generateCreativoEditImagePrompt } from "@/lib/creativo-edit-prompt-llm";
import { enforceDimensions } from "@/lib/creativo-gemini";
import { generateImageWithHuggingFace } from "@/lib/hf-text-to-image";
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

function wrapHfCreativoPrompt(
  inner: string,
  w: number,
  h: number,
  variantHint: string
): string {
  return `Create a single professional static advertising image for Meta (Facebook/Instagram). Target frame ${w}×${h} pixels (${variantHint}). ${inner} High CTR, bold composition, clean background, readable on mobile. Avoid illegible tiny text.`;
}

export async function POST(req: NextRequest) {
  const signal = req.signal;
  try {
    const token = process.env.HF_TOKEN?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "HF_TOKEN no configurada" },
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

    try {
      resolveCreativoImageModelForApi(body.imageModel);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Modelo inválido";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const variantHint = VARIANT_META[variant].title;

    let hfPrompt: string;

    if (action === "edit") {
      const editInstruction = String(body.editInstruction ?? "").trim();
      if (!editInstruction) {
        return NextResponse.json(
          { error: "Instrucción de edición requerida" },
          { status: 400 }
        );
      }
      const fluxCore = await generateCreativoEditImagePrompt({
        copy,
        w,
        h,
        variantHint,
        editInstruction,
        signal,
      });
      hfPrompt = wrapHfCreativoPrompt(fluxCore, w, h, variantHint);
    } else if (action === "regenerate") {
      const inner = buildRegenerateUserPrompt(w, h, copy, variantHint);
      hfPrompt = wrapHfCreativoPrompt(inner, w, h, variantHint);
    } else {
      const inner = buildGenerateUserPrompt(w, h, copy, variantHint);
      hfPrompt = wrapHfCreativoPrompt(inner, w, h, variantHint);
    }

    const { buffer: rawOut } = await generateImageWithHuggingFace({
      prompt: hfPrompt,
      token,
      signal,
    });

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
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
