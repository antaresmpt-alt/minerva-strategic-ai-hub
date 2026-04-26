import { addDays, format, startOfWeek } from "date-fns";

import type {
  CapacidadTurno,
  DayKey,
  DraftBoardState,
  MesaTrabajo,
  PoolOT,
  SlotKey,
  TurnLoad,
  TurnoKey,
} from "@/types/planificacion-mesa";

/** Capacidad teórica por turno (8h). Editable por día/turno en BD. */
export const DEFAULT_CAPACIDAD_HORAS = 8;

/** Altura mínima de tarjeta en píxeles (escalada por horas). */
export const MIN_CARD_HEIGHT_PX = 65;

/** Devuelve los días de la semana (L–V o L–S según `includeSaturday`). */
export function getWeekDays(monday: Date, includeSaturday: boolean): Date[] {
  const start = startOfWeek(monday, { weekStartsOn: 1 });
  const length = includeSaturday ? 6 : 5;
  return Array.from({ length }, (_, i) => addDays(start, i));
}

/** Lunes (00:00) de la semana que contiene `d`. */
export function getWeekMonday(d: Date): Date {
  const m = startOfWeek(d, { weekStartsOn: 1 });
  return new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, 0, 0, 0);
}

/** Convierte `Date` a `yyyy-MM-dd` (zona horaria local). */
export function toDayKey(d: Date): DayKey {
  return format(d, "yyyy-MM-dd");
}

/** Construye la clave de un slot (día + turno). */
export function slotKey(day: DayKey, turno: TurnoKey): SlotKey {
  return `${day}::${turno}`;
}

/** Parsea un slotKey de vuelta a `{day, turno}`. Devuelve null si no es válido. */
export function parseSlotKey(key: string): { day: DayKey; turno: TurnoKey } | null {
  const [day, turno] = key.split("::");
  if (!day || (turno !== "manana" && turno !== "tarde")) return null;
  return { day, turno };
}

/** Suma de horas planificadas de un turno. */
export function sumTurnHoras(items: MesaTrabajo[]): number {
  return items.reduce(
    (acc, it) =>
      acc + (Number.isFinite(it.horasPlanificadasSnapshot) ? it.horasPlanificadasSnapshot : 0),
    0,
  );
}

/** Calcula carga de turno con capacidad explícita (default 8h si <=0). */
export function computeTurnLoad(
  items: MesaTrabajo[],
  capacityHoras: number,
): TurnLoad {
  const cap = capacityHoras > 0 ? capacityHoras : DEFAULT_CAPACIDAD_HORAS;
  const total = sumTurnHoras(items);
  const pct = cap > 0 ? (total / cap) * 100 : 0;
  let bucket: TurnLoad["bucket"] = "verde";
  if (pct > 100) bucket = "rojo";
  else if (pct >= 80) bucket = "naranja";
  return { totalHoras: total, capacidadHoras: cap, pct, bucket };
}

/** Reasigna `slot_orden` correlativo (1..n) preservando el orden actual. */
export function recomputeSlotOrden(items: MesaTrabajo[]): MesaTrabajo[] {
  return items.map((it, idx) => ({ ...it, slotOrden: idx + 1 }));
}

/** Detecta enlaces visuales: posición `i` indica si comparte acabado_pral con i+1. */
export function detectAdjacentLinks(items: MesaTrabajo[]): boolean[] {
  const flags: boolean[] = [];
  for (let i = 0; i < items.length - 1; i += 1) {
    const a = (items[i]?.acabadoPralSnapshot ?? "").trim().toLowerCase();
    const b = (items[i + 1]?.acabadoPralSnapshot ?? "").trim().toLowerCase();
    flags.push(a !== "" && a === b);
  }
  return flags;
}

/** Construye un MesaTrabajo (sin id) a partir de una OT del Pool al soltarla. */
export function buildMesaFromPool(
  pool: PoolOT,
  fecha: DayKey,
  turno: TurnoKey,
  slotOrden: number,
  maquinaId?: string | null,
): Omit<MesaTrabajo, "id"> {
  return {
    maquinaId: maquinaId ?? null,
    ot: pool.ot,
    fechaPlanificada: fecha,
    turno,
    slotOrden,
    estadoMesa: "borrador",
    fechaEntrega: pool.fechaEntrega,
    materialStatus: pool.materialStatus,
    troquelStatus: pool.troquelStatus,
    acabadoPralSnapshot: pool.acabadoPral,
    clienteSnapshot: pool.cliente,
    papelSnapshot: pool.papel,
    tintasSnapshot: pool.tintas,
    barnizSnapshot: pool.barniz,
    numHojasBrutasSnapshot: pool.numHojasBrutas,
    horasPlanificadasSnapshot: pool.horasPlanificadas,
  };
}

