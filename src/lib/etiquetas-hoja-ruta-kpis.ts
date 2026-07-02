import { entregaPlazoSemaforo, todayYmdLocal } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

export type EtiquetasHojaRutaKpis = {
  metrosHoy: number;
  metrosMes: number;
  colaKonica: number;
  plazoCritico: number;
  /** Etiquetas opcionales cuando el periodo de metros no es el mes en curso. */
  metrosHoyLabel?: string;
  metrosMesLabel?: string;
};

function ymdKey(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function currentMonthRangeYmd(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(last)}`,
  };
}

export function formatEtiquetasKpi(n: number): string {
  return n.toLocaleString("es-ES");
}

export function formatMetrosKpi(n: number): string {
  return `${n.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} m`;
}

function readMetrosImpresion(
  r: ProdEtiquetasHojaRutaRow
): number | null {
  if (
    r.metros_impresion != null &&
    Number.isFinite(Number(r.metros_impresion))
  ) {
    const mts = Number(r.metros_impresion);
    return mts >= 0 ? mts : null;
  }
  return null;
}

/** Suma metros Konica con fecha de impresión en el rango [start, end] (YYYY-MM-DD). */
export function sumMetrosKonicaInYmdRange(
  rows: ProdEtiquetasHojaRutaRow[],
  start: string,
  end: string
): number {
  let total = 0;
  for (const r of rows) {
    if (!r.konica) continue;
    const fk = ymdKey(r.fecha_fin_konica);
    if (fk == null || fk < start || fk > end) continue;
    const mts = readMetrosImpresion(r);
    if (mts != null) total += mts;
  }
  return total;
}

export function sumMetrosKonicaOnDay(
  rows: ProdEtiquetasHojaRutaRow[],
  dayYmd: string
): number {
  return sumMetrosKonicaInYmdRange(rows, dayYmd, dayYmd);
}

/** Cantidad de etiquetas de la OT en hoja de ruta (campo `cantidad`). */
export function cantidadEtiquetasKpi(
  cantidad: number | null | undefined
): number | null {
  if (cantidad == null) return null;
  const qty = Number(cantidad);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return qty;
}

/** KPIs globales (cola/plazo) + metros según periodo. */
export function buildEtiquetasHojaRutaKpis(
  rows: ProdEtiquetasHojaRutaRow[],
  options?: {
    /** Si se indica, `metrosMes` suma Konica en este rango (p. ej. exportación mes anterior). */
    metrosRange?: { start: string; end: string };
  }
): EtiquetasHojaRutaKpis {
  const today = todayYmdLocal();
  const mesRange = options?.metrosRange ?? currentMonthRangeYmd();

  let metrosHoy = 0;
  let metrosMes = 0;
  let colaKonica = 0;
  let plazoCritico = 0;

  for (const r of rows) {
    if (!r.finalizado && !r.konica) colaKonica += 1;
    if (!r.finalizado && entregaPlazoSemaforo(r.fecha_entrega_ot) === "rojo") {
      plazoCritico += 1;
    }

    if (!r.konica) continue;
    const fk = ymdKey(r.fecha_fin_konica);
    if (fk == null) continue;

    const mts = readMetrosImpresion(r);
    if (mts == null) continue;

    if (options?.metrosRange) {
      if (fk >= mesRange.start && fk <= mesRange.end) metrosMes += mts;
      if (fk === today && today >= mesRange.start && today <= mesRange.end) {
        metrosHoy += mts;
      }
    } else {
      if (fk === today) metrosHoy += mts;
      if (fk >= mesRange.start && fk <= mesRange.end) metrosMes += mts;
    }
  }

  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${mesRange.start}T12:00:00`));

  return {
    metrosHoy,
    metrosMes,
    colaKonica,
    plazoCritico,
    ...(options?.metrosRange
      ? {
          metrosHoyLabel: "Metros hoy (en periodo)",
          metrosMesLabel: `Metros Konica (${monthName})`,
        }
      : {
          metrosMesLabel: "Metros este mes",
        }),
  };
}
