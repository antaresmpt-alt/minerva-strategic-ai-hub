import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { generateImageWithHuggingFace } from "@/lib/hf-text-to-image";
import {
  buildLifestylePrompt,
  buildStudioPrompt,
} from "@/lib/sem-creative-lab-prompts";
import {
  type PackagingAnalysis,
  isPackagingAnalysis,
  normalizeSemCreativeLabAnalysis,
} from "@/lib/sem-creative-lab-types";

export const runtime = "nodejs";
export const maxDuration = 300;

type Variation = "studio" | "lifestyle";

function parseBody(raw: unknown): {
  analysis: PackagingAnalysis;
  variation: Variation;
} {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Cuerpo JSON inválido.");
  }
  const o = raw as Record<string, unknown>;
  const analysisRaw = o.analysis;
  const analysis = normalizeSemCreativeLabAnalysis(analysisRaw);
  if (!isPackagingAnalysis(analysis)) {
    throw new Error(
      "No se pudo normalizar analysis (product_name, main_colors[], key_elements[], exact_colors, format, die_cut_faces)."
    );
  }
  const v = o.variation === "lifestyle" ? "lifestyle" : "studio";
  return { analysis, variation: v };
}

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken?.trim()) {
      return NextResponse.json(
        { error: "HF_TOKEN no configurada" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as unknown;
    const { analysis, variation } = parseBody(body);
    const prompt =
      variation === "lifestyle"
        ? buildLifestylePrompt(analysis)
        : buildStudioPrompt(analysis);

    const { buffer, modelUsed } = await generateImageWithHuggingFace({
      prompt,
      token: hfToken,
      signal,
    });

    const png = await sharp(buffer).png().toBuffer();
    const imageBase64 = png.toString("base64");

    return NextResponse.json({
      imageBase64,
      mime: "image/png",
      promptUsed: prompt,
      modelUsed,
      variation,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message =
      e instanceof Error ? e.message : "Error al generar la imagen con Hugging Face.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("cuota") ||
      lower.includes("permisos") ||
      lower.includes("hf_token")
        ? 503
        : lower.includes("válido") || lower.includes("falta")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
