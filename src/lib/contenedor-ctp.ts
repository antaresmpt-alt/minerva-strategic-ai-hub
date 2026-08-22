/**
 * Bloque 11 — Contenedor CTP (spike).
 * Lista pasos CTP `disponible` sin pasar por Pool/Mesa.
 * Al iniciar: fila ligera en `prod_mesa_ejecuciones` (mesa_trabajo_id null;
 * maquina_id NOT NULL → máquina preimpresión activa).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { PROCESO_CTP_ID } from "@/lib/hoja-ruta-campos-config";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

export const CONTENEDOR_CTP_ID_PREFIX = "contenedor-ctp:";

export const CTP_HORAS_PLANIFICACION_DEFAULT = 0.25;

const ESTADOS_EJECUCION_ACTIVAS = [
  "pendiente_inicio",
  "en_curso",
  "pausada",
] as const;

export type ContenedorCtpPaso = {
  otPasoId: string;
  otId: string;
  otNumero: string;
  orden: number;
  datosProceso: Record<string, unknown> | null;
  /** CTP no exige papel: siempre ejecutable cuando está disponible. */
  ejecutable: boolean;
  isPrueba: boolean;
  fechaEntrega: string | null;
};

export type ContenedorCtpMaquina = {
  id: string;
  nombre: string;
  tipoMaquina: string;
};

export function isContenedorCtpVirtualId(id: string | null | undefined): boolean {
  return String(id ?? "").startsWith(CONTENEDOR_CTP_ID_PREFIX);
}

export function contenedorCtpVirtualId(otPasoId: string): string {
  return `${CONTENEDOR_CTP_ID_PREFIX}${otPasoId}`;
}

export function parseContenedorCtpVirtualId(
  id: string | null | undefined,
): string | null {
  const raw = String(id ?? "").trim();
  if (!raw.startsWith(CONTENEDOR_CTP_ID_PREFIX)) return null;
  const pasoId = raw.slice(CONTENEDOR_CTP_ID_PREFIX.length).trim();
  return pasoId || null;
}

