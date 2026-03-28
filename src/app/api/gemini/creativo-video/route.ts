import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { resolveGeminiModel } from "@/lib/gemini-model";
import {
  VIDEO_SCRIPT_SYSTEM,
  buildVideoScriptUserPrompt,
} from "@/lib/creativo-video-prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const gen = new GoogleGenerativeAI(key);
  const name = resolveGeminiModel();
  return gen.getGenerativeModel({
    model: name,
    systemInstruction: VIDEO_SCRIPT_SYSTEM,
  });
}

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const imageBase64 = String(body.imageBase64 ?? "").replace(
      /^data:image\/\w+;base64,/,
      ""
    );
    const imageMime = String(body.imageMime ?? "image/png");
    const productName = String(body.productName ?? "").trim();
    const cta = String(body.cta ?? "").trim();
    const originalPrice = String(body.originalPrice ?? "").trim();
    const offerPrice = String(body.offerPrice ?? "").trim();
    const description = body.description
      ? String(body.description).trim()
      : "";
    const discountPct = body.discountPct
      ? String(body.discountPct).trim()
      : "";

    if (!imageBase64) {
      return NextResponse.json({ error: "Imagen del producto requerida" }, { status: 400 });
    }
    if (!productName || !cta) {
      return NextResponse.json(
        { error: "Nombre del producto y CTA son obligatorios" },
        { status: 400 }
      );
    }
    if (!originalPrice || !offerPrice) {
      return NextResponse.json(
        {
          error:
            "Para el guion transaccional indica precio original y precio de oferta.",
        },
        { status: 400 }
      );
    }

    if (!imageMime.startsWith("image/")) {
      return NextResponse.json({ error: "Tipo de imagen no válido" }, { status: 400 });
    }

    const userText = buildVideoScriptUserPrompt({
      productName,
      cta,
      description: description || undefined,
      originalPrice,
      offerPrice,
      discountPct: discountPct || undefined,
    });

    const model = getModel();
    const result = await model.generateContent(
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: userText },
              {
                inlineData: {
                  mimeType: imageMime,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      },
      { signal }
    );

    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
