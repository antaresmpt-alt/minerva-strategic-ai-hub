import { NextRequest, NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import { DEEP_DIVE_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

type ChatTurn = { role: "user" | "model"; content: string };

function buildPrompt(originalReport: string, history: ChatTurn[], question: string) {
  const hist = history
    .map((h) => `${h.role === "user" ? "Usuario" : "Asistente"}: ${h.content}`)
    .join("\n\n");

  return `## Informe original (contexto obligatorio)
${originalReport}

## Historial de conversación
${hist || "(sin mensajes previos)"}

## Nueva pregunta del usuario
${question}

Responde de forma útil y anclada al informe.`;
}

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const modelId = parseModelFromBody(
      (body as { model?: unknown }).model
    );
    const originalReport = String(body.originalReport ?? "").trim();
    const question = String(body.question ?? "").trim();
    const history = (body.history ?? []) as ChatTurn[];

    if (!originalReport) {
      return NextResponse.json({ error: "Informe no disponible" }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: "Pregunta requerida" }, { status: 400 });
    }

    const prompt = buildPrompt(originalReport, history, question);

    const result = await generateLlmText({
      modelId,
      system: DEEP_DIVE_SYSTEM,
      user: prompt,
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