/** Máquina CTP / preimpresión activa (única en planta hoy: CTP MNRV). */
export async function fetchMaquinaCtpActiva(
  supabase: SupabaseClient,
): Promise<ContenedorCtpMaquina | null> {
  const { data, error } = await supabase
    .from("prod_maquinas")
    .select("id, nombre, tipo_maquina")
    .eq("activa", true)
    .eq("tipo_maquina", "preimpresion")
    .order("nombre", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;
  return {
    id: String(data.id),
    nombre: String(data.nombre ?? "CTP").trim() || "CTP",
    tipoMaquina: String(data.tipo_maquina ?? "preimpresion"),
  };
}

/**
 * Pasos CTP `disponible` sin ejecución activa en ese `ot_paso_id`.
 * Deduplica también por OT+máquina vía el unique parcial de ejecuciones activas
 * al materializar (ver `crearEjecucionLigeraCtp`).
 */
export async function fetchContenedorCtpPasosDisponibles(
  supabase: SupabaseClient,
  options?: {
    /** Si true, incluye OTs ≥98000. Default: false. */
    includePruebas?: boolean;
    /** Si true (default), solo ejecutable. CTP: todos los disponible lo son. */
    soloEjecutable?: boolean;
    /** ot_paso_id ya presentes en ejecuciones activas (no duplicar). */
    otPasoIdsConEjecucionActiva?: ReadonlySet<string>;
  },
): Promise<ContenedorCtpPaso[]> {
  const includePruebas = options?.includePruebas === true;
  const soloEjecutable = options?.soloEjecutable !== false;
  const occupied = options?.otPasoIdsConEjecucionActiva ?? new Set<string>();

  const { data: pasoRows, error: pasoErr } = await supabase
    .from("prod_ot_pasos")
    .select("id, ot_id, orden, estado, datos_proceso, proceso_id")
    .eq("proceso_id", PROCESO_CTP_ID)
    .eq("estado", "disponible")
    .order("orden", { ascending: true });
  if (pasoErr) throw pasoErr;

  const pasos = (pasoRows ?? []).filter((p) => {
    const id = String((p as { id?: string }).id ?? "").trim();
    return id && !occupied.has(id);
  }) as Array<{
    id: string;
    ot_id: string;
    orden: number | null;
    datos_proceso: Record<string, unknown> | null;
  }>;

  if (pasos.length === 0) return [];

  const otIds = [
    ...new Set(pasos.map((p) => String(p.ot_id ?? "").trim()).filter(Boolean)),
  ];

  const maestros = await fetchAllInChunks(otIds, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ots_general")
      .select("id, num_pedido, fecha_entrega, despachado")
      .in("id", chunk);
    if (error) throw error;
    return data ?? [];
  });

  const maestroById = new Map<
    string,
    { num_pedido: string; fecha_entrega: string | null; despachado: boolean }
  >();
  for (const m of maestros as Array<{
    id?: string;
    num_pedido?: string;
    fecha_entrega?: string | null;
    despachado?: boolean | null;
  }>) {
    const id = String(m.id ?? "").trim();
    const num = String(m.num_pedido ?? "").trim();
    if (!id || !num) continue;
    maestroById.set(id, {
      num_pedido: num,
      fecha_entrega: m.fecha_entrega ?? null,
      despachado: Boolean(m.despachado),
    });
  }

  const out: ContenedorCtpPaso[] = [];
  for (const p of pasos) {
    const otId = String(p.ot_id ?? "").trim();
    const maestro = maestroById.get(otId);
    if (!maestro?.despachado) continue;
    const otNumero = maestro.num_pedido;
    const isPrueba = isOtNumeroPrueba(otNumero);
    if (!includePruebas && isPrueba) continue;

    // CTP: disponible ⇒ ejecutable (no consume cartela/papel).
    const ejecutable = true;
    if (soloEjecutable && !ejecutable) continue;

    out.push({
      otPasoId: String(p.id),
      otId,
      otNumero,
      orden: typeof p.orden === "number" ? p.orden : 0,
      datosProceso: p.datos_proceso ?? null,
      ejecutable,
      isPrueba,
      fechaEntrega: maestro.fecha_entrega,
    });
  }

  out.sort((a, b) => {
    const fa = a.fechaEntrega ?? "9999-12-31";
    const fb = b.fechaEntrega ?? "9999-12-31";
    if (fa !== fb) return fa.localeCompare(fb);
    return a.otNumero.localeCompare(b.otNumero, "es", { numeric: true });
  });

  return out;
}

export type CrearEjecucionLigeraCtpInput = {
  otNumero: string;
  otPasoId: string;
  maquinaId: string;
  userId?: string | null;
  userEmail?: string | null;
  startImmediately?: boolean;
};

/**
 * Inserta ejecución sin `mesa_trabajo_id`.
 * Requiere `maquina_id` (NOT NULL en BD). Unique activo: (ot_numero, maquina_id).
 */
export async function crearEjecucionLigeraCtp(
  supabase: SupabaseClient,
  input: CrearEjecucionLigeraCtpInput,
): Promise<{ id: string }> {
  const otNumero = String(input.otNumero ?? "").trim();
  const otPasoId = String(input.otPasoId ?? "").trim();
  const maquinaId = String(input.maquinaId ?? "").trim();
  if (!otNumero || !otPasoId || !maquinaId) {
    throw new Error("Faltan OT, paso o máquina para crear la ejecución CTP.");
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  // Insert siempre pendiente_inicio: los triggers de itinerario son AFTER UPDATE.
  const { data, error } = await supabase
    .from("prod_mesa_ejecuciones")
    .insert({
      mesa_trabajo_id: null,
      ot_numero: otNumero,
      maquina_id: maquinaId,
      ot_paso_id: otPasoId,
      fecha_planificada: today,
      turno: null,
      slot_orden: null,
      liberada_at: nowIso,
      inicio_real_at: null,
      estado_ejecucion: "pendiente_inicio",
      horas_planificadas_snapshot: CTP_HORAS_PLANIFICACION_DEFAULT,
      created_by: input.userId ?? null,
      created_by_email: input.userEmail ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const id = String((data as { id?: string } | null)?.id ?? "").trim();
  if (!id) throw new Error("No se obtuvo id de la ejecución CTP.");

  if (input.startImmediately) {
    const { error: startErr } = await supabase
      .from("prod_mesa_ejecuciones")
      .update({
        estado_ejecucion: "en_curso",
        inicio_real_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (startErr) throw startErr;
  }

  return { id };
}
