import type { ProdEtiquetasCalendarioApunteRow } from "@/types/prod-etiquetas-calendario-apunte";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

export type CalendarioMaquinaTipo = "I" | "T" | "N";

export type CalendarioEventoAuto = {
  tipo: CalendarioMaquinaTipo;
  otNumero: string;
  label: string;
  hojaRutaId: string;
};

export type CalendarioDiaCelda = {
  ymd: string;
  dayNum: number;
};

export type CalendarioSemanaLaboral = (
  | CalendarioDiaCelda
  | null
)[];

const DIAS_LABORABLES = ["Lun", "Mar", "Mié", "Jue", "Vie"] as const;
const DIA_SABADO = "Sáb" as const;

export { DIAS_LABORABLES };

export function diasLaborablesCabecera(
  includeSaturday: boolean
): readonly string[] {
  return includeSaturday ? [...DIAS_LABORABLES, DIA_SABADO] : DIAS_LABORABLES;
}

export function numColumnasCalendario(includeSaturday: boolean): number {
  return includeSaturday ? 6 : 5;
}

function emptySemana(cols: number): CalendarioSemanaLaboral {
  return Array.from({ length: cols }, () => null);
}

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function mesAnioLabel(year: number, monthIndex: number): string {
  return `${MESES_ES[monthIndex]} ${year}`;
}

export function fechaDiaLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Reparte líneas en dos columnas cuando hay muchas entradas. */
export function splitLineasDosColumnas<T>(items: T[]): {
  left: T[];
  right: T[];
} {
  if (items.length < 4) {
    return { left: items, right: [] };
  }
  const mid = Math.ceil(items.length / 2);
  return { left: items.slice(0, mid), right: items.slice(mid) };
}

export function ymdFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthRangeYmd(
  year: number,
  monthIndex: number
): { start: string; end: string } {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return {
    start: ymdFromParts(year, monthIndex, 1),
    end: ymdFromParts(year, monthIndex, last),
  };
}

/** Formato papel: 35572 → 35.572 */
export function formatOtCalendario(otNumero: string): string {
  const raw = String(otNumero ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `${digits.slice(0, -3)}.${digits.slice(-3)}`;
  }
  return raw;
}

export function labelEventoAuto(tipo: CalendarioMaquinaTipo, otNumero: string): string {
  return `${tipo}-${formatOtCalendario(otNumero)}`;
}

function ymdKey(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

const TIPO_ORDER: Record<CalendarioMaquinaTipo, number> = { I: 0, T: 1, N: 2 };

export function eventosAutoPorDiaDesdeHojaRuta(
  rows: Pick<
    ProdEtiquetasHojaRutaRow,
    | "id"
    | "ot_numero"
    | "fecha_fin_konica"
    | "fecha_fin_troqueladora"
    | "fecha_fin_numeradora"
  >[]
): Map<string, CalendarioEventoAuto[]> {
  const map = new Map<string, CalendarioEventoAuto[]>();

  const push = (ymd: string | null, ev: CalendarioEventoAuto) => {
    if (!ymd) return;
    const list = map.get(ymd) ?? [];
    if (list.some((x) => x.tipo === ev.tipo && x.otNumero === ev.otNumero)) return;
    list.push(ev);
    map.set(ymd, list);
  };

  for (const r of rows) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const base = { otNumero: ot, hojaRutaId: r.id };
    const fk = ymdKey(r.fecha_fin_konica);
    if (fk) {
      push(fk, {
        ...base,
        tipo: "I",
        label: labelEventoAuto("I", ot),
      });
    }
    const ft = ymdKey(r.fecha_fin_troqueladora);
    if (ft) {
      push(ft, {
        ...base,
        tipo: "T",
        label: labelEventoAuto("T", ot),
      });
    }
    const fn = ymdKey(r.fecha_fin_numeradora);
    if (fn) {
      push(fn, {
        ...base,
        tipo: "N",
        label: labelEventoAuto("N", ot),
      });
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      const ta = TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo];
      if (ta !== 0) return ta;
      return a.otNumero.localeCompare(b.otNumero, "es", { numeric: true });
    });
  }

  return map;
}

export function apuntesPorDia(
  apuntes: ProdEtiquetasCalendarioApunteRow[]
): Map<string, ProdEtiquetasCalendarioApunteRow[]> {
  const map = new Map<string, ProdEtiquetasCalendarioApunteRow[]>();
  for (const a of apuntes) {
    const key = ymdKey(a.fecha);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const o = a.orden - b.orden;
      if (o !== 0) return o;
      return a.created_at.localeCompare(b.created_at);
    });
  }
  return map;
}

/** Cuadrícula lun–vie (opcional sáb) por semanas (estilo planning en papel). */
export function buildSemanasLaboralesMes(
  year: number,
  monthIndex: number,
  options?: { includeSaturday?: boolean }
): CalendarioSemanaLaboral[] {
  const includeSaturday = options?.includeSaturday ?? false;
  const cols = numColumnasCalendario(includeSaturday);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const semanas: CalendarioSemanaLaboral[] = [];
  let semana: CalendarioSemanaLaboral = emptySemana(cols);

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, monthIndex, d, 12, 0, 0);
    const dow = date.getDay();
    if (dow === 0) continue;
    if (dow === 6 && !includeSaturday) continue;
    const col = dow - 1;
    if (col === 0 && semana.some((c) => c != null)) {
      semanas.push(semana);
      semana = emptySemana(cols);
    }
    semana[col] = { ymd: ymdFromParts(year, monthIndex, d), dayNum: d };
  }
  if (semana.some((c) => c != null)) {
    semanas.push(semana);
  }
  return semanas;
}

export function countDiasLaborablesEnGrid(
  semanas: CalendarioSemanaLaboral[]
): number {
  let n = 0;
  for (const semana of semanas) {
    for (const dia of semana) {
      if (dia) n += 1;
    }
  }
  return n;
}

export function filasHojaRutaEnMes(
  rows: Pick<
    ProdEtiquetasHojaRutaRow,
    | "id"
    | "ot_numero"
    | "fecha_fin_konica"
    | "fecha_fin_troqueladora"
    | "fecha_fin_numeradora"
  >[],
  start: string,
  end: string
): typeof rows {
  return rows.filter((r) => {
    const fechas = [
      ymdKey(r.fecha_fin_konica),
      ymdKey(r.fecha_fin_troqueladora),
      ymdKey(r.fecha_fin_numeradora),
    ];
    return fechas.some((f) => f != null && f >= start && f <= end);
  });
}
