/**
 * Bloque 11 fase 3 — orden fino del día (tabla ligera, no mesa LEGACY).
 * Fecha siempre vía pastilla `prod_calendario_produccion_ot` (sin columna duplicada).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import type {
  CalendarioDetalleDiaTurno,
  ProdCalendarioDetalleDiaRow,
} from "@/types/prod-calendario-detalle-dia";

export const TABLE_CALENDARIO_DETALLE_DIA = "prod_calendario_detalle_dia";
export const TABLE_CALENDARIO_OT = "prod_calendario_produccion_ot";

const SELECT_DETALLE =
  "id, calendario_ot_id, ambito, ot_numero, maquina_id, turno, slot_orden, horas_planificadas_snapshot, notas, created_by, created_at, updated_at";

/** `prod_maquinas.tipo_maquina` alineado con ámbito calendario. */
export function tipoMaquinaForCalendarioAmbito(
  ambito: CalendarioAmbito,
): string {
  return ambito;
}

export type CalendarioDetalleMaquina = {
  id: string;
  nombre: string;
  tipo_maquina: string;
};

/** Slot en borrador local (antes de Guardar). */
export type DetalleDiaDraftSlot = {
  calendarioOtId: string;
  otNumero: string;
  turno: CalendarioDetalleDiaTurno;
  slotOrden: number;
};

export async function fetchMaquinasForAmbito(
  supabase: SupabaseClient,
  ambito: CalendarioAmbito,
): Promise<CalendarioDetalleMaquina[]> {
  const tipo = tipoMaquinaForCalendarioAmbito(ambito);
  const { data, error } = await supabase
    .from("prod_maquinas")
    .select("id, nombre, tipo_maquina")
    .eq("tipo_maquina", tipo)
    .eq("activa", true)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre ?? "").trim() || "—",
    tipo_maquina: String(r.tipo_maquina ?? "").trim(),
  }));
}

export async function fetchDetalleDiaByCalendarioOtIds(
  supabase: SupabaseClient,
  calendarioOtIds: readonly string[],
): Promise<ProdCalendarioDetalleDiaRow[]> {
  const ids = [
    ...new Set(
      calendarioOtIds.map((x) => String(x ?? "").trim()).filter(Boolean),
    ),
  ];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE_CALENDARIO_DETALLE_DIA)
    .select(SELECT_DETALLE)
    .in("calendario_ot_id", ids)
    .order("slot_orden", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProdCalendarioDetalleDiaRow[];
}

/**
 * Detalle del día por fecha (join a pastilla — sin columna fecha en detalle).
 */
export async function fetchDetalleDiaByFechaAmbito(
  supabase: SupabaseClient,
  fechaYmd: string,
  ambito: CalendarioAmbito,
): Promise<ProdCalendarioDetalleDiaRow[]> {
  const ymd = String(fechaYmd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return [];

  const { data: pastillas, error: pErr } = await supabase
    .from(TABLE_CALENDARIO_OT)
    .select("id")
    .eq("fecha", ymd)
    .eq("ambito", ambito);
  if (pErr) throw pErr;
  const ids = (pastillas ?? []).map((r) => String(r.id));
  return fetchDetalleDiaByCalendarioOtIds(supabase, ids);
}

/** OT → menor slot_orden del plan de ese día/ámbito (cualquier máquina/turno). */
export async function fetchPlanHoySlotByOt(
  supabase: SupabaseClient,
  fechaYmd: string,
  ambito: CalendarioAmbito,
): Promise<Map<string, number>> {
  const rows = await fetchDetalleDiaByFechaAmbito(supabase, fechaYmd, ambito);
  const map = new Map<string, number>();
  for (const r of rows) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const prev = map.get(ot);
    if (prev == null || r.slot_orden < prev) map.set(ot, r.slot_orden);
  }
  return map;
}

/**
 * Orden contenedor: planificadas hoy (por slot) arriba; resto por fecha entrega.
 */
export function compareConPlanHoy<
  T extends { otNumero: string; fechaEntrega: string | null },
>(a: T, b: T, slotByOt: Map<string, number>): number {
  const sa = slotByOt.get(a.otNumero);
  const sb = slotByOt.get(b.otNumero);
  const aPlan = sa != null;
  const bPlan = sb != null;
  if (aPlan && !bPlan) return -1;
  if (!aPlan && bPlan) return 1;
  if (aPlan && bPlan && sa !== sb) return sa! - sb!;
  const fa = a.fechaEntrega ?? "9999-12-31";
  const fb = b.fechaEntrega ?? "9999-12-31";
  if (fa !== fb) return fa.localeCompare(fb);
  return a.otNumero.localeCompare(b.otNumero, "es", { numeric: true });
}

