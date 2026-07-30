/**
 * Bloque 6.x — Paso B: motor puro de promedios desde histórico.
 *
 * Entrada: filas de `prod_ot_producidas`.
 * Salida: patch de columnas `*_promedio` / `*_muestra_n` (+ n global).
 * No escribe en BD (eso es Paso C — botón Maestro).
 *
 * Reglas (§7.1.5 / §7.1.10):
 * - Categóricos → moda
 * - Numéricos / prep → mediana absoluta
 * - Tiraje → mediana de (H × 1000 / Q)
 * - Solo excluido_de_promedios = false + MAX(version) por ot_numero
 * - Solo filas con referencia_id
 */

import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

/** Campos mínimos que necesita el motor (permite mocks ligeros en tests). */
export type ProducidaPromediosInput = Pick<
  ProdOtProducidaRow,
  | "id"
  | "ot_numero"
  | "referencia_id"
  | "version"
  | "excluido_de_promedios"
  | "cantidad_pedida"
  | "material"
  | "gramaje"
  | "tintas"
  | "troquel"
  | "poses"
  | "acabado_pral"
  | "tipo_engomado"
  | "codigo_caja_embalaje"
  | "estuches_por_bulto"
  | "merma_total"
  | "horas_prep_impresion_reales"
  | "horas_tiraje_impresion_reales"
  | "horas_prep_troquelado_reales"
  | "horas_tiraje_troquelado_reales"
  | "horas_prep_engomado_reales"
  | "horas_tiraje_engomado_reales"
  | "horas_guillotina_reales"
  | "horas_desbroce_reales"
>;

/** Patch listo para UPDATE de `prod_referencias` (solo capas `_promedio`). */
export type MaestroPromediosPatch = {
  promedios_basados_en_n_ots: number;
  material_promedio: string | null;
  troquel_promedio: string | null;
  tintas_promedio: string | null;
  acabado_promedio: string | null;
  tipo_engomado_promedio: string | null;
  caja_embalaje_promedio: string | null;
  poses_promedio: number | null;
  poses_muestra_n: number | null;
  gramaje_promedio: number | null;
  gramaje_muestra_n: number | null;
  unidades_por_embalaje_promedio: number | null;
  unidades_por_embalaje_muestra_n: number | null;
  merma_promedio: number | null;
  merma_muestra_n: number | null;
  horas_prep_impresion_promedio: number | null;
  horas_prep_impresion_muestra_n: number | null;
  horas_prep_troquelado_promedio: number | null;
  horas_prep_troquelado_muestra_n: number | null;
  horas_prep_engomado_promedio: number | null;
  horas_prep_engomado_muestra_n: number | null;
  horas_millar_impresion_promedio: number | null;
  horas_millar_impresion_muestra_n: number | null;
  horas_millar_troquelado_promedio: number | null;
  horas_millar_troquelado_muestra_n: number | null;
  horas_millar_engomado_promedio: number | null;
  horas_millar_engomado_muestra_n: number | null;
  /** Mediana absoluta (no millar). */
  horas_guillotina_promedio: number | null;
  horas_guillotina_muestra_n: number | null;
  horas_desbroce_promedio: number | null;
  horas_desbroce_muestra_n: number | null;
};

export type MaestroPromediosResult = {
  referenciaId: string;
  nOts: number;
  patch: MaestroPromediosPatch;
};

function asFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asNonEmptyText(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Mediana; lista vacía → null. Empate par → media de los dos centrales. */
export function computeMedian(values: readonly number[]): number | null {
  const nums = values
    .map((v) => asFiniteNumber(v))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return round3(nums[mid]!);
  return round3((nums[mid - 1]! + nums[mid]!) / 2);
}

/**
 * Moda (valor más frecuente). Empate → el primero en orden de aparición
 * del valor empatado (estable, predecible).
 */
export function computeMode(values: readonly string[]): string | null {
  const cleaned = values
    .map((v) => asNonEmptyText(v))
    .filter((v): v is string => v != null);
  if (cleaned.length === 0) return null;

  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const v of cleaned) {
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  let best = order[0]!;
  let bestCount = counts.get(best) ?? 0;
  for (const v of order) {
    const c = counts.get(v) ?? 0;
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/** horas_millar = H × 1000 / Q (§7.1.10). */
export function computeHorasMillar(
  horasTiraje: number | null | undefined,
  cantidadPedida: number | null | undefined,
): number | null {
  const h = asFiniteNumber(horasTiraje);
  const q = asFiniteNumber(cantidadPedida);
  if (h == null || h < 0 || q == null || q <= 0) return null;
  return round3((h * 1000) / q);
}

/**
 * Deja una fila por ot_numero: la de mayor `version`
 * entre las no excluidas y con referencia.
 */
export function selectLatestProducidasForPromedios(
  rows: readonly ProducidaPromediosInput[],
): ProducidaPromediosInput[] {
  const byOt = new Map<string, ProducidaPromediosInput>();
  for (const row of rows) {
    if (row.excluido_de_promedios) continue;
    const ref = asNonEmptyText(row.referencia_id);
    const ot = asNonEmptyText(row.ot_numero);
    if (!ref || !ot) continue;
    const prev = byOt.get(ot);
    if (!prev || row.version > prev.version) {
      byOt.set(ot, row);
    }
  }
  return [...byOt.values()];
}

function medianWithN(
  values: readonly (number | null | undefined)[],
): { value: number | null; n: number | null } {
  const nums = values
    .map((v) => asFiniteNumber(v))
    .filter((v): v is number => v != null);
  if (nums.length === 0) return { value: null, n: null };
  return { value: computeMedian(nums), n: nums.length };
}

function modeOrNull(values: readonly (string | null | undefined)[]): string | null {
  const texts = values
    .map((v) => asNonEmptyText(v))
    .filter((v): v is string => v != null);
  return computeMode(texts);
}

/**
 * Calcula el patch de promedios para una referencia a partir de OTs
 * ya filtradas (latest version, no excluidas).
 */
export function computePromediosPatchForRows(
  rows: readonly ProducidaPromediosInput[],
): MaestroPromediosPatch {
  const prepImp = medianWithN(rows.map((r) => r.horas_prep_impresion_reales));
  const prepTroq = medianWithN(rows.map((r) => r.horas_prep_troquelado_reales));
  const prepEng = medianWithN(rows.map((r) => r.horas_prep_engomado_reales));

  const millarImp = medianWithN(
    rows.map((r) =>
      computeHorasMillar(r.horas_tiraje_impresion_reales, r.cantidad_pedida),
    ),
  );
  const millarTroq = medianWithN(
    rows.map((r) =>
      computeHorasMillar(r.horas_tiraje_troquelado_reales, r.cantidad_pedida),
    ),
  );
  const millarEng = medianWithN(
    rows.map((r) =>
      computeHorasMillar(r.horas_tiraje_engomado_reales, r.cantidad_pedida),
    ),
  );
  const guillotina = medianWithN(rows.map((r) => r.horas_guillotina_reales));
  const desbroce = medianWithN(rows.map((r) => r.horas_desbroce_reales));

  const poses = medianWithN(rows.map((r) => r.poses));
  const gramaje = medianWithN(rows.map((r) => r.gramaje));
  const udsEmb = medianWithN(rows.map((r) => r.estuches_por_bulto));
  const merma = medianWithN(rows.map((r) => r.merma_total));

  return {
    promedios_basados_en_n_ots: rows.length,
    material_promedio: modeOrNull(rows.map((r) => r.material)),
    troquel_promedio: modeOrNull(rows.map((r) => r.troquel)),
    tintas_promedio: modeOrNull(rows.map((r) => r.tintas)),
    acabado_promedio: modeOrNull(rows.map((r) => r.acabado_pral)),
    tipo_engomado_promedio: modeOrNull(rows.map((r) => r.tipo_engomado)),
    caja_embalaje_promedio: modeOrNull(rows.map((r) => r.codigo_caja_embalaje)),
    poses_promedio: poses.value,
    poses_muestra_n: poses.n,
    gramaje_promedio: gramaje.value,
    gramaje_muestra_n: gramaje.n,
    unidades_por_embalaje_promedio: udsEmb.value,
    unidades_por_embalaje_muestra_n: udsEmb.n,
    merma_promedio: merma.value,
    merma_muestra_n: merma.n,
    horas_prep_impresion_promedio: prepImp.value,
    horas_prep_impresion_muestra_n: prepImp.n,
    horas_prep_troquelado_promedio: prepTroq.value,
    horas_prep_troquelado_muestra_n: prepTroq.n,
    horas_prep_engomado_promedio: prepEng.value,
    horas_prep_engomado_muestra_n: prepEng.n,
    horas_millar_impresion_promedio: millarImp.value,
    horas_millar_impresion_muestra_n: millarImp.n,
    horas_millar_troquelado_promedio: millarTroq.value,
    horas_millar_troquelado_muestra_n: millarTroq.n,
    horas_millar_engomado_promedio: millarEng.value,
    horas_millar_engomado_muestra_n: millarEng.n,
    horas_guillotina_promedio: guillotina.value,
    horas_guillotina_muestra_n: guillotina.n,
    horas_desbroce_promedio: desbroce.value,
    horas_desbroce_muestra_n: desbroce.n,
  };
}

/**
 * Agrupa por referencia_id y calcula un resultado por referencia.
 * Acepta histórico crudo (aplica filtros internos).
 */
export function computePromediosByReferencia(
  rows: readonly ProducidaPromediosInput[],
): MaestroPromediosResult[] {
  const latest = selectLatestProducidasForPromedios(rows);
  const byRef = new Map<string, ProducidaPromediosInput[]>();
  for (const row of latest) {
    const ref = asNonEmptyText(row.referencia_id);
    if (!ref) continue;
    const list = byRef.get(ref) ?? [];
    list.push(row);
    byRef.set(ref, list);
  }

  const out: MaestroPromediosResult[] = [];
  for (const [referenciaId, list] of byRef) {
    out.push({
      referenciaId,
      nOts: list.length,
      patch: computePromediosPatchForRows(list),
    });
  }
  out.sort((a, b) => a.referenciaId.localeCompare(b.referenciaId));
  return out;
}

/** Una sola referencia (útil para botón «Actualizar esta»). */
export function computePromediosForReferencia(
  rows: readonly ProducidaPromediosInput[],
  referenciaId: string,
): MaestroPromediosResult | null {
  const ref = asNonEmptyText(referenciaId);
  if (!ref) return null;
  const latest = selectLatestProducidasForPromedios(rows).filter(
    (r) => asNonEmptyText(r.referencia_id) === ref,
  );
  if (latest.length === 0) {
    return {
      referenciaId: ref,
      nOts: 0,
      patch: computePromediosPatchForRows([]),
    };
  }
  return {
    referenciaId: ref,
    nOts: latest.length,
    patch: computePromediosPatchForRows(latest),
  };
}
