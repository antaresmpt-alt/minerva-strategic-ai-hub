/**
 * Helpers para la **Mesa diaria** (vista 1 día × N máquinas).
 *
 * Diferencias con la mesa semanal:
 *  - El día es fijo (uno solo), por lo que la dimensión variable es la
 *    **máquina**.
 *  - Las claves de slot incluyen `maquinaId` en lugar de día:
 *      `${maquinaId}::${turno}`.
 *  - Los container ids para `@dnd-kit` usan el prefijo `dailyslot::`.
 *
 * El modelo de datos en BD (`prod_mesa_planificacion_trabajos`) es el mismo;
 * solo cambia cómo agrupamos en memoria/UI.
 */
import type {
  DayKey,
  MesaTrabajo,
  TurnoKey,
} from "@/types/planificacion-mesa";

/** `${maquinaId}::${turno}` (clave plana de un slot de la mesa diaria). */
export type DailySlotKey = string;

/** Construye la clave de un slot diario (máquina + turno). */
export function dailySlotKey(maquinaId: string, turno: TurnoKey): DailySlotKey {
  return `${maquinaId}::${turno}`;
}

/** Parsea un `DailySlotKey` en sus partes. Devuelve `null` si no es válido. */
export function parseDailySlotKey(
  key: string,
): { maquinaId: string; turno: TurnoKey } | null {
  const idx = key.lastIndexOf("::");
  if (idx <= 0 || idx === key.length - 2) return null;
  const maquinaId = key.slice(0, idx);
  const turnoRaw = key.slice(idx + 2);
  if (turnoRaw !== "manana" && turnoRaw !== "tarde") return null;
  if (!maquinaId) return null;
  return { maquinaId, turno: turnoRaw };
}

/** Container id estable para `@dnd-kit` (zona droppable). */
export function dailyContainerId(
  maquinaId: string,
  turno: TurnoKey,
): string {
  return `dailyslot::${dailySlotKey(maquinaId, turno)}`;
}

/** Parsea un container id `dailyslot::M::T` en sus partes. */
export function parseDailyContainerId(
  containerId: string,
): { maquinaId: string; turno: TurnoKey } | null {
  if (!containerId.startsWith("dailyslot::")) return null;
  return parseDailySlotKey(containerId.slice("dailyslot::".length));
}

/** Lista de claves visibles dado un set de máquinas. */
export function getVisibleDailySlotKeys(
  maquinaIds: readonly string[],
): DailySlotKey[] {
  const out: DailySlotKey[] = [];
  for (const m of maquinaIds) {
    out.push(dailySlotKey(m, "manana"));
    out.push(dailySlotKey(m, "tarde"));
  }
  return out;
}

/**
 * Agrupa una lista plana de `MesaTrabajo` por `DailySlotKey`. Filtra los items
 * que no pertenecen al día indicado o cuya `maquinaId` no está en la lista.
 *
 * Los items se ordenan por `slotOrden` ascendente dentro de cada slot.
 */
export function groupMesaItemsByDailySlot(
  items: readonly MesaTrabajo[],
  dayKey: DayKey,
  maquinaIds: readonly string[],
): Record<DailySlotKey, MesaTrabajo[]> {
  const allowed = new Set(maquinaIds);
  const out: Record<DailySlotKey, MesaTrabajo[]> = {};
  for (const m of maquinaIds) {
    out[dailySlotKey(m, "manana")] = [];
    out[dailySlotKey(m, "tarde")] = [];
  }
  for (const it of items) {
    if (it.fechaPlanificada !== dayKey) continue;
    const mid = (it.maquinaId ?? "").trim();
    if (!mid || !allowed.has(mid)) continue;
    const k = dailySlotKey(mid, it.turno);
    if (!out[k]) out[k] = [];
    out[k]!.push(it);
  }
  for (const k of Object.keys(out)) {
    out[k]!.sort((a, b) => a.slotOrden - b.slotOrden);
  }
  return out;
}

/** Aplana `bySlot` a una lista lineal (útil para upserts). */
export function flattenDailyBoard(
  bySlot: Record<DailySlotKey, MesaTrabajo[]>,
): MesaTrabajo[] {
  const out: MesaTrabajo[] = [];
  for (const k of Object.keys(bySlot)) {
    const list = bySlot[k] ?? [];
    for (const it of list) out.push(it);
  }
  return out;
}

/** Storage key (per-user) para el set de columnas ocultas. */
export function getDailyHiddenMaquinasStorageKey(
  userId: string | null | undefined,
): string {
  return `minerva_plan_daily_hidden_maquinas_${userId ?? "anon"}`;
}

/** Storage key para la última pestaña visitada en Planificación OTs. */
export function getPlanificacionLastTabStorageKey(
  userId: string | null | undefined,
): string {
  return `minerva_plan_last_tab_${userId ?? "anon"}`;
}
