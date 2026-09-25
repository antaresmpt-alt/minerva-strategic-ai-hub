/**
 * Sesiones «Hoy» por proceso I/T/N en hoja de ruta de etiquetas.
 * I/T/N (boolean + fecha_fin_*) = proceso cerrado.
 * Sesión = día trabajado sin cerrar (calendario multi-día).
 */

import type { MaquinaHojaRutaField } from "@/lib/etiquetas-hoja-ruta-maquina";
import { todayYmdLocal } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type {
  EtiquetasSesionProceso,
  ProdEtiquetasHojaRutaSesionRow,
} from "@/types/prod-etiquetas-hoja-ruta-sesion";

export const SESIONES_TABLE = "prod_etiquetas_hoja_ruta_sesiones" as const;

export const PROCESO_BY_MAQUINA: Record<
  MaquinaHojaRutaField,
  EtiquetasSesionProceso
> = {
  konica: "I",
  troqueladora: "T",
  numeradora: "N",
};

export const MAQUINA_BY_PROCESO: Record<
  EtiquetasSesionProceso,
  MaquinaHojaRutaField
> = {
  I: "konica",
  T: "troqueladora",
  N: "numeradora",
};

export const FECHA_FIN_BY_PROCESO: Record<
  EtiquetasSesionProceso,
  keyof Pick<
    ProdEtiquetasHojaRutaRow,
    "fecha_fin_konica" | "fecha_fin_troqueladora" | "fecha_fin_numeradora"
  >
> = {
  I: "fecha_fin_konica",
  T: "fecha_fin_troqueladora",
  N: "fecha_fin_numeradora",
};

export const DONE_BY_PROCESO: Record<
  EtiquetasSesionProceso,
  keyof Pick<ProdEtiquetasHojaRutaRow, "konica" | "troqueladora" | "numeradora">
> = {
  I: "konica",
  T: "troqueladora",
  N: "numeradora",
};

function ymdKey(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function sesionKey(
  hojaRutaId: string,
  proceso: EtiquetasSesionProceso,
  fecha: string
): string {
  return `${hojaRutaId}|${proceso}|${fecha.slice(0, 10)}`;
}

/** Índice: hoja_ruta_id → sesiones */
export function indexSesionesByHoja(
  sesiones: ProdEtiquetasHojaRutaSesionRow[]
): Map<string, ProdEtiquetasHojaRutaSesionRow[]> {
  const map = new Map<string, ProdEtiquetasHojaRutaSesionRow[]>();
  for (const s of sesiones) {
    const list = map.get(s.hoja_ruta_id) ?? [];
    list.push(s);
    map.set(s.hoja_ruta_id, list);
  }
  return map;
}

/** Índice rápido por clave hoja|proceso|fecha */
export function indexSesionesByKey(
  sesiones: ProdEtiquetasHojaRutaSesionRow[]
): Map<string, ProdEtiquetasHojaRutaSesionRow> {
  const map = new Map<string, ProdEtiquetasHojaRutaSesionRow>();
  for (const s of sesiones) {
    const f = ymdKey(s.fecha);
    if (!f) continue;
    map.set(sesionKey(s.hoja_ruta_id, s.proceso, f), s);
  }
  return map;
}

export function hasSesionHoy(
  byKey: Map<string, ProdEtiquetasHojaRutaSesionRow>,
  hojaRutaId: string,
  proceso: EtiquetasSesionProceso,
  hoy: string = todayYmdLocal()
): boolean {
  return byKey.has(sesionKey(hojaRutaId, proceso, hoy));
}

export function getSesionHoy(
  byKey: Map<string, ProdEtiquetasHojaRutaSesionRow>,
  hojaRutaId: string,
  proceso: EtiquetasSesionProceso,
  hoy: string = todayYmdLocal()
): ProdEtiquetasHojaRutaSesionRow | undefined {
  return byKey.get(sesionKey(hojaRutaId, proceso, hoy));
}

export function sesionesDeProceso(
  sesiones: ProdEtiquetasHojaRutaSesionRow[] | undefined,
  proceso: EtiquetasSesionProceso
): ProdEtiquetasHojaRutaSesionRow[] {
  if (!sesiones?.length) return [];
  return sesiones.filter((s) => s.proceso === proceso);
}

/**
 * Proceso «en curso» / multi-día: hay al menos una sesión y aún no está cerrado,
 * O hay sesiones en más de un día distinto (aunque ya esté cerrado).
 */
export function procesoEsMultiDiaOEnCurso(
  row: Pick<
    ProdEtiquetasHojaRutaRow,
    | "konica"
    | "troqueladora"
    | "numeradora"
    | "fecha_fin_konica"
    | "fecha_fin_troqueladora"
    | "fecha_fin_numeradora"
  >,
  proceso: EtiquetasSesionProceso,
  sesiones: ProdEtiquetasHojaRutaSesionRow[] | undefined
): boolean {
  const delProc = sesionesDeProceso(sesiones, proceso);
  if (delProc.length === 0) return false;

  const done = Boolean(row[DONE_BY_PROCESO[proceso]]);
  if (!done) return true;

  const dias = new Set<string>();
  for (const s of delProc) {
    const f = ymdKey(s.fecha);
    if (f) dias.add(f);
  }
  const fin = ymdKey(row[FECHA_FIN_BY_PROCESO[proceso]]);
  if (fin) dias.add(fin);
  return dias.size > 1;
}

/** Fila con algún proceso en curso / multi-día (para tintar la fila). */
export function filaTieneProcesoEnCursoOMultiDia(
  row: Pick<
    ProdEtiquetasHojaRutaRow,
    | "konica"
    | "troqueladora"
    | "numeradora"
    | "fecha_fin_konica"
    | "fecha_fin_troqueladora"
    | "fecha_fin_numeradora"
  >,
  sesiones: ProdEtiquetasHojaRutaSesionRow[] | undefined
): boolean {
  return (["I", "T", "N"] as const).some((p) =>
    procesoEsMultiDiaOEnCurso(row, p, sesiones)
  );
}

/** OT tocada hoy (cualquier proceso con sesión hoy). */
export function hojaTocadaHoy(
  hojaRutaId: string,
  byKey: Map<string, ProdEtiquetasHojaRutaSesionRow>,
  hoy: string = todayYmdLocal()
): boolean {
  return (["I", "T", "N"] as const).some((p) =>
    byKey.has(sesionKey(hojaRutaId, p, hoy))
  );
}
