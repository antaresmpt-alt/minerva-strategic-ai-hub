import { NextRequest, NextResponse } from "next/server";

import {
  buildStockQueryMarkdown,
  queryStockPaletsAtp,
  toStockQueryResultRows,
} from "@/lib/stock-atp-query";
import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import { parseStockQueryFiltersPayload } from "@/lib/stock-query-filters";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_EXTRACT = `Eres el intérprete de consultas de **stock de material** en Minerva (cartelas por palet, vista ATP).

Tu única tarea: convertir la pregunta del usuario en un JSON de criterios de búsqueda sobre la vista \`stock_palets_atp\`.

**Responde SOLO JSON** con esta forma:
{
  "interpretacion": "frase breve en español de lo que buscas",
  "filtros": { ...campos opcionales... }
}

**Campos disponibles en filtros** (usa solo los necesarios):
- material_contiene (string): nombre del papel, ej. "zenith", "folding", "offset"
- codigo_articulo_contiene (string)
- formato_contiene (string): ej. "65x92", "70x100" (no incluyas unidad)
- ubicacion_fila (string): fila de almacén, ej. "ZENITH", "GRISES"
- nota_entrega_contiene (string): número de albarán proveedor
- proveedor_contiene (string): nombre proveedor
- gramaje_exacto | gramaje_min | gramaje_max (número)
- libre_min | libre_max: hojas ATP libres (físico − reserva dura)
- fisico_min | fisico_max: hojas físicas en el palet
- reservado_min: hojas con reserva dura
- id_stock (entero): Id cartela, ej. 10487
- estado_derivado: "disponible" | "parcial" | "reservado" | "agotado" (o array)
- sin_ot (boolean): palets sin ninguna OT referenciada
- solo_libre (boolean): cantidad_libre > 0
- solo_reservado (boolean): cantidad_reservada_total > 0
- ot_numero (string): solo dígitos, ej. "36083" (sin prefijo OT)
- incluir_prueba (boolean): incluir cartelas sandbox Id ≥ 99000 (default false)
- agregacion: "listar" | "contar" | "sumar_libre" | "sumar_fisico" | "sumar_reservado"
- limite (entero, máx 120): filas a listar si agregacion=listar

**Reglas:**
- Si preguntan «cuántos» / «cuánto hay» → agregacion acorde (contar o sumar_libre).
- «Sin OT» / «libre sin OT» → sin_ot: true (y solo_libre si piden hojas disponibles).
- «Más de N hojas libres» → libre_min: N.
- Gramaje: 300 gr → gramaje_exacto: 300.
- Por defecto incluir_prueba: false.
- No inventes id_stock si el usuario no lo menciona.
- Si la pregunta es ambigua, elige criterios razonables y explícalo en interpretacion.`;

function parseExtractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("El modelo no devolvió JSON válido.");
  }
}

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const modelId = parseModelFromBody((body as { model?: unknown }).model);
    const question = (body as { question?: unknown }).question;
    const contextHint = (body as { contextHint?: unknown }).contextHint;

    const q =
      typeof question === "string"
        ? question.trim()
        : String(question ?? "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "Escribe una pregunta." },
        { status: 400 },
      );
    }

    const hint =
      typeof contextHint === "string" ? contextHint.trim() : "";

    const extractUser = [
      `Pregunta del usuario:\n${q}`,
      hint ? `\nContexto UI (filtros visibles en pantalla, orientativo):\n${hint}` : "",
    ].join("");

    const extractResult = await generateLlmText({
      modelId,
      system: SYSTEM_EXTRACT,
      user: extractUser,
      maxOutputTokens: 1024,
      temperature: 0.1,
      jsonMode: true,
      signal,
    });

    let parsedRaw: unknown;
    try {
      parsedRaw = parseExtractJson(extractResult.text);
    } catch (parseErr) {
      const parseMsg =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      return NextResponse.json(
        {
          error: "No se pudieron interpretar los criterios de búsqueda.",
          parseError: parseMsg,
          rawPreview: extractResult.text.slice(0, 800),
        },
        { status: 502 },
      );
    }

    const { interpretacion, filtros } = parseStockQueryFiltersPayload(parsedRaw);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    }

    const queryResult = await queryStockPaletsAtp(supabase, filtros);
    const resultRows = toStockQueryResultRows(queryResult.rows);
    const text = buildStockQueryMarkdown(interpretacion, filtros, queryResult);

    return NextResponse.json({
      text,
      interpretacion,
      filtros,
      rows: resultRows,
      totalMatches: queryResult.totalMatches,
      truncated: queryResult.truncated,
      aggregation: queryResult.aggregation ?? null,
      mode: "nl_sql",
      ...llmFieldsForApiResponse(extractResult),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
