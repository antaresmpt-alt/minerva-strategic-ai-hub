/**
 * Konica / troqueladora / numeradora: booleanos + fechas de fin para calendario mensual.
 * Calendario futuro: I-{ot} ← fecha_fin_konica, T-{ot} ← fecha_fin_troqueladora, N-{ot} ← fecha_fin_numeradora.
 */

import { todayYmdLocal } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

export type MaquinaHojaRutaField = "konica" | "troqueladora" | "numeradora";

const FECHA_BY_MAQUINA: Record<
  MaquinaHojaRutaField,
  keyof Pick<
    ProdEtiquetasHojaRutaRow,
    "fecha_fin_konica" | "fecha_fin_troqueladora" | "fecha_fin_numeradora"
  >
> = {
  konica: "fecha_fin_konica",
  troqueladora: "fecha_fin_troqueladora",
  numeradora: "fecha_fin_numeradora",
};

export type MaquinaPatchExtras = {
  /**
   * Metros de impresión Konica (numeric, ≥ 0). Solo se aplica cuando
   * `field === "konica" && checked === true`. Pásalo como `null` para
   * indicar "omitir" (campo queda en null), o como número para guardarlo.
   * Si se desmarca Konica, el patch fuerza `metros_impresion = null`
   * independientemente de este parámetro.
   */
  metros_impresion?: number | null;
};

export type MaquinaPatch = Pick<
  ProdEtiquetasHojaRutaRow,
  | MaquinaHojaRutaField
  | "fecha_fin_konica"
  | "fecha_fin_troqueladora"
  | "fecha_fin_numeradora"
> &
  Partial<Pick<ProdEtiquetasHojaRutaRow, "metros_impresion">>;

export function buildMaquinaPatch(
  field: MaquinaHojaRutaField,
  checked: boolean,
  extras: MaquinaPatchExtras = {}
): MaquinaPatch {
  const fechaKey = FECHA_BY_MAQUINA[field];
  const today = todayYmdLocal();
  const base = {
    [field]: checked,
    [fechaKey]: checked ? today : null,
  } as MaquinaPatch;

  if (field === "konica") {
    if (!checked) {
      base.metros_impresion = null;
    } else if ("metros_impresion" in extras) {
      base.metros_impresion = extras.metros_impresion ?? null;
    }
  }
  return base;
}

export function mergeMaquinaIntoRow(
  row: ProdEtiquetasHojaRutaRow,
  field: MaquinaHojaRutaField,
  checked: boolean,
  extras: MaquinaPatchExtras = {}
): ProdEtiquetasHojaRutaRow {
  return { ...row, ...buildMaquinaPatch(field, checked, extras) };
}

export type MaquinaFieldsSavePick = Pick<
  ProdEtiquetasHojaRutaRow,
  | "konica"
  | "troqueladora"
  | "numeradora"
  | "fecha_fin_konica"
  | "fecha_fin_troqueladora"
  | "fecha_fin_numeradora"
  | "metros_impresion"
>;

/** Guardar desde formulario con fechas editables (calendario I/T/N) + metros Konica. */
export function buildMaquinaFieldsForSaveFromForm(
  konica: boolean,
  troqueladora: boolean,
  numeradora: boolean,
  fechas: {
    fecha_fin_konica: string;
    fecha_fin_troqueladora: string;
    fecha_fin_numeradora: string;
  },
  metrosImpresion?: number | null
): MaquinaFieldsSavePick {
  const today = todayYmdLocal();
  const fin = (on: boolean, raw: string) => {
    if (!on) return null;
    const t = raw.trim();
    return t ? t.slice(0, 10) : today;
  };
  return {
    konica,
    troqueladora,
    numeradora,
    fecha_fin_konica: fin(konica, fechas.fecha_fin_konica),
    fecha_fin_troqueladora: fin(troqueladora, fechas.fecha_fin_troqueladora),
    fecha_fin_numeradora: fin(numeradora, fechas.fecha_fin_numeradora),
    metros_impresion: konica ? (metrosImpresion ?? null) : null,
  };
}

/** Patch al guardar formulario (respeta fecha si ya existía y solo se mantiene el check). */
export function buildMaquinaFieldsForSave(
  konica: boolean,
  troqueladora: boolean,
  numeradora: boolean,
  existing: Pick<
    ProdEtiquetasHojaRutaRow,
    | "fecha_fin_konica"
    | "fecha_fin_troqueladora"
    | "fecha_fin_numeradora"
    | "metros_impresion"
  >
): MaquinaFieldsSavePick {
  const today = todayYmdLocal();
  const fin = (on: boolean, prev: string | null) =>
    on ? (prev?.trim() ? prev.slice(0, 10) : today) : null;
  return {
    konica,
    troqueladora,
    numeradora,
    fecha_fin_konica: fin(konica, existing.fecha_fin_konica),
    fecha_fin_troqueladora: fin(troqueladora, existing.fecha_fin_troqueladora),
    fecha_fin_numeradora: fin(numeradora, existing.fecha_fin_numeradora),
    metros_impresion: konica ? (existing.metros_impresion ?? null) : null,
  };
}
