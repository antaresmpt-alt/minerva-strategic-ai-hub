import { NextRequest, NextResponse } from "next/server";

import {
  buildStockArticulosQueryMarkdown,
  queryStockArticulosAtp,
  toStockArticulosQueryResultRows,
} from "@/lib/stock-articulos-atp-query";
import { parseStockArticulosQueryFiltersPayload } from "@/lib/stock-articulos-query-filters";
import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_EXTRACT = `Eres el intérprete de consultas de **stock de artículos** en Minerva (producto terminado y WIP, vista \`stock_articulos_atp\`).

**No** es stock de material/palets (papel). Aquí: estuches, cajas, etiquetas, Takeit, etc.

Tu única tarea: convertir la pregunta del usuario en un JSON de criterios de búsqueda.

**Responde SOLO JSON** con esta forma:
{
  "interpretacion": "frase breve en español de lo que buscas",
  "filtros": { ...campos opcionales... }
}

**Campos disponibles en filtros** (usa solo los necesarios):
- cliente_contiene (string): nombre cliente Optimus
- referencia_cliente_contiene (string): código del cliente
- referencia_codigo_contiene (string): código Minerva M-xxxxx
- descripcion_contiene (string)
- ubicacion_contiene (string)
- ot_origen (string): nº OT FABRICACION / origen, solo dígitos
- unidad: "uds" | "hojas"
- estado_proceso: "terminado" | "impreso" | "troquelado" | "otro" (o array)
- estado_derivado: "disponible" | "parcial" | "reservado" | "agotado" (o array)
- libre_min | libre_max | fisico_min | fisico_max | reservado_min (enteros)
- solo_libre (boolean): cantidad_libre > 0
- solo_reservado (boolean)
- solo_pt (boolean): producto terminado (uds + terminado). Úsalo si hablan de estuches/cajas/stock listo
- incluir_agotados (boolean): default false (excluye físico = 0)
- agregacion: "listar" | "contar" | "sumar_libre" | "sumar_fisico" | "sumar_reservado"
- limite (entero, máx 120)

**Reglas:**
- «Cuánto hay de…» / «stock de…» → solo_pt: true + sumar_libre o listar.
- WIP / impreso / hojas → unidad hojas o estado_proceso impreso/troquelado (no solo_pt).
- «Más de N libres» → libre_min: N.
- Por defecto no incluir agotados.
- No mezcles unidades en sumas si puedes evitarlo (filtra unidad o solo_pt).
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
        { status: 400 }
      );
    }

    const hint =
      typeof contextHint === "string" ? contextHint.trim() : "";

    const extractUser = [
      `Pregunta del usuario:\n${q}`,
      hint
        ? `\nContexto UI (filtros visibles en pantalla, orientativo):\n${hint}`
        : "",
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
        { status: 502 }
      );
    }

    const { interpretacion, filtros } =
      parseStockArticulosQueryFiltersPayload(parsedRaw);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    }

    const queryResult = await queryStockArticulosAtp(supabase, filtros);
    const resultRows = toStockArticulosQueryResultRows(queryResult.rows);
    const text = buildStockArticulosQueryMarkdown(
      interpretacion,
      filtros,
      queryResult
    );

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
