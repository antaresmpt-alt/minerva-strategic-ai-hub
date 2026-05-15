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

export function buildMaquinaPatch(
  field: MaquinaHojaRutaField,
  checked: boolean
): Pick<
  ProdEtiquetasHojaRutaRow,
  MaquinaHojaRutaField | "fecha_fin_konica" | "fecha_fin_troqueladora" | "fecha_fin_numeradora"
> {
  const fechaKey = FECHA_BY_MAQUINA[field];
  const today = todayYmdLocal();
  return {
    [field]: checked,
    [fechaKey]: checked ? today : null,
  } as Pick<
    ProdEtiquetasHojaRutaRow,
    MaquinaHojaRutaField | "fecha_fin_konica" | "fecha_fin_troqueladora" | "fecha_fin_numeradora"
  >;
}

export function mergeMaquinaIntoRow(
  row: ProdEtiquetasHojaRutaRow,
  field: MaquinaHojaRutaField,
  checked: boolean
): ProdEtiquetasHojaRutaRow {
  return { ...row, ...buildMaquinaPatch(field, checked) };
}

/** Patch al guardar formulario (respeta fecha si ya existía y solo se mantiene el check). */
export function buildMaquinaFieldsForSave(
  konica: boolean,
  troqueladora: boolean,
  numeradora: boolean,
  existing: Pick<
    ProdEtiquetasHojaRutaRow,
    "fecha_fin_konica" | "fecha_fin_troqueladora" | "fecha_fin_numeradora"
  >
): Pick<
  ProdEtiquetasHojaRutaRow,
  | "konica"
  | "troqueladora"
  | "numeradora"
  | "fecha_fin_konica"
  | "fecha_fin_troqueladora"
  | "fecha_fin_numeradora"
> {
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
  };
}
