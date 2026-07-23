import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeOtTipo } from "@/lib/planificacion-contenedor-query";
import {
  PROCESO_CTP_ID,
  PROCESO_DESBROCE_ID,
  PROCESO_DIGITAL_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_GUILLOTINA_ID,
  PROCESO_OFFSET_ID,
  PROCESO_TROQUEL_ID,
} from "@/lib/despacho-wizard-shared";
import type { HojaRutaData, HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";

/**
 * Bloque 6 MVP — Helper de estado derivado "pendiente de revisión" + mapper
 * de columnas planas para prod_ot_producidas.
 *
 * Una OT está pendiente de revisión si:
 * 1. Es simple (ot_tipo null o 'simple') — contenedores/hijas tienen flujo distinto (Fase 8.4)
 * 2. Itinerario completo (todos los pasos en estado 'finalizado')
 * 3. Aún NO está archivada (sin fila en prod_ot_producidas)
 *
 * Esto es un estado DERIVADO; no hay columna prod_ots_general.estado_cierre en el MVP.
 */

/**
 * ¿Es esta OT "simple" (no contenedor/hija)?
 * Contenedores y hijas tienen flujo de cierre distinto (Fase 8.4).
 */
export function esOtSimple(otTipo: string | null | undefined): boolean {
  const tipo = normalizeOtTipo(otTipo);
  return tipo === null || tipo === "simple";
}

/**
 * ¿Está el itinerario completo (todos los pasos finalizados)?
 */
export function itinerarioCompleto(pasos: { estado: string | null }[]): boolean {
  if (pasos.length === 0) return false;
  return pasos.every((p) => String(p.estado ?? "").trim().toLowerCase() === "finalizado");
}

/**
 * ¿Está esta OT ya archivada en prod_ot_producidas?
 * Archivada = existe al menos una fila con reabierta_at IS NULL
 * (versiones reabiertas no cuentan como archivo activo).
 */
export async function estaOtArchivada(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("prod_ot_producidas")
    .select("id")
    .eq("ot_numero", otNumero)
    .is("reabierta_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/**
 * Última versión cerrada (mayor version) de una OT, o null.
 */
export async function fetchUltimaProducida(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<{ id: string; version: number; reabierta_at: string | null } | null> {
  const { data, error } = await supabase
    .from("prod_ot_producidas")
    .select("id, version, reabierta_at")
    .eq("ot_numero", otNumero)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Resuelve version y reabierta_desde_id para el próximo cierre.
 */
export async function resolveNextCierreVersion(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<{ version: number; reabierta_desde_id: string | null }> {
  const ultima = await fetchUltimaProducida(supabase, otNumero);
  if (!ultima) return { version: 1, reabierta_desde_id: null };
  return {
    version: ultima.version + 1,
    reabierta_desde_id: ultima.id,
  };
}

/**
 * Marca la fila como reabierta (OT vuelve a poder revisarse / recerrarse).
 * Solo la última versión no reabierta debería reabrirse.
 */
export async function reabrirOtProducida(
  supabase: SupabaseClient,
  rowId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("prod_ot_producidas")
    .update({
      reabierta_at: new Date().toISOString(),
      reabierta_por: userId,
    })
    .eq("id", rowId)
    .is("reabierta_at", null);
  if (error) throw error;
}

/**
 * Actualiza metadatos de revisión (exclusión / observaciones) sin tocar snapshot.
 */
export async function updateProducidaRevisionMeta(
  supabase: SupabaseClient,
  rowId: string,
  meta: {
    excluido_de_promedios: boolean;
    motivo_exclusion: string | null;
    observaciones_revision: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("prod_ot_producidas")
    .update({
      excluido_de_promedios: meta.excluido_de_promedios,
      motivo_exclusion: meta.excluido_de_promedios
        ? meta.motivo_exclusion
        : null,
      observaciones_revision: meta.observaciones_revision,
    })
    .eq("id", rowId);
  if (error) throw error;
}

/**
 * ¿Está esta OT pendiente de revisión (lista para cerrar)?
 * Combina las tres condiciones: simple + itinerario completo + no archivada.
 */
export async function isOtPendienteRevision(
  supabase: SupabaseClient,
  otNumero: string,
  otTipo: string | null | undefined,
  pasos: { estado: string | null }[],
): Promise<boolean> {
  if (!esOtSimple(otTipo)) return false;
  if (!itinerarioCompleto(pasos)) return false;
  const archivada = await estaOtArchivada(supabase, otNumero);
  return !archivada;
}

// ─── Mapper columnas planas ─────────────────────────────────────────────────

export type DespachoExtrasCierre = {
  referencia_id?: string | null;
  tipo_engomado?: string | null;
  /** Códigos desde prod_referencias si hay referencia_id */
  referencia_minerva?: string | null;
  referencia_cliente?: string | null;
};

export type ProdOtProducidaFlatInsert = {
  ot_numero: string;
  ot_id: string | null;
  referencia_id: string | null;
  referencia_minerva: string | null;
  referencia_cliente: string | null;
  cliente: string | null;
  trabajo: string | null;
  cantidad_pedida: number | null;
  cantidad_producida: number | null;
  material: string | null;
  gramaje: number | null;
  formato: string | null;
  tintas: string | null;
  troquel: string | null;
  poses: number | null;
  acabado_pral: string | null;
  tipo_engomado: string | null;
  codigo_caja_embalaje: string | null;
  estuches_por_bulto: number | null;
  fsc: boolean | null;
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  fecha_cierre: string;
  horas_prep_impresion_reales: number | null;
  horas_tiraje_impresion_reales: number | null;
  horas_prep_troquelado_reales: number | null;
  horas_tiraje_troquelado_reales: number | null;
  /** Siempre null hasta que Engomado separe prep/tiraje. */
  horas_prep_engomado_reales: null;
  horas_tiraje_engomado_reales: null;
  horas_guillotina_reales: number | null;
  horas_ctp_reales: number | null;
  horas_desbroce_reales: number | null;
  horas_total_reales: number | null;
  merma_total: number | null;
  snapshot: HojaRutaData;
  snapshot_version: number;
  version: number;
  cerrada_por: string;
  observaciones_revision: string | null;
  excluido_de_promedios: boolean;
  motivo_exclusion: string | null;
  reabierta_desde_id: string | null;
};

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function pasoByProceso(pasos: HojaRutaPaso[], procesoId: number): HojaRutaPaso | undefined {
  return pasos.find((p) => p.procesoId === procesoId);
}

function dp(paso: HojaRutaPaso | undefined): Record<string, unknown> | null {
  if (!paso?.datosProceso || typeof paso.datosProceso !== "object") return null;
  return paso.datosProceso as Record<string, unknown>;
}

/**
 * Cantidad producida final: preferir engomado (estuches/cantidad),
 * luego el último paso con señal positiva (ejecución o datos_proceso).
 * Cubre OTs sin engomado (p.ej. manipulado con `unidades`, troquel con hojas×poses).
 * NO tomar el primer 0 de CTP/guillotina (bug del MVP inicial).
 */
export function extractCantidadProducida(pasos: HojaRutaPaso[]): number | null {
  const eng = pasoByProceso(pasos, PROCESO_ENGOMADO_ID);
  const engDp = dp(eng);
  const fromEng =
    asNum(engDp?.estuches_engomados) ??
    asNum(engDp?.cantidad_total) ??
    asNum(eng?.ejecucion?.cantidadUnidades);
  if (fromEng != null && fromEng > 0) return fromEng;

  let lastPositive: number | null = null;
  for (const paso of pasos) {
    const d = dp(paso);
    const poses = asNum(d?.poses);
    const hojasTroq = asNum(d?.hojas_troqueladas);
    const fromHojasTroq =
      hojasTroq != null && hojasTroq > 0
        ? hojasTroq * (poses != null && poses > 0 ? poses : 1)
        : null;
    const candidates = [
      asNum(paso.ejecucion?.cantidadUnidades),
      asNum(d?.estuches_engomados),
      asNum(d?.cantidad_total),
      asNum(d?.unidades),
      fromHojasTroq,
    ];
    for (const n of candidates) {
      if (n != null && n > 0) {
        lastPositive = n;
        break;
      }
    }
  }
  return lastPositive;
}

/**
 * Construye el payload de INSERT de prod_ot_producidas desde el snapshot
 * de hoja de ruta (+ extras de despacho/referencia).
 */
export function buildProdOtProducidaInsert(args: {
  otNumero: string;
  snapshot: HojaRutaData;
  userId: string;
  despachoExtras?: DespachoExtrasCierre | null;
  observacionesRevision?: string | null;
  excluidoDePromedios?: boolean;
  motivoExclusion?: string | null;
  version?: number;
  reabiertaDesdeId?: string | null;
  nowIso?: string;
}): ProdOtProducidaFlatInsert {
  const {
    otNumero,
    snapshot,
    userId,
    despachoExtras,
    observacionesRevision = null,
    excluidoDePromedios = false,
    motivoExclusion = null,
    version = 1,
    reabiertaDesdeId = null,
  } = args;
  const nowIso = args.nowIso ?? new Date().toISOString();
  const pasos = snapshot.pasos;
  const desp = snapshot.despacho;

  const imp =
    pasoByProceso(pasos, PROCESO_OFFSET_ID) ?? pasoByProceso(pasos, PROCESO_DIGITAL_ID);
  const troq = pasoByProceso(pasos, PROCESO_TROQUEL_ID);
  const eng = pasoByProceso(pasos, PROCESO_ENGOMADO_ID);
  const ctp = pasoByProceso(pasos, PROCESO_CTP_ID);
  const guillo = pasoByProceso(pasos, PROCESO_GUILLOTINA_ID);
  const desbroce = pasoByProceso(pasos, PROCESO_DESBROCE_ID);

  const impDp = dp(imp);
  const troqDp = dp(troq);
  const engDp = dp(eng);
  const ctpDp = dp(ctp);
  const guilloDp = dp(guillo);
  const desbroceDp = dp(desbroce);

  const horasPrepImpresion = asNum(impDp?.horas_entrada_real);
  const horasTirajeImpresion = asNum(impDp?.horas_impresion_real);
  const horasPrepTroquelado = asNum(troqDp?.horas_preparacion_real);
  const horasTirajeTroquelado = asNum(troqDp?.horas_tiraje_real);
  // Engomado: NO mapear tiempo_real a tiraje (dato mezclado prep+tiraje).
  const horasCtp = asNum(ctpDp?.horas_proceso);
  const horasGuillotina = asNum(guilloDp?.horas_proceso);
  const horasDesbroce = asNum(desbroceDp?.horas_proceso);

  const partesHoras = [
    horasPrepImpresion,
    horasTirajeImpresion,
    horasPrepTroquelado,
    horasTirajeTroquelado,
    horasCtp,
    horasGuillotina,
    horasDesbroce,
    // tiempo_real engomado sí entra en total de ciclo (no en millar)
    asNum(engDp?.tiempo_real),
  ].filter((n): n is number => n != null);
  const horasTotal = partesHoras.length > 0 ? partesHoras.reduce((a, b) => a + b, 0) : null;

  const mermaImp = asNum(impDp?.hojas_merma) ?? 0;
  const mermaTroq = asNum(troqDp?.hojas_merma) ?? 0;
  const mermaTotal =
    mermaImp > 0 || mermaTroq > 0 || impDp?.hojas_merma != null || troqDp?.hojas_merma != null
      ? mermaImp + mermaTroq
      : null;

  let fechaInicio: string | null = null;
  let fechaFin: string | null = null;
  for (const paso of pasos) {
    const ini = paso.ejecucion?.inicioRealAt ?? paso.fechaInicio;
    const fin = paso.ejecucion?.finRealAt ?? paso.fechaFin;
    if (ini && (!fechaInicio || ini < fechaInicio)) fechaInicio = ini;
    if (fin && (!fechaFin || fin > fechaFin)) fechaFin = fin;
  }

  const tipoEngomado =
    asStr(despachoExtras?.tipo_engomado) ?? asStr(engDp?.tipo_engomado);
  const codigoCaja = asStr(engDp?.codigo_caja_embalaje);
  const estuchesPorBulto = asNum(engDp?.estuches_por_bulto);

  return {
    ot_numero: otNumero,
    ot_id: snapshot.otId ?? null,
    referencia_id: despachoExtras?.referencia_id ?? null,
    referencia_minerva: despachoExtras?.referencia_minerva ?? null,
    referencia_cliente: despachoExtras?.referencia_cliente ?? null,
    cliente: snapshot.cliente,
    trabajo: snapshot.trabajo,
    cantidad_pedida: snapshot.cantidad,
    cantidad_producida: extractCantidadProducida(pasos),
    material: desp?.material ?? null,
    gramaje: desp?.gramaje ?? null,
    formato: desp?.tamanoHoja ?? null,
    tintas: desp?.tintas ?? null,
    troquel: desp?.troquel ?? null,
    poses: desp?.poses ?? null,
    acabado_pral: desp?.acabadoPral ?? null,
    tipo_engomado: tipoEngomado,
    codigo_caja_embalaje: codigoCaja,
    estuches_por_bulto: estuchesPorBulto,
    fsc: null,
    fecha_inicio_real: fechaInicio,
    fecha_fin_real: fechaFin,
    fecha_cierre: nowIso,
    horas_prep_impresion_reales: horasPrepImpresion,
    horas_tiraje_impresion_reales: horasTirajeImpresion,
    horas_prep_troquelado_reales: horasPrepTroquelado,
    horas_tiraje_troquelado_reales: horasTirajeTroquelado,
    horas_prep_engomado_reales: null,
    horas_tiraje_engomado_reales: null,
    horas_guillotina_reales: horasGuillotina,
    horas_ctp_reales: horasCtp,
    horas_desbroce_reales: horasDesbroce,
    horas_total_reales: horasTotal,
    merma_total: mermaTotal,
    snapshot,
    snapshot_version: 1,
    version,
    cerrada_por: userId,
    observaciones_revision: observacionesRevision || null,
    excluido_de_promedios: excluidoDePromedios,
    motivo_exclusion: excluidoDePromedios ? motivoExclusion || null : null,
    reabierta_desde_id: reabiertaDesdeId,
  };
}

/**
 * Recalcula columnas planas desde el snapshot JSONB ya guardado
 * (útil para backfill de filas cerradas con el mapper roto).
 */
export function flatColumnsFromSnapshot(
  snapshot: HojaRutaData,
  despachoExtras?: DespachoExtrasCierre | null,
): Omit<
  ProdOtProducidaFlatInsert,
  | "snapshot"
  | "snapshot_version"
  | "version"
  | "cerrada_por"
  | "observaciones_revision"
  | "excluido_de_promedios"
  | "motivo_exclusion"
  | "ot_numero"
  | "fecha_cierre"
> {
  const built = buildProdOtProducidaInsert({
    otNumero: snapshot.otNumero,
    snapshot,
    userId: "00000000-0000-0000-0000-000000000000",
    despachoExtras,
  });
  const {
    snapshot: _s,
    snapshot_version: _sv,
    version: _v,
    cerrada_por: _c,
    observaciones_revision: _o,
    excluido_de_promedios: _e,
    motivo_exclusion: _m,
    ot_numero: _ot,
    fecha_cierre: _fc,
    ...flat
  } = built;
  return flat;
}
