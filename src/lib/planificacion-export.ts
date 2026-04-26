/**
 * planificacion-export.ts
 *
 * Tipos compartidos, normalización y resolución de fuente para los exportadores
 * de la Mesa de Secuenciación de Impresión (PDF, Excel).
 *
 * No depende de React ni de APIs del navegador: puede usarse tanto en client
 * components como en API routes.
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";

import type {
  CapacidadTurno,
  DayKey,
  MesaTrabajo,
  SlotKey,
  TurnoKey,
} from "@/types/planificacion-mesa";

// ============================================================
// Tipos públicos
// ============================================================

export type ExportFuente = "oficial" | "borrador" | "visible_actual";
export type ExportFormato = "diario" | "semanal";
export type ExportSalida = "pdf" | "excel";
export type ExportTurno = "ambos" | "manana" | "tarde";

export interface ExportMeta {
  maquinaNombre: string;
  maquinaId: string;
  weekMondayKey: DayKey;
  /** yyyy-MM-dd si formato=diario */
  dayKey: DayKey | null;
  turno: ExportTurno;
  fuente: ExportFuente;
  /** Si fuente=oficial pero no había confirmados, se usó borrador como fallback */
  fuenteFallback: boolean;
  generadoPor: string;
  generadoAt: string;
  /** Plan ID legible para humanos */
  planId: string;
  scope: "impresion";
}

export interface PrintRow {
  fecha: DayKey;
  turnoLabel: string;
  turnoKey: TurnoKey;
  orden: number;
  ot: string;
  cliente: string;
  clienteTrabajo: string;
  tintas: string;
  barniz: string;
  papel: string;
  hojas: number;
  horas: number;
  /** Capacidad del turno en horas */
  capacidad: number;
}

export interface PrintBlock {
  fecha: DayKey;
  /** "Lunes 21 abr" */
  fechaLabel: string;
  turno: TurnoKey;
  turnoLabel: string;
  rows: PrintRow[];
  totalHoras: number;
  capacidadHoras: number;
  pctCarga: number;
}

export interface PrintPayload {
  meta: ExportMeta;
  blocks: PrintBlock[];
  totalHorasGlobal: number;
  totalCapacidadGlobal: number;
}

// ============================================================
// Helpers internos
// ============================================================

function dash(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s || "—";
}

function num(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? (v as number) : 0;
}

/** Genera plan_version corto: base36 del timestamp en segundos */
export function buildPlanVersion(
  maquinaId: string,
  weekMonday: DayKey,
  fuente: ExportFuente,
): string {
  const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  const mq = maquinaId.slice(0, 4).toUpperCase();
  const wk = weekMonday.replace(/-/g, "").slice(2);
  const src = fuente === "oficial" ? "O" : fuente === "borrador" ? "B" : "V";
  return `${src}${wk}${mq}${ts}`;
}

/** Plan ID legible para imprimir en papel */
export function buildPlanId(
  maquinaNombre: string,
  dayKey: DayKey | null,
  weekMondayKey: DayKey,
  turno: ExportTurno,
  version: string,
): string {
  const ref = (dayKey ?? weekMondayKey).replace(/-/g, "");
  const mq = maquinaNombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12)
    .toUpperCase();
  const t = turno === "ambos" ? "AM-PM" : turno === "manana" ? "AM" : "PM";
  return `IMP-${mq}-${ref}-${t}-${version}`;
}

const TURNO_LABELS: Record<TurnoKey, string> = {
  manana: "Mañana",
  tarde: "Tarde",
};

const MESES_ES: Record<string, string> = {
  Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun",
  Jul: "jul", Aug: "ago", Sep: "sep", Oct: "oct", Nov: "nov", Dec: "dic",
};