export type UpsertDetalleDiaInput = {
  calendarioOtId: string;
  ambito: CalendarioAmbito;
  otNumero: string;
  maquinaId: string | null;
  turno: CalendarioDetalleDiaTurno | null;
  slotOrden: number;
  horasPlanificadasSnapshot?: number | null;
  notas?: string | null;
  createdBy?: string | null;
};

export async function upsertDetalleDiaSlot(
  supabase: SupabaseClient,
  input: UpsertDetalleDiaInput,
): Promise<ProdCalendarioDetalleDiaRow> {
  const row = {
    calendario_ot_id: input.calendarioOtId,
    ambito: input.ambito,
    ot_numero: String(input.otNumero).trim(),
    maquina_id: input.maquinaId,
    turno: input.turno,
    slot_orden: Math.max(1, Math.trunc(input.slotOrden)),
    horas_planificadas_snapshot: input.horasPlanificadasSnapshot ?? null,
    notas: input.notas ?? null,
    created_by: input.createdBy ?? null,
  };
  const { data, error } = await supabase
    .from(TABLE_CALENDARIO_DETALLE_DIA)
    .upsert(row, { onConflict: "calendario_ot_id" })
    .select(SELECT_DETALLE)
    .single();
  if (error) throw error;
  return data as ProdCalendarioDetalleDiaRow;
}

export async function deleteDetalleDiaByCalendarioOtId(
  supabase: SupabaseClient,
  calendarioOtId: string,
): Promise<void> {
  const id = String(calendarioOtId ?? "").trim();
  if (!id) return;
  const { error } = await supabase
    .from(TABLE_CALENDARIO_DETALLE_DIA)
    .delete()
    .eq("calendario_ot_id", id);
  if (error) throw error;
}

/** Reasigna slot_orden 1..n y persiste (misma máquina/turno). */
export async function persistDetalleDiaOrden(
  supabase: SupabaseClient,
  ordered: readonly {
    calendarioOtId: string;
    ambito: CalendarioAmbito;
    otNumero: string;
    maquinaId: string | null;
    turno: CalendarioDetalleDiaTurno | null;
  }[],
  createdBy?: string | null,
): Promise<void> {
  for (let i = 0; i < ordered.length; i++) {
    const it = ordered[i]!;
    await upsertDetalleDiaSlot(supabase, {
      calendarioOtId: it.calendarioOtId,
      ambito: it.ambito,
      otNumero: it.otNumero,
      maquinaId: it.maquinaId,
      turno: it.turno,
      slotOrden: i + 1,
      createdBy,
    });
  }
}

/**
 * Guarda draft completo de una máquina: upsert mañana+tarde y borra slots
 * de esa máquina que ya no están en el draft.
 */
export async function saveDetalleDiaDraftForMaquina(
  supabase: SupabaseClient,
  args: {
    ambito: CalendarioAmbito;
    maquinaId: string;
    draft: readonly DetalleDiaDraftSlot[];
    previousRowsForMaquina: readonly ProdCalendarioDetalleDiaRow[];
    createdBy?: string | null;
  },
): Promise<void> {
  const keep = new Set(args.draft.map((d) => d.calendarioOtId));
  for (const prev of args.previousRowsForMaquina) {
    if ((prev.maquina_id ?? "") !== args.maquinaId) continue;
    if (!keep.has(prev.calendario_ot_id)) {
      await deleteDetalleDiaByCalendarioOtId(supabase, prev.calendario_ot_id);
    }
  }
  const manana = args.draft
    .filter((d) => d.turno === "manana")
    .sort((a, b) => a.slotOrden - b.slotOrden);
  const tarde = args.draft
    .filter((d) => d.turno === "tarde")
    .sort((a, b) => a.slotOrden - b.slotOrden);
  await persistDetalleDiaOrden(
    supabase,
    manana.map((d) => ({
      calendarioOtId: d.calendarioOtId,
      ambito: args.ambito,
      otNumero: d.otNumero,
      maquinaId: args.maquinaId,
      turno: "manana" as const,
    })),
    args.createdBy,
  );
  await persistDetalleDiaOrden(
    supabase,
    tarde.map((d) => ({
      calendarioOtId: d.calendarioOtId,
      ambito: args.ambito,
      otNumero: d.otNumero,
      maquinaId: args.maquinaId,
      turno: "tarde" as const,
    })),
    args.createdBy,
  );
}

