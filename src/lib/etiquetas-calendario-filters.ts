import type { CalendarioEventoAuto, CalendarioMaquinaTipo } from "@/lib/etiquetas-calendario-mensual";
import type { ProdEtiquetasCalendarioApunteRow } from "@/types/prod-etiquetas-calendario-apunte";

export type CalendarioFiltros = {
  showI: boolean;
  showT: boolean;
  showN: boolean;
  showApuntes: boolean;
  /** Dígitos de OT (ej. 35572); vacío = sin filtro. */
  otSearch: string;
};

export const CALENDARIO_FILTROS_DEFAULT: CalendarioFiltros = {
  showI: true,
  showT: true,
  showN: true,
  showApuntes: true,
  otSearch: "",
};

export function normalizeOtSearchDigits(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").trim();
}

export function eventoPasaFiltro(
  ev: CalendarioEventoAuto,
  filtros: CalendarioFiltros
): boolean {
  if (ev.tipo === "I" && !filtros.showI) return false;
  if (ev.tipo === "T" && !filtros.showT) return false;
  if (ev.tipo === "N" && !filtros.showN) return false;
  const q = normalizeOtSearchDigits(filtros.otSearch);
  if (q) {
    const ot = normalizeOtSearchDigits(ev.otNumero);
    if (!ot.includes(q)) return false;
  }
  return true;
}

export function filtrarEventos(
  eventos: CalendarioEventoAuto[],
  filtros: CalendarioFiltros
): CalendarioEventoAuto[] {
  return eventos.filter((ev) => eventoPasaFiltro(ev, filtros));
}

export function filtrarEventosMap(
  map: Map<string, CalendarioEventoAuto[]>,
  filtros: CalendarioFiltros
): Map<string, CalendarioEventoAuto[]> {
  const out = new Map<string, CalendarioEventoAuto[]>();
  for (const [ymd, list] of map) {
    const f = filtrarEventos(list, filtros);
    if (f.length > 0) out.set(ymd, f);
  }
  return out;
}

export function filtrarApuntesMap(
  map: Map<string, ProdEtiquetasCalendarioApunteRow[]>,
  filtros: CalendarioFiltros
): Map<string, ProdEtiquetasCalendarioApunteRow[]> {
  if (!filtros.showApuntes) return new Map();
  const q = normalizeOtSearchDigits(filtros.otSearch);
  if (!q) return map;
  const out = new Map<string, ProdEtiquetasCalendarioApunteRow[]>();
  for (const [ymd, list] of map) {
    const f = list.filter((a) =>
      normalizeOtSearchDigits(a.texto).includes(q)
    );
    if (f.length > 0) out.set(ymd, f);
  }
  return out;
}

export function labelFiltrosCalendario(f: CalendarioFiltros): string {
  const parts: string[] = [];
  if (f.showI) parts.push("I");
  if (f.showT) parts.push("T");
  if (f.showN) parts.push("N");
  if (f.showApuntes) parts.push("Apuntes");
  const tipos = parts.length ? parts.join(", ") : "Ningún tipo";
  const ot = f.otSearch.trim();
  return ot ? `${tipos} · OT contiene «${ot}»` : tipos;
}

export type CalendarioResumenMes = {
  totalI: number;
  totalT: number;
  totalN: number;
  totalApuntes: number;
  diasConActividad: number;
  diaMaxYmd: string | null;
  diaMaxTotal: number;
  festivosEnMes: number;
  diasLaborablesGrid: number;
};

export function buildCalendarioResumenMes(
  eventosMap: Map<string, CalendarioEventoAuto[]>,
  apuntesMap: Map<string, ProdEtiquetasCalendarioApunteRow[]>,
  filtros: CalendarioFiltros,
  opts: { festivosEnMes: number; diasLaborablesGrid: number }
): CalendarioResumenMes {
  let totalI = 0;
  let totalT = 0;
  let totalN = 0;
  let totalApuntes = 0;
  const porDia = new Map<string, number>();

  const bump = (ymd: string, tipo?: CalendarioMaquinaTipo) => {
    porDia.set(ymd, (porDia.get(ymd) ?? 0) + 1);
    if (tipo === "I") totalI += 1;
    else if (tipo === "T") totalT += 1;
    else if (tipo === "N") totalN += 1;
  };

  for (const [ymd, list] of eventosMap) {
    for (const ev of filtrarEventos(list, filtros)) {
      bump(ymd, ev.tipo);
    }
  }

  if (filtros.showApuntes) {
    const q = normalizeOtSearchDigits(filtros.otSearch);
    for (const [ymd, list] of apuntesMap) {
      const ap =
        q != null && q.length > 0
          ? list.filter((a) => normalizeOtSearchDigits(a.texto).includes(q))
          : list;
      for (const _ of ap) {
        bump(ymd);
        totalApuntes += 1;
      }
    }
  }

  let diaMaxYmd: string | null = null;
  let diaMaxTotal = 0;
  for (const [ymd, n] of porDia) {
    if (n > diaMaxTotal) {
      diaMaxTotal = n;
      diaMaxYmd = ymd;
    }
  }

  return {
    totalI,
    totalT,
    totalN,
    totalApuntes,
    diasConActividad: porDia.size,
    diaMaxYmd,
    diaMaxTotal,
    festivosEnMes: opts.festivosEnMes,
    diasLaborablesGrid: opts.diasLaborablesGrid,
  };
}