/** Mapea capacidades de BD a un map por slotKey. */
export function buildCapacityMap(
  capacidades: CapacidadTurno[],
): Record<SlotKey, number> {
  const out: Record<SlotKey, number> = {};
  for (const c of capacidades) {
    out[slotKey(c.fecha, c.turno)] = c.capacidadHoras;
  }
  return out;
}

/** Obtiene capacidad de un slot (default 8h). */
export function getCapacityForSlot(
  capMap: Record<SlotKey, number>,
  day: DayKey,
  turno: TurnoKey,
): number {
  const v = capMap[slotKey(day, turno)];
  return typeof v === "number" && v >= 0 ? v : DEFAULT_CAPACIDAD_HORAS;
}

/** Altura escalada de la tarjeta (mínimo 65px, +10px por hora). */
export function cardHeightPx(horas: number): number {
  const safe = Number.isFinite(horas) && horas > 0 ? horas : 0;
  return Math.max(MIN_CARD_HEIGHT_PX, Math.round(MIN_CARD_HEIGHT_PX + safe * 10));
}

/** Color visual para un barniz (lógico por palabras clave). */
export function barnizBadgeClass(barniz: string | null | undefined): string {
  const t = (barniz ?? "").trim().toLowerCase();
  if (!t) return "bg-slate-100 text-slate-700 border border-slate-200";
  if (t.includes("uv") && t.includes("brillo"))
    return "bg-yellow-100 text-yellow-900 border border-yellow-300";
  if (t.includes("uv")) return "bg-amber-100 text-amber-900 border border-amber-300";
  if (t.includes("acril") && t.includes("mate"))
    return "bg-violet-100 text-violet-900 border border-violet-300";
  if (t.includes("acril")) return "bg-violet-50 text-violet-800 border border-violet-200";
  if (t.includes("brillo")) return "bg-orange-100 text-orange-900 border border-orange-300";
  if (t.includes("mate")) return "bg-slate-200 text-slate-800 border border-slate-300";
  return "bg-emerald-50 text-emerald-800 border border-emerald-200";
}

/** Color de la barra de carga según bucket. */
export function loadBarClass(bucket: TurnLoad["bucket"]): string {
  if (bucket === "rojo") return "bg-red-500";
  if (bucket === "naranja") return "bg-amber-500";
  return "bg-emerald-500";
}
export function loadTextClass(bucket: TurnLoad["bucket"]): string {
  if (bucket === "rojo") return "text-red-700";
  if (bucket === "naranja") return "text-amber-700";
  return "text-emerald-700";
}

/** Genera todas las claves de slots visibles en una semana. */
export function getVisibleSlotKeys(days: Date[]): SlotKey[] {
  const out: SlotKey[] = [];
  for (const d of days) {
    const dk = toDayKey(d);
    out.push(slotKey(dk, "manana"));
    out.push(slotKey(dk, "tarde"));
  }
  return out;
}

/** Empaqueta el draft para localStorage. */
export function serializeDraft(draft: DraftBoardState): string {
  return JSON.stringify(draft);
}

/** Lee el draft desde una cadena, devolviendo null si está corrupto o caducado. */
export function deserializeDraft(raw: string): DraftBoardState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DraftBoardState>;
    if (
      !parsed ||
      typeof parsed.weekMondayKey !== "string" ||
      typeof parsed.maquinaId !== "string" ||
      parsed.scope !== "impresion" ||
      typeof parsed.updatedAt !== "string" ||
      !parsed.bySlot ||
      typeof parsed.bySlot !== "object"
    ) {
      return null;
    }
    return parsed as DraftBoardState;
  } catch {
    return null;
  }
}

/** Storage key por usuario para el draft de simulación. */
export function getDraftStorageKey(userId: string | null | undefined): string {
  return `minerva_plan_draft_${userId ?? "anon"}`;
}

/** Aplana `bySlot` a una lista lineal (útil para upserts). */
export function flattenBoard(
  bySlot: Record<SlotKey, MesaTrabajo[]>,
): MesaTrabajo[] {
  const out: MesaTrabajo[] = [];
  for (const k of Object.keys(bySlot)) {
    const list = bySlot[k] ?? [];
    for (const it of list) out.push(it);
  }
  return out;
}

export const DEFAULT_PLANIFICACION_IA_SETTINGS = {
  pesoTintas: 80,
  pesoCmyk: 55,
  pesoBarniz: 70,
  pesoPapel: 65,
  pesoFechaEntrega: 50,
  pesoBalanceCarga: 35,
  promptBase:
    "Prioriza minimizar cambios de tintas/Pantones, barnices/acabados y papel; respeta OTs en ejecución; conserva capacidad de turno y fecha de entrega.",
};
