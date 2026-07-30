/**
 * Bloque 6.x — Paso C: recálculo bajo demanda de promedios en el maestro.
 *
 * Lee `prod_ot_producidas`, aplica el motor (§7.1.5 / §7.1.10) y escribe
 * SOLO columnas `*_promedio` / `*_muestra_n` + metadatos.
 * Nunca toca `*_oficial` ni `*_habitual`.
 *
 * Ámbito opcional: `referenciaIds` limita a esas referencias (selección /
 * filtro / un solo artículo). Sin IDs → todas las que tengan histórico.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePromediosByReferencia,
  type MaestroPromediosPatch,
  type ProducidaPromediosInput,
} from "@/lib/maestro-promedios-calc";

const PAGE_SIZE = 500;
const UPDATE_CONCURRENCY = 8;

/** Columnas mínimas para el motor (evita traer snapshot JSONB). */
export const PROMEDIOS_PRODUCIDAS_SELECT =
  "id, ot_numero, referencia_id, version, excluido_de_promedios, cantidad_pedida, material, gramaje, tintas, troquel, poses, acabado_pral, tipo_engomado, codigo_caja_embalaje, estuches_por_bulto, merma_total, horas_prep_impresion_reales, horas_tiraje_impresion_reales, horas_prep_troquelado_reales, horas_tiraje_troquelado_reales, horas_prep_engomado_reales, horas_tiraje_engomado_reales, horas_guillotina_reales, horas_desbroce_reales";

export type ActualizarPromediosOptions = {
  /** Si se informa, solo recalcula estas referencias. */
  referenciaIds?: readonly string[];
};

export type ActualizarPromediosResult = {
  actualizadoAt: string;
  filasHistoricoLeidas: number;
  otsUsadas: number;
  referenciasActualizadas: number;
  referenciasFallidas: number;
  errores: Array<{ referenciaId: string; message: string }>;
};

/** Payload de UPDATE: solo capas promedio + meta. Sin `_oficial`. */
export function buildPromediosDbUpdate(
  patch: MaestroPromediosPatch,
  actualizadoAt: string,
): Record<string, string | number | null> {
  return {
    promedios_actualizados_at: actualizadoAt,
    promedios_basados_en_n_ots: patch.promedios_basados_en_n_ots,
    material_promedio: patch.material_promedio,
    troquel_promedio: patch.troquel_promedio,
    tintas_promedio: patch.tintas_promedio,
    acabado_promedio: patch.acabado_promedio,
    tipo_engomado_promedio: patch.tipo_engomado_promedio,
    caja_embalaje_promedio: patch.caja_embalaje_promedio,
    poses_promedio: patch.poses_promedio,
    poses_muestra_n: patch.poses_muestra_n,
    gramaje_promedio: patch.gramaje_promedio,
    gramaje_muestra_n: patch.gramaje_muestra_n,
    unidades_por_embalaje_promedio: patch.unidades_por_embalaje_promedio,
    unidades_por_embalaje_muestra_n: patch.unidades_por_embalaje_muestra_n,
    merma_promedio: patch.merma_promedio,
    merma_muestra_n: patch.merma_muestra_n,
    horas_prep_impresion_promedio: patch.horas_prep_impresion_promedio,
    horas_prep_impresion_muestra_n: patch.horas_prep_impresion_muestra_n,
    horas_prep_troquelado_promedio: patch.horas_prep_troquelado_promedio,
    horas_prep_troquelado_muestra_n: patch.horas_prep_troquelado_muestra_n,
    horas_prep_engomado_promedio: patch.horas_prep_engomado_promedio,
    horas_prep_engomado_muestra_n: patch.horas_prep_engomado_muestra_n,
    horas_millar_impresion_promedio: patch.horas_millar_impresion_promedio,
    horas_millar_impresion_muestra_n: patch.horas_millar_impresion_muestra_n,
    horas_millar_troquelado_promedio: patch.horas_millar_troquelado_promedio,
    horas_millar_troquelado_muestra_n: patch.horas_millar_troquelado_muestra_n,
    horas_millar_engomado_promedio: patch.horas_millar_engomado_promedio,
    horas_millar_engomado_muestra_n: patch.horas_millar_engomado_muestra_n,
    horas_guillotina_promedio: patch.horas_guillotina_promedio,
    horas_guillotina_muestra_n: patch.horas_guillotina_muestra_n,
    horas_desbroce_promedio: patch.horas_desbroce_promedio,
    horas_desbroce_muestra_n: patch.horas_desbroce_muestra_n,
  };
}

async function fetchAllProducidasForPromedios(
  supabase: SupabaseClient,
): Promise<ProducidaPromediosInput[]> {
  const all: ProducidaPromediosInput[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("prod_ot_producidas")
      .select(PROMEDIOS_PRODUCIDAS_SELECT)
      .order("ot_numero", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as ProducidaPromediosInput[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Recalcula promedios y escribe solo capas `_promedio`.
 * @param options.referenciaIds — si hay IDs, solo esas referencias.
 */
export async function actualizarPromediosMaestro(
  supabase: SupabaseClient,
  options?: ActualizarPromediosOptions,
): Promise<ActualizarPromediosResult> {
  const actualizadoAt = new Date().toISOString();
  const filas = await fetchAllProducidasForPromedios(supabase);
  let results = computePromediosByReferencia(filas);

  const filterIds = options?.referenciaIds
    ?.map((id) => String(id).trim())
    .filter(Boolean);
  if (filterIds && filterIds.length > 0) {
    const wanted = new Set(filterIds);
    results = results.filter((r) => wanted.has(r.referenciaId));
  }

  const otsUsadas = results.reduce((acc, r) => acc + r.nOts, 0);

  const errores: ActualizarPromediosResult["errores"] = [];
  let referenciasActualizadas = 0;

  const outcomes = await mapPool(results, UPDATE_CONCURRENCY, async (item) => {
    const payload = buildPromediosDbUpdate(item.patch, actualizadoAt);
    const { error } = await supabase
      .from("prod_referencias")
      .update(payload)
      .eq("id", item.referenciaId);
    if (error) {
      return {
        ok: false as const,
        referenciaId: item.referenciaId,
        message: error.message,
      };
    }
    return { ok: true as const, referenciaId: item.referenciaId };
  });

  for (const o of outcomes) {
    if (o.ok) referenciasActualizadas += 1;
    else errores.push({ referenciaId: o.referenciaId, message: o.message });
  }

  return {
    actualizadoAt,
    filasHistoricoLeidas: filas.length,
    otsUsadas,
    referenciasActualizadas,
    referenciasFallidas: errores.length,
    errores,
  };
}
