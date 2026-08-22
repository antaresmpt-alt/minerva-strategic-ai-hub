/**
 * Bloque 11 — Contenedor Troquelado (spike).
 * Lista pasos Troquel `disponible` sin pasar por Pool/Mesa.
 * Claim = iniciar: el operario elige máquina al materializar la fila ligera
 * (maquina_id NOT NULL; multi-máquina tipotroquelado).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { PROCESO_TROQUEL_ID } from "@/lib/despacho-wizard-shared";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

export const CONTENEDOR_TROQUEL_ID_PREFIX = "contenedor-troquel:";

export const TROQUEL_HORAS_PLANIFICACION_DEFAULT = 1;

export type ContenedorTroquelPaso = {
  otPasoId: string;
  otId: string;
  otNumero: string;
  orden: number;
  datosProceso: Record<string, unknown> | null;
  /** Spike: disponible ⇒ ejecutable (gate material por proceso = pendiente). */
  ejecutable: boolean;
  isPrueba: boolean;
  fechaEntrega: string | null;
  horasPlanificadas: number;
};

export type ContenedorTroquelMaquina = {
  id: string;
  nombre: string;
  tipoMaquina: string;
};

export function isContenedorTroquelVirtualId(
  id: string | null | undefined,
): boolean {
  return String(id ?? "").startsWith(CONTENEDOR_TROQUEL_ID_PREFIX);
}

export function contenedorTroquelVirtualId(otPasoId: string): string {
  return `${CONTENEDOR_TROQUEL_ID_PREFIX}${otPasoId}`;
}

export function parseContenedorTroquelVirtualId(
  id: string | null | undefined,
): string | null {
  const raw = String(id ?? "").trim();
  if (!raw.startsWith(CONTENEDOR_TROQUEL_ID_PREFIX)) return null;
  const pasoId = raw.slice(CONTENEDOR_TROQUEL_ID_PREFIX.length).trim();
  return pasoId || null;
}

/** Máquinas troquelado activas (JR, etc.) — claim elige una al iniciar. */
export async function fetchMaquinasTroquelActivas(
  supabase: SupabaseClient,
): Promise<ContenedorTroquelMaquina[]> {
  const { data, error } = await supabase
    .from("prod_maquinas")
    .select("id, nombre, tipo_maquina")
    .eq("activa", true)
    .eq("tipo_maquina", "troquelado")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{
    id?: string;
    nombre?: string | null;
    tipo_maquina?: string | null;
  }>)
    .map((m) => {
      const id = String(m.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        nombre: String(m.nombre ?? "Troquel").trim() || "Troquel",
        tipoMaquina: String(m.tipo_maquina ?? "troquelado"),
      };
    })
    .filter((m): m is ContenedorTroquelMaquina => m != null);
}

/**
 * Pasos Troquel `disponible` sin ejecución activa en ese `ot_paso_id`.
 * Deduplica también por OT+máquina vía unique parcial al materializar.
 */
export async function fetchContenedorTroquelPasosDisponibles(
  supabase: SupabaseClient,
  options?: {
    includePruebas?: boolean;
    soloEjecutable?: boolean;
    otPasoIdsConEjecucionActiva?: ReadonlySet<string>;
  },
): Promise<ContenedorTroquelPaso[]> {
  const includePruebas = options?.includePruebas === true;
  const soloEjecutable = options?.soloEjecutable !== false;
  const occupied = options?.otPasoIdsConEjecucionActiva ?? new Set<string>();

  const { data: pasoRows, error: pasoErr } = await supabase
    .from("prod_ot_pasos")
    .select("id, ot_id, orden, estado, datos_proceso, proceso_id")
    .eq("proceso_id", PROCESO_TROQUEL_ID)
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

  const otNumeros = [...maestroById.values()]
    .filter((m) => m.despachado)
    .map((m) => m.num_pedido);
  const horasByOt = new Map<string, number>();
  if (otNumeros.length > 0) {
    const despRows = await fetchAllInChunks(otNumeros, 80, async (chunk) => {
      const { data, error } = await supabase
        .from("produccion_ot_despachadas")
        .select("ot_numero, horas_estimadas_troquelado")
        .in("ot_numero", chunk);
      if (error) throw error;
      return data ?? [];
    });
    for (const d of despRows as Array<{
      ot_numero?: string;
      horas_estimadas_troquelado?: number | null;
    }>) {
      const ot = String(d.ot_numero ?? "").trim();
      const h = d.horas_estimadas_troquelado;
      if (ot && typeof h === "number" && Number.isFinite(h) && h > 0) {
        horasByOt.set(ot, h);
      }
    }
  }

  const out: ContenedorTroquelPaso[] = [];
  for (const p of pasos) {
    const otId = String(p.ot_id ?? "").trim();
    const maestro = maestroById.get(otId);
    if (!maestro?.despachado) continue;
    const otNumero = maestro.num_pedido;
    const isPrueba = isOtNumeroPrueba(otNumero);
    if (!includePruebas && isPrueba) continue;

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
      horasPlanificadas:
        horasByOt.get(otNumero) ?? TROQUEL_HORAS_PLANIFICACION_DEFAULT,
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

export type CrearEjecucionLigeraTroquelInput = {
  otNumero: string;
  otPasoId: string;
  /** Claim: máquina troquel elegida al iniciar. */
  maquinaId: string;
  userId?: string | null;
  userEmail?: string | null;
  startImmediately?: boolean;
  horasPlanificadas?: number | null;
};

/**
 * Inserta ejecución sin `mesa_trabajo_id`. Claim = esta máquina.
 * Unique activo: (ot_numero, maquina_id).
 */
export async function crearEjecucionLigeraTroquel(
  supabase: SupabaseClient,
  input: CrearEjecucionLigeraTroquelInput,
): Promise<{ id: string }> {
  const otNumero = String(input.otNumero ?? "").trim();
  const otPasoId = String(input.otPasoId ?? "").trim();
  const maquinaId = String(input.maquinaId ?? "").trim();
  if (!otNumero || !otPasoId || !maquinaId) {
    throw new Error(
      "Faltan OT, paso o máquina (claim) para crear la ejecución Troquel.",
    );
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const horas =
    typeof input.horasPlanificadas === "number" &&
    Number.isFinite(input.horasPlanificadas) &&
    input.horasPlanificadas > 0
      ? input.horasPlanificadas
      : TROQUEL_HORAS_PLANIFICACION_DEFAULT;

  // Insert siempre pendiente_inicio: triggers itinerario son AFTER UPDATE.
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
      horas_planificadas_snapshot: horas,
      created_by: input.userId ?? null,
      created_by_email: input.userEmail ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const id = String((data as { id?: string } | null)?.id ?? "").trim();
  if (!id) throw new Error("No se obtuvo id de la ejecución Troquel.");

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
