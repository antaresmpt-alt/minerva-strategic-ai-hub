import { NextRequest, NextResponse } from "next/server";
import { generateVideoScriptText } from "@/lib/creativo-video-llm";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const text = await generateVideoScriptText({
      productName,
      cta,
      description: description || undefined,
      originalPrice,
      offerPrice,
      discountPct: discountPct || undefined,
      imageBase64,
      imageMime,
      signal,
    });

    return NextResponse.json({ text });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
