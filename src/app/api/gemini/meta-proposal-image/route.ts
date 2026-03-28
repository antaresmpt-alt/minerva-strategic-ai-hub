import { NextRequest, NextResponse } from "next/server";
import { generateSquareAdImageFromPrompt } from "@/lib/creativo-gemini";
import { resolveCreativoImageModelForApi } from "@/lib/creativo-image-models";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt || prompt.length < 8) {
      return NextResponse.json(
        { error: "Descripción de imagen demasiado corta" },
        { status: 400 }
      );
    }

    let imageModel: string;
    try {
      imageModel = resolveCreativoImageModelForApi(body.imageModel);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Modelo inválido";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const buf = await generateSquareAdImageFromPrompt({
      apiKey: key,
      model: imageModel,
      prompt,
    });
    const imageBase64 = buf.toString("base64");

    return NextResponse.json({
      imageBase64,
      mimeType: "image/png",
      width: 1080,
      height: 1080,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