/** Sincroniza `orden` de pastillas del día con la secuencia (mañana luego tarde). */
export async function syncCalendarioOrdenFromDraft(
  supabase: SupabaseClient,
  draft: readonly DetalleDiaDraftSlot[],
  unsequencedIds: readonly string[],
): Promise<void> {
  const ordered = [
    ...draft
      .filter((d) => d.turno === "manana")
      .sort((a, b) => a.slotOrden - b.slotOrden),
    ...draft
      .filter((d) => d.turno === "tarde")
      .sort((a, b) => a.slotOrden - b.slotOrden),
  ];
  let i = 0;
  for (const d of ordered) {
    const { error } = await supabase
      .from(TABLE_CALENDARIO_OT)
      .update({ orden: i })
      .eq("id", d.calendarioOtId);
    if (error) throw error;
    i += 1;
  }
  for (const id of unsequencedIds) {
    const { error } = await supabase
      .from(TABLE_CALENDARIO_OT)
      .update({ orden: i })
      .eq("id", id);
    if (error) throw error;
    i += 1;
  }
}

/**
 * Tras mover pastilla a otro día: colocar slot al final de la secuencia
 * destino (misma máquina/turno si existía; si no, mañana + 1ª máquina del ámbito).
 */
export async function appendDetalleSlotAfterCalendarMove(
  supabase: SupabaseClient,
  args: {
    calendarioOtId: string;
    otNumero: string;
    ambito: CalendarioAmbito;
    fechaDestinoYmd: string;
    createdBy?: string | null;
  },
): Promise<void> {
  const existing = (
    await fetchDetalleDiaByCalendarioOtIds(supabase, [args.calendarioOtId])
  )[0];
  if (!existing) return;

  const maquinaId = existing.maquina_id;
  const turno: CalendarioDetalleDiaTurno =
    existing.turno === "tarde" ? "tarde" : "manana";
  if (!maquinaId) return;

  const dayRows = await fetchDetalleDiaByFechaAmbito(
    supabase,
    args.fechaDestinoYmd,
    args.ambito,
  );
  const same = dayRows.filter(
    (r) =>
      r.calendario_ot_id !== args.calendarioOtId &&
      (r.maquina_id ?? "") === maquinaId &&
      (r.turno ?? "manana") === turno,
  );
  const maxSlot =
    same.length === 0 ? 0 : Math.max(...same.map((r) => r.slot_orden));

  await upsertDetalleDiaSlot(supabase, {
    calendarioOtId: args.calendarioOtId,
    ambito: args.ambito,
    otNumero: args.otNumero,
    maquinaId,
    turno,
    slotOrden: maxSlot + 1,
    createdBy: args.createdBy ?? existing.created_by,
  });
}

/** Seed: si no hay detalle para la máquina, usar orden del calendario → mañana. */
export function seedDraftFromCalendarioLineas(
  lineas: readonly CalendarioProduccionLinea[],
  pendingOnly: readonly CalendarioProduccionLinea[],
): DetalleDiaDraftSlot[] {
  const source =
    pendingOnly.length > 0 ? pendingOnly : [...lineas].sort((a, b) => a.orden - b.orden);
  const sorted = [...source].sort((a, b) => a.orden - b.orden);
  return sorted.map((l, idx) => ({
    calendarioOtId: l.id,
    otNumero: l.otNumero,
    turno: "manana" as const,
    slotOrden: idx + 1,
  }));
}

export function draftFromDetalleRows(
  rows: readonly ProdCalendarioDetalleDiaRow[],
  maquinaId: string,
): DetalleDiaDraftSlot[] {
  return sortDetalleBySlot(
    rows.filter((r) => (r.maquina_id ?? "") === maquinaId),
  ).map((r) => ({
    calendarioOtId: r.calendario_ot_id,
    otNumero: r.ot_numero,
    turno: (r.turno === "tarde" ? "tarde" : "manana") as CalendarioDetalleDiaTurno,
    slotOrden: r.slot_orden,
  }));
}

export function renumberDraftTurno(
  draft: readonly DetalleDiaDraftSlot[],
  turno: CalendarioDetalleDiaTurno,
): DetalleDiaDraftSlot[] {
  const other = draft.filter((d) => d.turno !== turno);
  const mine = draft
    .filter((d) => d.turno === turno)
    .sort((a, b) => a.slotOrden - b.slotOrden)
    .map((d, i) => ({ ...d, slotOrden: i + 1 }));
  return [...other, ...mine];
}

export function sortDetalleBySlot(
  rows: readonly ProdCalendarioDetalleDiaRow[],
): ProdCalendarioDetalleDiaRow[] {
  return [...rows].sort((a, b) => {
    const o = a.slot_orden - b.slot_orden;
    if (o !== 0) return o;
    return a.ot_numero.localeCompare(b.ot_numero, "es", { numeric: true });
  });
}
