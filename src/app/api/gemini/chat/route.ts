import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { resolveGeminiModel } from "@/lib/gemini-model";
import { DEEP_DIVE_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

type ChatTurn = { role: "user" | "model"; content: string };

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const gen = new GoogleGenerativeAI(key);
  const name = resolveGeminiModel();
  return gen.getGenerativeModel({
    model: name,
    systemInstruction: DEEP_DIVE_SYSTEM,
  });
}

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
    const originalReport = String(body.originalReport ?? "").trim();
    const question = String(body.question ?? "").trim();
    const history = (body.history ?? []) as ChatTurn[];

    if (!originalReport) {
      return NextResponse.json({ error: "Informe no disponible" }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: "Pregunta requerida" }, { status: 400 });
    }

    const model = getModel();
    const prompt = buildPrompt(originalReport, history, question);

    const result = await model.generateContent(
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
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
