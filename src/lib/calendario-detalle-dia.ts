/**
 * Bloque 11 fase 3 — orden fino del día (tabla ligera, no mesa LEGACY).
 * Fecha siempre vía pastilla `prod_calendario_produccion_ot` (sin columna duplicada).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import type {
  CalendarioDetalleDiaTurno,
  ProdCalendarioDetalleDiaRow,
} from "@/types/prod-calendario-detalle-dia";

export const TABLE_CALENDARIO_DETALLE_DIA = "prod_calendario_detalle_dia";

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
    .from("prod_calendario_produccion_ot")
    .select("id")
    .eq("fecha", ymd)
    .eq("ambito", ambito);
  if (pErr) throw pErr;
  const ids = (pastillas ?? []).map((r) => String(r.id));
  return fetchDetalleDiaByCalendarioOtIds(supabase, ids);
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

export function sortDetalleBySlot(
  rows: readonly ProdCalendarioDetalleDiaRow[],
): ProdCalendarioDetalleDiaRow[] {
  return [...rows].sort((a, b) => {
    const o = a.slot_orden - b.slot_orden;
    if (o !== 0) return o;
    return a.ot_numero.localeCompare(b.ot_numero, "es", { numeric: true });
  });
}
