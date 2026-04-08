import { NextRequest, NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_ASK = `Eres el **Asistente de Fichas Técnicas de Impresión** en Minerva.

Recibirás un JSON con la **vista actual** del listado de fichas (OT, cliente, trabajo, gramaje, material, formato, pasadas, tipo de impresión, densidades 1–8, notas, maquinista, fecha, etc.).

**Instrucciones:**
- Responde **solo en español**, en Markdown claro y breve.
- Basa la respuesta **exclusivamente** en los datos del JSON. Si algo no figura, dilo explícitamente.
- Para preguntas sobre colores, Pantone, tintas o números en densidades/notas/tipo_impresión, busca coincidencias en los campos relevantes del JSON (p. ej. \`densidad_1\`…\`densidad_8\`, \`tipo_impresion\`, \`notas\`, \`trabajo\`).
- No inventes OTs ni datos que no aparezcan en el contexto.`;

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const modelId = parseModelFromBody((body as { model?: unknown }).model);
    const rows = (body as { rows?: unknown }).rows;
    const question = (body as { question?: unknown }).question;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Se requiere un array rows" },
        { status: 400 }
      );
    }

    const q =
      typeof question === "string"
        ? question.trim()
        : String(question ?? "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "Escribe una pregunta." },
        { status: 400 }
      );
    }

    const user = `Datos del listado visible (fichas técnicas filtradas):\n\n\`\`\`json\n${JSON.stringify(rows, null, 0)}\n\`\`\`\n\n**Pregunta:**\n${q}`;

    const result = await generateLlmText({
      modelId,
      system: SYSTEM_ASK,
      user,
      maxOutputTokens: 4096,
      temperature: 0.35,
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
