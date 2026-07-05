import { NextRequest, NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_ROWS = 350;

const SYSTEM_ASK = `Eres el **Asistente de Stock de Material** en Minerva (cartelas por palet, ATP).

Recibirás un JSON con el **listado filtrado visible** en la vista Stock: id_stock, material, gramaje, formato, hojas libres/reservadas/físicas, OTs, estado, ubicación, coste, albarán, proveedor.

**Instrucciones:**
- Responde **solo en español**, en Markdown claro y breve.
- Basa la respuesta **exclusivamente** en los datos del JSON. Si algo no figura, dilo explícitamente.
- Para búsquedas de material (gramaje, formato, cantidad mínima libre), filtra mentalmente sobre el JSON y lista los **id_stock** que encajan con cantidades.
- \`libre\` = hojas disponibles ATP; \`reservado\` = hojas con reserva dura; \`fisico\` = cantidad actual del palet.
- No inventes id_stock ni palets que no aparezcan en el contexto.
- Si la pregunta pide sumar o contar, hazlo solo con los datos proporcionados.`;

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

    const slice = rows.slice(0, MAX_ROWS);
    const truncated = rows.length > MAX_ROWS;

    const user = `Datos del stock visible (palets filtrados${truncated ? `, mostrando ${MAX_ROWS} de ${rows.length}` : ""}):\n\n\`\`\`json\n${JSON.stringify(slice, null, 0)}\n\`\`\`\n\n**Pregunta:**\n${q}`;

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
      truncated,
      rowCount: slice.length,
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