function fechaLabel(dayKey: DayKey): string {
  const d = new Date(dayKey + "T12:00:00");
  const diaNum = d.getDate();
  const mes = format(d, "MMM", { locale: es });
  const dia = format(d, "EEEE", { locale: es });
  return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${diaNum} ${MESES_ES[mes] ?? mes}`;
}

function capacidadForSlot(
  caps: CapacidadTurno[],
  fecha: DayKey,
  turno: TurnoKey,
  defaultCap = 8,
): number {
  const c = caps.find((x) => x.fecha === fecha && x.turno === turno);
  return c?.capacidadHoras ?? defaultCap;
}

// ============================================================
// Resolución de fuente
// ============================================================

/**
 * Dada la fuente seleccionada, filtra bySlot y devuelve los items a exportar,
 * además de si hubo fallback (oficial -> borrador).
 */
export function resolveSource(opts: {
  fuente: ExportFuente;
  realBySlot: Record<SlotKey, MesaTrabajo[]>;
  draftBySlot: Record<SlotKey, MesaTrabajo[]> | null;
  simulationOn: boolean;
}): { bySlot: Record<SlotKey, MesaTrabajo[]>; fuenteFallback: boolean } {
  const { fuente, realBySlot, draftBySlot, simulationOn } = opts;

  if (fuente === "visible_actual") {
    const src = simulationOn && draftBySlot ? draftBySlot : realBySlot;
    return { bySlot: src, fuenteFallback: false };
  }

  if (fuente === "borrador") {
    const out: Record<SlotKey, MesaTrabajo[]> = {};
    for (const [sk, items] of Object.entries(realBySlot)) {
      out[sk] = items.filter((it) => it.estadoMesa === "borrador");
    }
    return { bySlot: out, fuenteFallback: false };
  }

  // oficial: confirmado | en_ejecucion, con fallback a borrador
  const oficial: Record<SlotKey, MesaTrabajo[]> = {};
  const borrador: Record<SlotKey, MesaTrabajo[]> = {};
  let hasOficial = false;

  for (const [sk, items] of Object.entries(realBySlot)) {
    oficial[sk] = items.filter(
      (it) => it.estadoMesa === "confirmado" || it.estadoMesa === "en_ejecucion",
    );
    borrador[sk] = items.filter((it) => it.estadoMesa === "borrador");
    if (oficial[sk]!.length > 0) hasOficial = true;
  }

  if (hasOficial) return { bySlot: oficial, fuenteFallback: false };
  return { bySlot: borrador, fuenteFallback: true };
}

// ============================================================
// Construcción del payload de impresión
// ============================================================

/**
 * Punto de entrada principal. Normaliza datos y devuelve `PrintPayload`
 * listo para consumir por el generador PDF o Excel.
 */
export function buildPrintPayload(opts: {
  fuente: ExportFuente;
  formato: ExportFormato;
  turno: ExportTurno;
  dayKey: DayKey | null;
  weekMondayKey: DayKey;
  visibleDayKeys: DayKey[];
  realBySlot: Record<SlotKey, MesaTrabajo[]>;
  draftBySlot: Record<SlotKey, MesaTrabajo[]> | null;
  simulationOn: boolean;
  capacidades: CapacidadTurno[];
  maquinaId: string;
  maquinaNombre: string;
  generadoPor: string;
  trabajoByOt?: Record<string, string>;
  defaultCapacidad?: number;
}): PrintPayload {
  const {
    fuente, formato, turno, dayKey, weekMondayKey, visibleDayKeys,
    realBySlot, draftBySlot, simulationOn, capacidades,
    maquinaId, maquinaNombre, generadoPor, trabajoByOt = {}, defaultCapacidad = 8,
  } = opts;

  const { bySlot, fuenteFallback } = resolveSource({
    fuente, realBySlot, draftBySlot, simulationOn,
  });

  // Fechas a incluir
  const targetDays =
    formato === "diario" && dayKey
      ? [dayKey]
      : visibleDayKeys;

  const turnos: TurnoKey[] =
    turno === "ambos"
      ? ["manana", "tarde"]
      : [turno as TurnoKey];

  const generadoAt = new Date().toISOString();
  const version = buildPlanVersion(maquinaId, weekMondayKey, fuente);
  const planId = buildPlanId(maquinaNombre, dayKey, weekMondayKey, turno, version);

  const meta: ExportMeta = {
    maquinaNombre,
    maquinaId,
    weekMondayKey,
    dayKey,
    turno,
    fuente,
    fuenteFallback,
    generadoPor,
    generadoAt,
    planId,
    scope: "impresion",
  };

  const blocks: PrintBlock[] = [];

  for (const fecha of targetDays) {
    for (const t of turnos) {
      const sk: SlotKey = `${fecha}::${t}`;
      const items = (bySlot[sk] ?? []).slice().sort((a, b) => a.slotOrden - b.slotOrden);
      const cap = capacidadForSlot(capacidades, fecha, t, defaultCapacidad);

      const rows: PrintRow[] = items.map((it) => ({
        // Se prioriza snapshot cliente + nombre de trabajo externo por OT.
        // Si no hay trabajo disponible, mostramos solo cliente.
        // Esto evita joins extra para la exportación MVP.
        ...(() => {
          const cliente = dash(it.clienteSnapshot);
          const trabajo = dash(trabajoByOt[it.ot]);
          return {
            cliente,
            clienteTrabajo: trabajo === "—" ? cliente : `${cliente} / ${trabajo}`,
          };
        })(),
        fecha,
        turnoLabel: TURNO_LABELS[t],
        turnoKey: t,
        orden: it.slotOrden,
        ot: it.ot,
        tintas: dash(it.tintasSnapshot),
        barniz: (() => {
          const barniz = dash(it.barnizSnapshot);
          const acabado = dash(it.acabadoPralSnapshot);
          if (barniz !== "—" && acabado !== "—" && barniz !== acabado) {
            return `${barniz} · ${acabado}`;
          }
          if (barniz !== "—") return barniz;
          if (acabado !== "—") return acabado;
          return "—";
        })(),
        papel: dash(it.papelSnapshot),
        hojas: Math.trunc(num(it.numHojasBrutasSnapshot)),
        horas: num(it.horasPlanificadasSnapshot),
        capacidad: cap,
      }));

      const totalHoras = rows.reduce((s, r) => s + r.horas, 0);
      const pctCarga = cap > 0 ? Math.round((totalHoras / cap) * 100) : 0;

      blocks.push({
        fecha,
        fechaLabel: fechaLabel(fecha),
        turno: t,
        turnoLabel: TURNO_LABELS[t],
        rows,
        totalHoras,
        capacidadHoras: cap,
        pctCarga,
      });
    }
  }

  const totalHorasGlobal = blocks.reduce((s, b) => s + b.totalHoras, 0);
  const totalCapacidadGlobal = blocks.reduce((s, b) => s + b.capacidadHoras, 0);

  return { meta, blocks, totalHorasGlobal, totalCapacidadGlobal };
}
