import type { ProdCalendarioProduccionOtRow } from "@/types/prod-calendario-produccion-ot";
import {
  CALENDARIO_AMBITO_LETRA,
  isCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
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
  ambito: CalendarioAmbito;
  /** Texto corto en celda: OT · trabajo */
  label: string;
  trabajo: string | null;
  orden: number;
  /** Marca manual «hecho» (Carlos; transición). */
  marcadoHecho: boolean;
  /**
   * Visual / filtro «Solo pendientes»:
   * marca manual **o** paso(s) del ámbito finalizados en HR.
   * Se rellena con `enrichEntradasHechoVisual`.
   */
  hechoVisual?: boolean;
};

/** Hecho para UI/PDF/filtro: checkbox Carlos o semáforo HR «hecho». */
export function pastillaHechaVisual(
  marcadoHecho: boolean,
  semaforo: string | null | undefined,
): boolean {
  return Boolean(marcadoHecho) || semaforo === "hecho";
}

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
  ambito?: CalendarioAmbito | null,
): string {
  const ot = String(otNumero ?? "").trim() || "—";
  const letra =
    ambito && isCalendarioAmbito(ambito) ? `${CALENDARIO_AMBITO_LETRA[ambito]}·` : "";
  return `${letra}${ot} · ${truncateTrabajo(trabajo)}`;
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
    const ambito: CalendarioAmbito = isCalendarioAmbito(r.ambito)
      ? r.ambito
      : "impresion";
    const trabajo = tituloByOt.get(ot) ?? null;
    const list = map.get(key) ?? [];
    list.push({
      id: r.id,
      otNumero: ot,
      ambito,
      label: labelCalendarioProduccionOt(ot, trabajo, ambito),
      trabajo,
      orden: r.orden,
      marcadoHecho: Boolean(r.marcado_hecho),
    });
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const o = a.orden - b.orden;
      if (o !== 0) return o;
      if (a.ambito !== b.ambito) return a.ambito.localeCompare(b.ambito);
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

/** Si `soloPendientes`, oculta pastillas hechas (manual o HR del ámbito). */
export function filtrarEntradasSoloPendientes(
  byDay: Map<string, CalendarioProduccionLinea[]>,
  soloPendientes: boolean,
): Map<string, CalendarioProduccionLinea[]> {
  if (!soloPendientes) return byDay;
  const out = new Map<string, CalendarioProduccionLinea[]>();
  for (const [ymd, list] of byDay) {
    const filtered = list.filter((l) => !l.hechoVisual && !l.marcadoHecho);
    if (filtered.length > 0) out.set(ymd, filtered);
  }
  return out;
}

/** Pastillas con fecha &lt; hoy y no hechas (cajón Atrasadas). */
export type CalendarioAtrasadaItem = CalendarioProduccionLinea & {
  fechaYmd: string;
};

export function collectEntradasAtrasadas(
  byDay: Map<string, CalendarioProduccionLinea[]>,
  hoyYmd: string,
): CalendarioAtrasadaItem[] {
  const hoy = String(hoyYmd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return [];
  const out: CalendarioAtrasadaItem[] = [];
  for (const [ymd, list] of byDay) {
    if (ymd >= hoy) continue;
    for (const l of list) {
      if (l.hechoVisual || l.marcadoHecho) continue;
      out.push({ ...l, fechaYmd: ymd });
    }
  }
  out.sort((a, b) => {
    if (a.fechaYmd !== b.fechaYmd) return a.fechaYmd.localeCompare(b.fechaYmd);
    if (a.ambito !== b.ambito) return a.ambito.localeCompare(b.ambito);
    return a.otNumero.localeCompare(b.otNumero, "es", { numeric: true });
  });
  return out;
}

/**
 * Rellena `hechoVisual` = marca manual **o** semáforo del ámbito = hecho (HR).
 * Llamar antes de filtrar «Solo pendientes» y de pintar/exportar.
 */
export function enrichEntradasHechoVisual(
  byDay: Map<string, CalendarioProduccionLinea[]>,
  semaforoOf: (otNumero: string, ambito: CalendarioAmbito) => string,
): Map<string, CalendarioProduccionLinea[]> {
  const out = new Map<string, CalendarioProduccionLinea[]>();
  for (const [ymd, list] of byDay) {
    out.set(
      ymd,
      list.map((l) => ({
        ...l,
        hechoVisual: pastillaHechaVisual(
          l.marcadoHecho,
          semaforoOf(l.otNumero, l.ambito),
        ),
      })),
    );
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
