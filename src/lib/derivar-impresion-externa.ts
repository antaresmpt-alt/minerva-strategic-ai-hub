import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PROCESO_DIGITAL_ID,
  PROCESO_IMPRESION_EXTERNA_ID,
  PROCESO_OFFSET_ID,
} from "@/lib/despacho-wizard-shared";
import {
  fetchProdOtGeneralIdByNumPedido,
  TABLE_PROD_OT_PASOS,
} from "@/lib/prod-ot-itinerario-client";

const IMPRESION_INTERNA = new Set([PROCESO_OFFSET_ID, PROCESO_DIGITAL_ID]);
const ESTADOS_ABIERTOS = new Set(["pendiente", "disponible"]);
const MESA_ACTIVA = ["borrador", "confirmado", "en_ejecucion"] as const;
const EJECUCION_INICIADA = new Set(["en_curso", "pausada"]);

const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_POOL = "prod_planificacion_pool";
const TABLE_OT_PASOS = "prod_ot_pasos";

/** Tras anular ejecución sin finalizar: evita paso atascado en en_marcha sin hueco en mesa. */
async function revertirPasoItinerarioTrasAnularEjecucion(
  supabase: SupabaseClient,
  ejecucionId: string,
): Promise<void> {
  const id = String(ejecucionId ?? "").trim();
  if (!id) return;

  const { data: ejRow, error: ejErr } = await supabase
    .from(TABLE_EJECUCIONES)
    .select("ot_paso_id")
    .eq("id", id)
    .maybeSingle();
  if (ejErr) throw ejErr;

  const otPasoId = String((ejRow as { ot_paso_id?: string | null } | null)?.ot_paso_id ?? "").trim();
  if (!otPasoId) return;

  const { error: pasoErr } = await supabase
    .from(TABLE_OT_PASOS)
    .update({
      estado: "disponible",
      fecha_inicio: null,
    })
    .eq("id", otPasoId)
    .in("estado", ["en_marcha", "pausado"]);
  if (pasoErr) throw pasoErr;
}

export type PasoDerivarImpresion = {
  id: string;
  procesoId: number;
  estado: string;
  orden: number;
};

export function puedeDerivarImpresionExterna(row: {
  otTipo?: string | null;
  proximoPasoProcesoId?: number | null;
}): boolean {
  if (row.otTipo === "contenedor") return false;
  const pid = row.proximoPasoProcesoId;
  return pid === PROCESO_OFFSET_ID || pid === PROCESO_DIGITAL_ID;
}

/** Hueco en mesa: se puede sacar si no ha picado inicio en máquina. */
export function ejecucionBloqueaDerivarAExterna(
  estadoEjecucion: string | null | undefined,
): boolean {
  return EJECUCION_INICIADA.has(String(estadoEjecucion ?? "").trim().toLowerCase());
}

/** Acción «Imprimir fuera» en tarjeta de mesa: Offset/Digital y aún sin inicio. */
export function puedeMostrarImprimirFueraMesa(args: {
  maquinaTipo?: string | null;
  estadoMesa?: string | null;
  estadoEjecucion?: string | null;
}): boolean {
  const tipo = String(args.maquinaTipo ?? "").trim().toLowerCase();
  if (tipo !== "impresion" && tipo !== "digital") return false;
  if (ejecucionBloqueaDerivarAExterna(args.estadoEjecucion)) return false;
  const mesa = String(args.estadoMesa ?? "").trim().toLowerCase();
  const exec = String(args.estadoEjecucion ?? "").trim().toLowerCase();
  if (mesa === "confirmado" && !exec) return true;
  return exec === "pendiente_inicio";
}

/**
 * El paso a sustituir es el primero `disponible` y debe ser Offset o Digital.
 * No toca CTP ni pasos ya en marcha.
 */
export function findPasoImpresionInternaParaDerivar(
  pasos: PasoDerivarImpresion[],
): PasoDerivarImpresion | null {
  const sorted = [...pasos].sort((a, b) => a.orden - b.orden);
  const abierto21 = sorted.find(
    (p) =>
      p.procesoId === PROCESO_IMPRESION_EXTERNA_ID &&
      ESTADOS_ABIERTOS.has(String(p.estado ?? "").trim().toLowerCase()),
  );
  if (abierto21) return null;

  const next = sorted.find(
    (p) => String(p.estado ?? "").trim().toLowerCase() === "disponible",
  );
  if (!next) return null;
  if (!IMPRESION_INTERNA.has(next.procesoId)) return null;
  return next;
}

export type DerivarImpresionExternaResult = {
  otNumero: string;
  pasoId: string;
  procesoOrigenId: number;
  mesaLiberada: boolean;
};

