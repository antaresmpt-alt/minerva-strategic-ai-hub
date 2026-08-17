import type { SupabaseClient } from "@supabase/supabase-js";

import type { DespachoItinerarioSlot } from "@/components/produccion/ots/despacho-itinerario-picker";
import {
  buildCtpRequisitosSeedFromWizard,
  mergeDatosProcesoSeed,
} from "@/lib/ctp-despacho";
import {
  TABLE_OT_DESPACHADAS,
  applyCloneExtrasPrefill,
  buildDatosProcesoSeed,
  emptyDespachoForm,
  extractDespachoCloneExtrasFromPasos,
  parseProcesoDatosFromPasos,
  type DespachoFormState,
  type DespachoWizardProcesoDatos,
} from "@/lib/despacho-wizard-shared";
import { PROCESO_CTP_ID } from "@/lib/hoja-ruta-campos-config";

const DESPACHO_ITINERARIO_SEED_SELECT =
  "tintas, material, tamano_hoja, gramaje, num_hojas_brutas, num_hojas_netas, horas_entrada, horas_tiraje, horas_estimadas_troquelado, horas_engomado_preparacion, horas_engomado_tiraje, horas_estimadas_engomado, tipo_engomado, troquel, poses, acabado_pral, notas, referencia_id, ot_anterior_numero, ot_anterior_id";

function numStr(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? String(n) : "";
}

/** Convierte fila de `produccion_ot_despachadas` al formulario del wizard. */
export function despachoDbRowToFormState(
  row: Record<string, unknown>,
): DespachoFormState {
  const prep = row.horas_engomado_preparacion;
  const tir = row.horas_engomado_tiraje;
  return {
    ...emptyDespachoForm(),
    tintas: String(row.tintas ?? "").trim(),
    material: String(row.material ?? "").trim(),
    tamano_hoja: String(row.tamano_hoja ?? "").trim(),
    gramaje: numStr(row.gramaje as number | null),
    num_hojas_brutas: numStr(row.num_hojas_brutas as number | null),
    num_hojas_netas: numStr(row.num_hojas_netas as number | null),
    horas_entrada: numStr(row.horas_entrada as number | null),
    horas_tiraje: numStr(row.horas_tiraje as number | null),
    horas_estimadas_troquelado: numStr(
      row.horas_estimadas_troquelado as number | null,
    ),
    horas_troquel_preparacion: "",
    horas_troquel_tiraje: "",
    horas_engomado_preparacion: numStr(prep as number | null),
    horas_engomado_tiraje: numStr(tir as number | null),
    horas_estimadas_engomado:
      prep != null || tir != null
        ? ""
        : numStr(row.horas_estimadas_engomado as number | null),
    tipo_engomado: String(row.tipo_engomado ?? "").trim(),
    troquel: String(row.troquel ?? "").trim(),
    poses: numStr(row.poses as number | null),
    acabado_pral: String(row.acabado_pral ?? "").trim(),
    codigo_caja_embalaje: String(row.codigo_caja_embalaje ?? "").trim(),
    unidades_por_embalaje: numStr(row.unidades_por_embalaje as number | null),
    notas: String(row.notas ?? "").trim(),
    referencia_id:
      typeof row.referencia_id === "string" ? row.referencia_id : null,
    referencia_codigo: String(row.referencia_codigo ?? "").trim(),
    ot_anterior_numero: String(row.ot_anterior_numero ?? "").trim(),
    ot_anterior_id:
      typeof row.ot_anterior_id === "string" ? row.ot_anterior_id : null,
  };
}

export type ItinerarioSeedContext = {
  form: DespachoFormState;
  procesoDatos: DespachoWizardProcesoDatos;
  procesoIdsInRoute: Set<number>;
};

/** Carga cabecera de despacho + datos de procesos ya hechos para sembrar pasos nuevos. */
export async function fetchItinerarioSeedContext(
  supabase: SupabaseClient,
  otNumero: string,
  pasosConDatos: Array<{ proceso_id: number; datos_proceso?: unknown }>,
  slotProcesoIds: number[],
): Promise<ItinerarioSeedContext | null> {
  const ot = otNumero.trim();
  if (!ot) return null;

  const { data: despRow, error: despErr } = await supabase
    .from(TABLE_OT_DESPACHADAS)
    .select(DESPACHO_ITINERARIO_SEED_SELECT)
    .eq("ot_numero", ot)
    .order("despachado_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (despErr) throw despErr;
  if (!despRow) return null;

  let form = despachoDbRowToFormState(despRow as Record<string, unknown>);
  const extras = extractDespachoCloneExtrasFromPasos(pasosConDatos);
  form = applyCloneExtrasPrefill(form, extras, { mode: "overwrite" }).next;

  const procesoDatos = parseProcesoDatosFromPasos(pasosConDatos);
  const procesoIdsInRoute = new Set([
    ...pasosConDatos.map((p) => p.proceso_id),
    ...slotProcesoIds,
  ]);

  return { form, procesoDatos, procesoIdsInRoute };
}

/** `datos_proceso` para un paso nuevo o reinsertado en cola viva. */
export function buildDatosProcesoForItinerarioSlot(
  slot: DespachoItinerarioSlot,
  ctx: ItinerarioSeedContext,
  preserved: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const seed = buildDatosProcesoSeed(
    slot.procesoId,
    ctx.form,
    ctx.procesoDatos,
    ctx.procesoIdsInRoute,
  );
  const fallbackSeed =
    seed ??
    (slot.procesoId === PROCESO_CTP_ID
      ? buildCtpRequisitosSeedFromWizard(ctx.procesoDatos.ctp)
      : null);
  return mergeDatosProcesoSeed(preserved, fallbackSeed, slot.procesoId);
}
