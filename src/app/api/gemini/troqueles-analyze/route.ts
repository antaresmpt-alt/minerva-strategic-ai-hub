import { NextRequest, NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_ASK = `Eres el **Asistente de Troqueles** en Minerva (troqueles de corte / embutición).

Recibirás un JSON con la **vista actual** del listado de troqueles (número, proveedor, cliente, descripción, medidas, material, formato, expulsión, máquina, relieve, notas, etc.).

**Instrucciones:**
- Responde **solo en español**, en Markdown claro y breve.
- Basa la respuesta **exclusivamente** en los datos del JSON. Si algo no figura, dilo explícitamente.
- Para preguntas por cliente, material, expulsor/expulsión, barniz, máquina o acabados, busca en los campos relevantes (\`cliente\`, \`descripcion\`, \`material\`, \`expulsion\`, \`num_expulsion\`, \`caucho_acrilico\`, \`relieve_seco\`, \`maquina\`, \`notas\`, etc.).
- No inventes números de troquel ni datos que no aparezcan en el contexto.`;

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

    const user = `Datos del listado visible (troqueles filtrados):\n\n\`\`\`json\n${JSON.stringify(rows, null, 0)}\n\`\`\`\n\n**Pregunta:**\n${q}`;

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