async function liberarMesaActivaSiNoIniciada(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<boolean> {
  const { data: mesaRows, error: mesaErr } = await supabase
    .from(TABLE_MESA)
    .select("id, estado_mesa")
    .eq("ot_numero", otNumero)
    .in("estado_mesa", [...MESA_ACTIVA]);
  if (mesaErr) throw mesaErr;

  const activos = (mesaRows ?? []) as Array<{ id?: string; estado_mesa?: string | null }>;
  const mesaIds = activos.map((r) => String(r.id ?? "").trim()).filter(Boolean);
  if (mesaIds.length === 0) return false;

  const { data: execRows, error: execErr } = await supabase
    .from(TABLE_EJECUCIONES)
    .select("id, mesa_trabajo_id, estado_ejecucion")
    .in("mesa_trabajo_id", mesaIds)
    .in("estado_ejecucion", ["pendiente_inicio", "en_curso", "pausada"]);
  if (execErr) throw execErr;

  const ejecuciones = (execRows ?? []) as Array<{
    id?: string;
    mesa_trabajo_id?: string | null;
    estado_ejecucion?: string | null;
  }>;
  const iniciada = ejecuciones.find((e) => ejecucionBloqueaDerivarAExterna(e.estado_ejecucion));
  if (iniciada) {
    throw new Error(
      `${otNumero}: ya está en máquina (iniciada o pausada). Cancela o termina esa ejecución antes de mandarla fuera.`,
    );
  }

  const nowIso = new Date().toISOString();
  const pendientes = ejecuciones
    .map((e) => String(e.id ?? "").trim())
    .filter(Boolean);
  if (pendientes.length > 0) {
    const { error: cancelErr } = await supabase
      .from(TABLE_EJECUCIONES)
      .update({
        estado_ejecucion: "cancelada",
        fin_real_at: nowIso,
        updated_at: nowIso,
      })
      .in("id", pendientes);
    if (cancelErr) throw cancelErr;
    for (const ejId of pendientes) {
      await revertirPasoItinerarioTrasAnularEjecucion(supabase, ejId);
    }
  }

  const { error: delMesaErr } = await supabase
    .from(TABLE_MESA)
    .delete()
    .in("id", mesaIds);
  if (delMesaErr) throw delMesaErr;

  return true;
}

async function devolverPoolAEstadoPreMesa(
  supabase: SupabaseClient,
  otNumero: string,
  notas: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_POOL)
    .update({
      estado_pool: "en_transito",
      notas,
    })
    .eq("ot_numero", otNumero)
    .neq("estado_pool", "cerrada");
  if (error) throw error;
}

/**
 * Anular hueco de mesa: cancela la liberación (si existe) y borra la fila
 * para que no quede como «Terminada». La OT vuelve al Pool (`en_transito`).
 */
export async function devolverHuecoMesaAlPool(
  supabase: SupabaseClient,
  args: { otNumero: string; mesaTrabajoId: string; ejecucionId?: string | null },
): Promise<void> {
  const ot = String(args.otNumero ?? "").trim();
  const mesaId = String(args.mesaTrabajoId ?? "").trim();
  if (!ot || !mesaId) throw new Error("Falta OT o hueco de mesa.");

  const nowIso = new Date().toISOString();
  const ejecucionId = String(args.ejecucionId ?? "").trim();
  if (ejecucionId) {
    const { error: cancelErr } = await supabase
      .from(TABLE_EJECUCIONES)
      .update({
        estado_ejecucion: "cancelada",
        fin_real_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", ejecucionId)
      .in("estado_ejecucion", ["pendiente_inicio", "en_curso", "pausada"]);
    if (cancelErr) throw cancelErr;
    await revertirPasoItinerarioTrasAnularEjecucion(supabase, ejecucionId);
  }

  const { error: delErr } = await supabase.from(TABLE_MESA).delete().eq("id", mesaId);
  if (delErr) throw delErr;

  await devolverPoolAEstadoPreMesa(supabase, ot, "Devuelta al Pool al anular mesa");
}

export async function derivarOtAImpresionExterna(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<DerivarImpresionExternaResult> {
  const ot = String(otNumero ?? "").trim();
  if (!ot) throw new Error("Falta el número de OT.");

  const otId = await fetchProdOtGeneralIdByNumPedido(supabase, ot);
  if (!otId) throw new Error(`No se encontró la OT ${ot} en maestro.`);

  const { data, error } = await supabase
    .from(TABLE_PROD_OT_PASOS)
    .select("id, orden, estado, proceso_id")
    .eq("ot_id", otId)
    .order("orden", { ascending: true });
  if (error) throw error;

  const pasos: PasoDerivarImpresion[] = (data ?? []).map((raw) => {
    const r = raw as {
      id?: string;
      orden?: number | null;
      estado?: string | null;
      proceso_id?: number | null;
    };
    return {
      id: String(r.id ?? "").trim(),
      orden: typeof r.orden === "number" && Number.isFinite(r.orden) ? r.orden : 0,
      estado: String(r.estado ?? "").trim().toLowerCase(),
      procesoId:
        typeof r.proceso_id === "number" && Number.isFinite(r.proceso_id)
          ? Math.trunc(r.proceso_id)
          : 0,
    };
  }).filter((p) => p.id.length > 0 && p.procesoId > 0);

  const target = findPasoImpresionInternaParaDerivar(pasos);
  if (!target) {
    throw new Error(
      `${ot}: el próximo paso no es Offset/Digital disponible (o ya tiene Impresión EXTERNA).`,
    );
  }

  const mesaLiberada = await liberarMesaActivaSiNoIniciada(supabase, ot);
  await devolverPoolAEstadoPreMesa(supabase, ot, "Derivada a impresión externa");

  const { error: updErr } = await supabase
    .from(TABLE_PROD_OT_PASOS)
    .update({
      proceso_id: PROCESO_IMPRESION_EXTERNA_ID,
      maquina_id: null,
    })
    .eq("id", target.id)
    .eq("estado", "disponible");
  if (updErr) throw updErr;

  return {
    otNumero: ot,
    pasoId: target.id,
    procesoOrigenId: target.procesoId,
    mesaLiberada,
  };
}
