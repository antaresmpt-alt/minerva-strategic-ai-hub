import { NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_OPTIMUS_IMPORT_PROMPT,
  TABLE_PROD_CONFIGURACION,
  TEMPLATE_OPTIMUS_IMPORT_PROMPT,
} from "@/lib/email-plantillas-produccion";
import {
  parseDateLikeToYmd,
  prioridadSugeridaDesdeTexto,
  splitOptimusReferencia5Plus2,
} from "@/lib/externos-optimus-import";
import { generateLlmText, parseModelFromBody } from "@/lib/llm-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 90;

type InputFile = {
  filename: string;
  text: string;
};

type RawLlmRow = {
  referencia?: unknown;
  proveedor_nombre?: unknown;
  trabajo_titulo?: unknown;
  unidades?: unknown;
  fecha_envio?: unknown;
  fecha_prevista?: unknown;
  observaciones?: unknown;
  raw_text?: unknown;
};

function toFiniteInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function pickJsonObject(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(t.slice(start, end + 1)) as unknown;
    }
    throw new Error("La IA no devolvió JSON válido.");
  }
}

async function loadSystemPrompt(): Promise<string> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from(TABLE_PROD_CONFIGURACION)
      .select("valor")
      .eq("clave", TEMPLATE_OPTIMUS_IMPORT_PROMPT)
      .maybeSingle();
    if (error) throw error;
    const value = (data as { valor?: string | null } | null)?.valor ?? "";
    const trimmed = String(value).trim();
    return trimmed || DEFAULT_OPTIMUS_IMPORT_PROMPT;
  } catch {
    return DEFAULT_OPTIMUS_IMPORT_PROMPT;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { files?: unknown; model?: unknown };
    const modelId = parseModelFromBody(body.model);
    const files = Array.isArray(body.files) ? (body.files as InputFile[]) : [];
    if (files.length === 0) {
      return NextResponse.json({ error: "Se requiere files[]" }, { status: 400 });
    }
    const txtOnly = files.filter(
      (f) =>
        f &&
        typeof f.filename === "string" &&
        typeof f.text === "string" &&
        f.filename.toLowerCase().endsWith(".txt")
    );
    if (txtOnly.length === 0) {
      return NextResponse.json(
        { error: "Solo se admiten .txt en esta versión de importación." },
        { status: 400 }
      );
    }

    const system = await loadSystemPrompt();
    const user = `Extrae filas desde estos albaranes:\n\n${JSON.stringify(
      txtOnly.map((f) => ({ filename: f.filename, text: f.text.slice(0, 60000) })),
      null,
      2
    )}`;

    const llm = await generateLlmText({
      modelId,
      system,
      user,
      maxOutputTokens: 8192,
      temperature: 0.1,
      signal: req.signal,
    });

    const parsed = pickJsonObject(llm.text) as { rows?: unknown };
    const rows = Array.isArray(parsed.rows) ? (parsed.rows as RawLlmRow[]) : [];

    const normalized = rows
      .map((r) => {
        const referencia = String(r.referencia ?? "").trim();
        const split = splitOptimusReferencia5Plus2(referencia);
        if (!split) return null;
        const rawText = String(r.raw_text ?? "");
        const observaciones = String(r.observaciones ?? "").trim();
        const fechaEnvio = parseDateLikeToYmd(String(r.fecha_envio ?? ""));
        const fechaPrevistaRaw = parseDateLikeToYmd(String(r.fecha_prevista ?? ""));
        const today = new Date();
        const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(today.getDate()).padStart(2, "0")}`;
        const fechaPrevista = fechaPrevistaRaw || fechaEnvio || todayYmd;
        return {
          referencia,
          ot_raw: split.ot,
          num_operacion: split.numOperacion,
          id_pedido: split.idPedido,
          proveedor_nombre_detectado: String(r.proveedor_nombre ?? "").trim(),
          trabajo_titulo: String(r.trabajo_titulo ?? "").trim(),
          unidades: toFiniteInt(r.unidades),
          fecha_envio: fechaEnvio || todayYmd,
          fecha_prevista: fechaPrevista,
          observaciones: observaciones || null,
          raw_text: rawText || null,
          prioridad_sugerida: prioridadSugeridaDesdeTexto(
            `${rawText}\n${observaciones}\n${String(r.trabajo_titulo ?? "")}`
          ),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    return NextResponse.json({
      rows: normalized,
      modelUsed: llm.modelUsed,
      didFallback: llm.didFallback,
      fallbackReason: llm.fallbackReason,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

