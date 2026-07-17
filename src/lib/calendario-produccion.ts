import type { ProdCalendarioProduccionOtRow } from "@/types/prod-calendario-produccion-ot";
import { ymdFromParts } from "@/lib/etiquetas-calendario-mensual";

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

/** Lunes de la semana laboral (Lun–Dom) que contiene `d`. */
export function mondayOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  const dow = x.getDay(); // 0=dom
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + delta);
  return x;
}

function ymdFromDate(d: Date): string {
  return ymdFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}

export function weekRangeYmd(
  weekMonday: Date,
  includeSaturday: boolean,
): { start: string; end: string } {
  const end = new Date(weekMonday);
  end.setDate(end.getDate() + (includeSaturday ? 5 : 4));
  return { start: ymdFromDate(weekMonday), end: ymdFromDate(end) };
}

export function buildSemanaLaboral(
  weekMonday: Date,
  opts?: { includeSaturday?: boolean },
): Array<{ ymd: string; dayNum: number } | null> {
  const includeSaturday = opts?.includeSaturday ?? false;
  const n = includeSaturday ? 6 : 5;
  const out: Array<{ ymd: string; dayNum: number } | null> = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + i);
    out.push({ ymd: ymdFromDate(d), dayNum: d.getDate() });
  }
  return out;
}

export function semanaLabelEs(weekMonday: Date, includeSaturday: boolean): string {
  const end = new Date(weekMonday);
  end.setDate(end.getDate() + (includeSaturday ? 5 : 4));
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(weekMonday)} – ${fmt(end)} ${weekMonday.getFullYear()}`;
}
