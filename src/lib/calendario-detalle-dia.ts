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
  capacidad_horas_default_manana?: number;
  capacidad_horas_default_tarde?: number;
};

/** Slot en borrador local (antes de Guardar). */
export type DetalleDiaDraftSlot = {
  calendarioOtId: string;
  otNumero: string;
  turno: CalendarioDetalleDiaTurno;
  slotOrden: number;
};

/** Fuera del detalle calendario: no son recursos de planificación fina. */
const DETALLE_DIA_EXCLUDE_MAQUINA_NOMBRES: Partial<
  Record<CalendarioAmbito, readonly string[]>
> = {
  digital: ["etiqueta digital"],
  engomado: ["manipulados mnrv", "desbroce"],
};

function maquinaExcludedFromDetalleDia(
  ambito: CalendarioAmbito,
  nombre: string,
): boolean {
  const exclude = DETALLE_DIA_EXCLUDE_MAQUINA_NOMBRES[ambito] ?? [];
  const n = nombre.trim().toLowerCase();
  return exclude.some((x) => n.includes(x.trim().toLowerCase()));
}

export async function fetchMaquinasForAmbito(
  supabase: SupabaseClient,
  ambito: CalendarioAmbito,
): Promise<CalendarioDetalleMaquina[]> {
  const tipo = tipoMaquinaForCalendarioAmbito(ambito);
  const { data, error } = await supabase
    .from("prod_maquinas")
    .select(
      "id, nombre, tipo_maquina, capacidad_horas_default_manana, capacidad_horas_default_tarde, orden_visual",
    )
    .eq("tipo_maquina", tipo)
    .eq("activa", true)
    .order("orden_visual", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre ?? "").trim() || "—",
      tipo_maquina: String(r.tipo_maquina ?? "").trim(),
      capacidad_horas_default_manana: Number(
        r.capacidad_horas_default_manana ?? 8,
      ),
      capacidad_horas_default_tarde: Number(
        r.capacidad_horas_default_tarde ?? 8,
      ),
    }))
    .filter((m) => !maquinaExcludedFromDetalleDia(ambito, m.nombre));
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

/**
 * Orden global del día para la cola de ejecución: mañana (por slot) y luego tarde.
 * `slot_orden` en BD se renumera por turno (ambos empiezan en 1); sin esto la tarde
 * saltaría arriba al ordenar solo por slot.
 * Devuelve OT → rank denso 1..n (badge #N en ejecución).
 */
export function rankPlanHoyByOt(
  rows: readonly Pick<
    ProdCalendarioDetalleDiaRow,
    "ot_numero" | "turno" | "slot_orden"
  >[],
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => {
    const ta = a.turno === "tarde" ? 1 : 0;
    const tb = b.turno === "tarde" ? 1 : 0;
    if (ta !== tb) return ta - tb;
    if (a.slot_orden !== b.slot_orden) return a.slot_orden - b.slot_orden;
    return String(a.ot_numero ?? "").localeCompare(
      String(b.ot_numero ?? ""),
      "es",
      { numeric: true },
    );
  });
  const map = new Map<string, number>();
  let rank = 0;
  for (const r of sorted) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot || map.has(ot)) continue;
    rank += 1;
    map.set(ot, rank);
  }
  return map;
}

/** Detalle del plan de hoy por OT (rank + máquina/turno del detalle del día). */
export type PlanHoyDetallePorOt = {
  rank: number;
  maquinaId: string | null;
  turno: CalendarioDetalleDiaTurno | null;
};

export function planHoyDetalleByOtFromRows(
  rows: readonly ProdCalendarioDetalleDiaRow[],
): Map<string, PlanHoyDetallePorOt> {
  const ranks = rankPlanHoyByOt(rows);
  const out = new Map<string, PlanHoyDetallePorOt>();
  for (const r of rows) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const rank = ranks.get(ot);
    if (rank == null) continue;
    out.set(ot, {
      rank,
      maquinaId: r.maquina_id ? String(r.maquina_id).trim() || null : null,
      turno:
        r.turno === "tarde"
          ? "tarde"
          : r.turno === "manana"
            ? "manana"
            : null,
    });
  }
  return out;
}

export function labelPlanTurnoDetalle(
  turno: CalendarioDetalleDiaTurno | null,
): string {
  if (turno === "tarde") return "tarde";
  if (turno === "manana") return "mañana";
  return "";
}

/** Nombre de máquina para lista/claim cuando hay detalle del día guardado. */
export function maquinaNombreConPlanDetalle(
  claimFallback: string,
  maquinaNombre: string | null | undefined,
  turno: CalendarioDetalleDiaTurno | null,
): string {
  const name = String(maquinaNombre ?? "").trim();
  if (!name) return claimFallback;
  const t = labelPlanTurnoDetalle(turno);
  return t ? `${name} · ${t}` : name;
}

export async function fetchPlanHoyDetalleByOt(
  supabase: SupabaseClient,
  fechaYmd: string,
  ambito: CalendarioAmbito,
): Promise<Map<string, PlanHoyDetallePorOt>> {
  const rows = await fetchDetalleDiaByFechaAmbito(supabase, fechaYmd, ambito);
  return planHoyDetalleByOtFromRows(rows);
}

/** OT → rank global del plan de ese día/ámbito (mañana → tarde). */
export async function fetchPlanHoySlotByOt(
  supabase: SupabaseClient,
  fechaYmd: string,
  ambito: CalendarioAmbito,
): Promise<Map<string, number>> {
  const detalle = await fetchPlanHoyDetalleByOt(supabase, fechaYmd, ambito);
  const out = new Map<string, number>();
  for (const [ot, plan] of detalle) out.set(ot, plan.rank);
  return out;
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

/**
 * Guarda el tablero completo (todas las máquinas visibles).
 * Borra detalle de OTs devueltas al pool.
 */
export async function saveDetalleDiaBoard(
  supabase: SupabaseClient,
  args: {
    ambito: CalendarioAmbito;
    maquinaIds: readonly string[];
    draftByMaquina: ReadonlyMap<string, readonly DetalleDiaDraftSlot[]>;
    savedRows: readonly ProdCalendarioDetalleDiaRow[];
    unsequencedCalendarioOtIds: readonly string[];
    createdBy?: string | null;
  },
): Promise<void> {
  const keep = new Set<string>();
  for (const draft of args.draftByMaquina.values()) {
    for (const d of draft) keep.add(d.calendarioOtId);
  }
  for (const row of args.savedRows) {
    if (!keep.has(row.calendario_ot_id)) {
      await deleteDetalleDiaByCalendarioOtId(supabase, row.calendario_ot_id);
    }
  }
  for (const maquinaId of args.maquinaIds) {
    const draft = [...(args.draftByMaquina.get(maquinaId) ?? [])];
    const prevForMaq = args.savedRows.filter(
      (r) => (r.maquina_id ?? "") === maquinaId,
    );
    await saveDetalleDiaDraftForMaquina(supabase, {
      ambito: args.ambito,
      maquinaId,
      draft,
      previousRowsForMaquina: prevForMaq,
      createdBy: args.createdBy,
    });
  }
  const mergedDraft = [...args.draftByMaquina.values()].flat();
  await syncCalendarioOrdenFromDraft(
    supabase,
    mergedDraft,
    args.unsequencedCalendarioOtIds,
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
