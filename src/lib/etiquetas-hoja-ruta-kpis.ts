import { entregaPlazoSemaforo, todayYmdLocal } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

export type EtiquetasHojaRutaKpis = {
  metrosHoy: number;
  metrosMes: number;
  colaKonica: number;
  plazoCritico: number;
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

/** Cantidad de etiquetas de la OT en hoja de ruta (campo `cantidad`). */
export function cantidadEtiquetasKpi(
  cantidad: number | null | undefined
): number | null {
  if (cantidad == null) return null;
  const qty = Number(cantidad);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return qty;
}

/** KPIs globales (todas las filas cargadas), no dependen de filtros de tabla. */
export function buildEtiquetasHojaRutaKpis(
  rows: ProdEtiquetasHojaRutaRow[]
): EtiquetasHojaRutaKpis {
  const today = todayYmdLocal();
  const { start: mesInicio, end: mesFin } = currentMonthRangeYmd();

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

    const mts =
      r.metros_impresion != null && Number.isFinite(Number(r.metros_impresion))
        ? Number(r.metros_impresion)
        : null;
    if (mts != null && mts >= 0) {
      if (fk === today) metrosHoy += mts;
      if (fk >= mesInicio && fk <= mesFin) metrosMes += mts;
    }
  }

  return {
    metrosHoy,
    metrosMes,
    colaKonica,
    plazoCritico,
  };
}
