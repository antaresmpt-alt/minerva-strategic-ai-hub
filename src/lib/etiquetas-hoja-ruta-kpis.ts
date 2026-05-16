import { entregaPlazoSemaforo, todayYmdLocal } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

export type EtiquetasHojaRutaKpis = {
  etiquetasHoy: number;
  etiquetasMes: number;
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

/** KPIs globales (todas las filas cargadas), no dependen de filtros de tabla. */
export function buildEtiquetasHojaRutaKpis(
  rows: ProdEtiquetasHojaRutaRow[]
): EtiquetasHojaRutaKpis {
  const today = todayYmdLocal();
  const { start: mesInicio, end: mesFin } = currentMonthRangeYmd();

  let etiquetasHoy = 0;
  let etiquetasMes = 0;
  let colaKonica = 0;
  let plazoCritico = 0;

  for (const r of rows) {
    if (!r.finalizado && !r.konica) colaKonica += 1;
    if (!r.finalizado && entregaPlazoSemaforo(r.fecha_entrega_ot) === "rojo") {
      plazoCritico += 1;
    }

    if (!r.konica) continue;
    const fk = ymdKey(r.fecha_fin_konica);
    if (fk == null || r.etiquetas == null) continue;

    const qty = r.etiquetas;
    if (fk === today) etiquetasHoy += qty;
    if (fk >= mesInicio && fk <= mesFin) etiquetasMes += qty;
  }

  return { etiquetasHoy, etiquetasMes, colaKonica, plazoCritico };
}
