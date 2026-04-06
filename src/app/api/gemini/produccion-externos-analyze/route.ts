import { NextRequest, NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_ANALYZE = `Eres el **Analista de Producción Minerva** para la gestión de trabajos externos (subcontratación).

Recibirás un JSON con filas de la tabla actual: OT, cliente, trabajo, proveedor, acabado, estado, fechas en formato **DD/MM/AA** (año de 2 dígitos), etiqueta de semáforo (urgencia/retraso/…).

Debes responder SIEMPRE en español, en Markdown claro, con estas secciones en este orden (usa ## con emoji en el título):

## 🚩 Alertas
- Proveedores saturados (demasiados trabajos activos: Pendiente, Enviado, En Proveedor) frente al resto, con números.
- Retrasos críticos (semáforo de retraso o fecha prevista vencida) y su impacto breve.
- Si no hay alertas relevantes, dilo en una frase.

## 💡 Sugerencias
- Qué **OTs** deberían ser **prioridad hoy** según \`fechaPrevista\`, estado y semáforo (urgencia/retraso). Lista con viñetas (OT + motivo corto).

## 📈 Estado
- **Salud de producción** en una vista cuantificada: por ejemplo porcentajes aproximados «en tiempo» vs «retraso/urgencia» según semáforos y estados del JSON (no inventes cifras: calcúlalas solo a partir de los datos recibidos). Una frase de síntesis.

Sé conciso y accionable. No inventes OTs ni fechas que no estén en el JSON. Si la lista está vacía, indica que no hay datos para analizar.`;

const SYSTEM_ASK = `Eres el **Analista de Producción Minerva** para trabajos externos (subcontratación).

Recibirás un JSON con la **vista actual** del listado (OT, cliente, trabajo, proveedor, acabado, unidades, prioridad, palets, estados, fechas DD/MM/AA, semáforo, etc.).

**Instrucciones:**
- Responde **solo en español**, en Markdown claro y breve.
- Basa la respuesta **exclusivamente** en los datos del JSON. Si algo no figura en los datos, dilo explícitamente.
- Responde a la **pregunta del usuario** de forma directa (listados, comparativas, filtros conceptuales, etc.).
- No inventes OTs, fechas ni proveedores que no aparezcan en el contexto.`;

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const modelId = parseModelFromBody((body as { model?: unknown }).model);
    const rows = (body as { rows?: unknown }).rows;
    const mode = (body as { mode?: string }).mode ?? "analyze";
    const question = (body as { question?: unknown }).question;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Se requiere un array rows" },
        { status: 400 }
      );
    }

    if (mode === "ask") {
      const q =
        typeof question === "string" ? question.trim() : String(question ?? "").trim();
      if (!q) {
        return NextResponse.json(
          { error: "Escribe una pregunta para el modo «Preguntar»." },
          { status: 400 }
        );
      }
      const user = `Datos del listado actual (fechas en DD/MM/AA cuando apliquen):\n\n\`\`\`json\n${JSON.stringify(rows, null, 0)}\n\`\`\`\n\n**Pregunta:**\n${q}`;
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
    }

    const user = `Datos de la vista actual (tabla de seguimiento; fechas estrictamente DD/MM/AA, año 2 dígitos):\n\n\`\`\`json\n${JSON.stringify(rows, null, 0)}\n\`\`\``;

    const result = await generateLlmText({
      modelId,
      system: SYSTEM_ANALYZE,
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
