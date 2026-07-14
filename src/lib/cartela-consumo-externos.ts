import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARTELA_DATOS_KEYS,
  PROCESO_IMPRESION_EXTERNA_ID,
  procesoUsaCartela,
  suggestHojasConsumoCartela,
  type PasoItinerarioConsumo,
} from "@/lib/cartela-ejecucion";
import {
  aplicarConsumoCartelaSiCorresponde,
  parseCartelaConsumoFromDatos,
} from "@/lib/cartela-stock-consumo";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";

export type ConsumoExternoEnviadoContext = {
  otPasoId: string;
  otNumero: string;
  procesoId: number;
  datosProceso: DatosProcesoGenerico;
  pasosItinerario: PasoItinerarioConsumo[];
};

export type ConsumoExternoEnviadoEval =
  | { kind: "skip" }
  | {
      kind: "needs_cartela";
      context: ConsumoExternoEnviadoContext;
      datosDraft: DatosProcesoGenerico;
    }
  | {
      kind: "ready";
      context: ConsumoExternoEnviadoContext;
      datos: DatosProcesoGenerico;
    };

function mergeHojasEnDatosCartela(
  datos: DatosProcesoGenerico,
  procesoId: number,
  hojasEnviadas?: number | null,
): DatosProcesoGenerico {
  const existing = datos[CARTELA_DATOS_KEYS.hojasConsumidas];
  if (typeof existing === "number" && existing > 0) return datos;

  let hojas =
    typeof hojasEnviadas === "number" && hojasEnviadas > 0
      ? Math.round(hojasEnviadas)
      : null;
  if (hojas == null) {
    hojas = suggestHojasConsumoCartela(procesoId, datos);
  }
  if (hojas == null || hojas <= 0) return datos;
  return { ...datos, [CARTELA_DATOS_KEYS.hojasConsumidas]: hojas };
}

/** Carga contexto solo si el paso es impresión externa y primer consumidor de material. */
export async function loadConsumoExternoEnviadoContext(
  supabase: SupabaseClient,
  params: {
    otPasoId: string | null | undefined;
    otNumero: string;
  },
): Promise<ConsumoExternoEnviadoContext | null> {
  const otPasoId = String(params.otPasoId ?? "").trim();
  if (!otPasoId) return null;

  const { data: paso, error: pasoErr } = await supabase
    .from("prod_ot_pasos")
    .select("id, ot_id, proceso_id, datos_proceso")
    .eq("id", otPasoId)
    .maybeSingle();
  if (pasoErr) throw pasoErr;
  if (!paso) return null;

  const procesoId = paso.proceso_id;
  if (procesoId !== PROCESO_IMPRESION_EXTERNA_ID) return null;

  const otId = String(paso.ot_id ?? "").trim();
  if (!otId) return null;

  const { data: pasosData, error: pasosErr } = await supabase
    .from("prod_ot_pasos")
    .select("proceso_id, orden")
    .eq("ot_id", otId)
    .order("orden", { ascending: true });
  if (pasosErr) throw pasosErr;

  const pasosItinerario: PasoItinerarioConsumo[] = (pasosData ?? []).map((p) => ({
    procesoId: p.proceso_id,
    orden: typeof p.orden === "number" ? p.orden : 0,
  }));

  if (!procesoUsaCartela(procesoId, pasosItinerario)) return null;

  return {
    otPasoId,
    otNumero: params.otNumero,
    procesoId,
    datosProceso: (paso.datos_proceso as DatosProcesoGenerico) ?? {},
    pasosItinerario,
  };
}

export function evaluarConsumoExternoEnviado(
  context: ConsumoExternoEnviadoContext,
  hojasEnviadas?: number | null,
): ConsumoExternoEnviadoEval {
  const datos = mergeHojasEnDatosCartela(
    context.datosProceso,
    context.procesoId,
    hojasEnviadas,
  );
  const parsed = parseCartelaConsumoFromDatos(datos);

  if (parsed.hojas == null || parsed.hojas <= 0) {
    return { kind: "skip" };
  }

  if (!parsed.idStock && !parsed.paletId) {
    return { kind: "needs_cartela", context, datosDraft: datos };
  }

  return { kind: "ready", context, datos };
}

export async function ejecutarConsumoExternoEnviado(
  supabase: SupabaseClient,
  context: ConsumoExternoEnviadoContext,
  datos: DatosProcesoGenerico,
): Promise<{ consumido: boolean; hojas: number | null }> {
  const result = await aplicarConsumoCartelaSiCorresponde(supabase, {
    procesoId: context.procesoId,
    otNumero: context.otNumero,
    pasoId: context.otPasoId,
    datos,
    pasosItinerario: context.pasosItinerario,
  });

  const { error: dpErr } = await supabase
    .from("prod_ot_pasos")
    .update({ datos_proceso: datos })
    .eq("id", context.otPasoId);
  if (dpErr) throw dpErr;

  return result;
}

export async function prepararConsumoExternoAlMarcarEnviado(
  supabase: SupabaseClient,
  params: {
    otPasoId: string | null | undefined;
    otNumero: string;
    hojasEnviadas?: number | null;
  },
): Promise<ConsumoExternoEnviadoEval> {
  const context = await loadConsumoExternoEnviadoContext(supabase, params);
  if (!context) return { kind: "skip" };
  return evaluarConsumoExternoEnviado(context, params.hojasEnviadas);
}
