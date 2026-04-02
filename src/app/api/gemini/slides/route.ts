import { NextRequest, NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import { SLIDES_INSTRUCTION } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const modelId = parseModelFromBody(
      (body as { model?: unknown }).model
    );
    const strategicAnalysis = String(body.strategicAnalysis ?? "").trim();

    if (!strategicAnalysis) {
      return NextResponse.json(
        { error: "Se requiere un análisis estratégico previo" },
        { status: 400 }
      );
    }

    const userText = `Análisis estratégico previo (base):\n\n${strategicAnalysis}\n\n---\nGenera la estructura de 12 diapositivas solicitada.`;
    const result = await generateLlmText({
      modelId,
      system: SLIDES_INSTRUCTION,
      user: userText,
      maxOutputTokens: 8192,
      temperature: 0.4,
      signal,
    });
    return NextResponse.json({
      text: result.text,
      ...llmFieldsForApiResponse(result),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
