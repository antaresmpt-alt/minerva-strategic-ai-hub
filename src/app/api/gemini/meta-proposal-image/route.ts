import { NextRequest, NextResponse } from "next/server";
import { generateImageWithHuggingFace } from "@/lib/hf-text-to-image";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt || prompt.length < 8) {
      return NextResponse.json(
        { error: "Descripción de imagen demasiado corta" },
        { status: 400 }
      );
    }

    const full = `Create a single square 1:1 advertising creative for Meta (Facebook/Instagram) feed. ${prompt} Professional, high CTR, bold composition, clean background. Avoid illegible small text.`;

    const { buffer } = await generateImageWithHuggingFace({
      prompt: full,
      token,
      signal,
    });
    const imageBase64 = buffer.toString("base64");

    return NextResponse.json({
      imageBase64,
      mimeType: "image/png",
      width: 1080,
      height: 1080,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
