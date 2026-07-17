import type { ProdCalendarioProduccionOtRow } from "@/types/prod-calendario-produccion-ot";

export {
  buildSemanasLaboralesMes,
  countDiasLaborablesEnGrid,
  diasLaborablesCabecera,
  fechaDiaLabel,
  mesAnioLabel,
  monthRangeYmd,
  numColumnasCalendario,
  splitLineasDosColumnas,
  ymdFromParts,
} from "@/lib/etiquetas-calendario-mensual";

export type CalendarioProduccionLinea = {
  id: string;
  otNumero: string;
  /** Texto corto en celda: OT · trabajo */
  label: string;
  trabajo: string | null;
  orden: number;
};

function ymdKey(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function truncateTrabajo(raw: string | null | undefined, max = 42): string {
  const t = String(raw ?? "").trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function labelCalendarioProduccionOt(
  otNumero: string,
  trabajo: string | null | undefined,
): string {
  const ot = String(otNumero ?? "").trim() || "—";
  return `${ot} · ${truncateTrabajo(trabajo)}`;
}

export function entradasPorDia(
  rows: ProdCalendarioProduccionOtRow[],
  tituloByOt: Map<string, string | null>,
): Map<string, CalendarioProduccionLinea[]> {
  const map = new Map<string, CalendarioProduccionLinea[]>();
  for (const r of rows) {
    const key = ymdKey(r.fecha);
    if (!key) continue;
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const trabajo = tituloByOt.get(ot) ?? null;
    const list = map.get(key) ?? [];
    list.push({
      id: r.id,
      otNumero: ot,
      label: labelCalendarioProduccionOt(ot, trabajo),
      trabajo,
      orden: r.orden,
    });
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const o = a.orden - b.orden;
      if (o !== 0) return o;
      return a.otNumero.localeCompare(b.otNumero, "es", { numeric: true });
    });
  }
  return map;
}

export function filtrarEntradasPorTexto(
  byDay: Map<string, CalendarioProduccionLinea[]>,
  q: string,
): Map<string, CalendarioProduccionLinea[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return byDay;
  const out = new Map<string, CalendarioProduccionLinea[]>();
  for (const [ymd, list] of byDay) {
    const filtered = list.filter(
      (l) =>
        l.otNumero.toLowerCase().includes(needle) ||
        (l.trabajo ?? "").toLowerCase().includes(needle) ||
        l.label.toLowerCase().includes(needle),
    );
    if (filtered.length > 0) out.set(ymd, filtered);
  }
  return out;
}
