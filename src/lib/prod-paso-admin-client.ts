import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyCartelaToDatos,
  fetchPaletByIdStock,
  type PasoItinerarioConsumo,
} from "@/lib/cartela-ejecucion";
import {
  aplicarConsumoCartelaSiCorresponde,
  parseCartelaConsumoFromDatos,
  validarCartelaConsumoAntesCerrar,
} from "@/lib/cartela-stock-consumo";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";

const TABLE_MESA_PLAN = "prod_mesa_planificacion_trabajos";

export type PasoItinerarioAdmin = {
  id: string;
  orden: number;
  estado: string;
  procesoId: number | null;
};

const ESTADOS_SIGUIENTE_BLOQUEAN = new Set(["en_marcha", "pausado", "finalizado"]);

/** True si algún paso posterior ya empezó o cerró. */
export function siguientePasoIniciado(pasos: PasoItinerarioAdmin[], pasoId: string): boolean {
  const actual = pasos.find((p) => p.id === pasoId);
  if (!actual) return true;
  return pasos.some(
    (p) => p.orden > actual.orden && ESTADOS_SIGUIENTE_BLOQUEAN.has(p.estado),
  );
}

export async function pasoYaTieneConsumoCartela(
  supabase: SupabaseClient,
  pasoId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("prod_stock_movimientos")
    .select("id")
    .eq("paso_id", pasoId)
    .eq("tipo", "consumo")
    .limit(1);
  if (error) throw new Error(error.message || "No se pudo comprobar consumos previos.");
  return (data?.length ?? 0) > 0;
}

export type MovimientoConsumo = {
  id: string;
  palet_id: string;
  cantidad: number;
  ot_numero: string | null;
  created_at: string;
};

/** Obtiene el último movimiento de consumo del paso (sin comprobar si ya se revirtió). */
export async function fetchUltimoConsumoDelPaso(
  supabase: SupabaseClient,
  pasoId: string,
): Promise<MovimientoConsumo | null> {
  const { data, error } = await supabase
    .from("prod_stock_movimientos")
    .select("id, palet_id, cantidad, ot_numero, created_at")
    .eq("paso_id", pasoId)
    .eq("tipo", "consumo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message || "No se pudo recuperar el consumo.");
  return data as MovimientoConsumo | null;
}

async function consumoNetoPendiente(
  supabase: SupabaseClient,
  paletId: string,
  otNumero: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("prod_stock_movimientos")
    .select("tipo, cantidad")
    .eq("palet_id", paletId)
    .eq("ot_numero", otNumero)
    .in("tipo", ["consumo", "ajuste"]);
  if (error) throw new Error(error.message || "No se pudo calcular el consumo neto.");
  let net = 0;
  for (const row of data ?? []) {
    const cantidad = typeof row.cantidad === "number" ? row.cantidad : 0;
    if (row.tipo === "consumo") net += cantidad;
    else if (row.tipo === "ajuste") net -= cantidad;
  }
  return net;
}

/**
 * Consumo del paso que aún puede revertirse (ledger neto palet+OT > 0).
 * Tras una reversión exitosa devuelve null → oculta el botón en hoja de ruta.
 */
export async function fetchConsumoRevertibleDelPaso(
  supabase: SupabaseClient,
  pasoId: string,
): Promise<MovimientoConsumo | null> {
  const consumo = await fetchUltimoConsumoDelPaso(supabase, pasoId);
  if (!consumo?.ot_numero?.trim()) return consumo;
  const net = await consumoNetoPendiente(supabase, consumo.palet_id, consumo.ot_numero.trim());
  if (net <= 0) return null;
  return { ...consumo, cantidad: Math.min(consumo.cantidad, net) };
}

/** Revierte el consumo de cartela de un paso finalizado (9.8.5). */
export async function revertirConsumoPasoAdmin(
  supabase: SupabaseClient,
  params: {
    paletId: string;
    cantidad: number;
    otNumero: string;
    pasoId?: string | null;
    autorizadoPor: string;
    notas?: string | null;
    nuevoFormato?: string | null;
    /** Stock real tras corte (Caso B). Si se indica, fija cantidad_actual en el palet. */
    nuevaCantidad?: number | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc("prod_stock_revertir_consumo", {
    p_palet_id: params.paletId,
    p_cantidad: params.cantidad,
    p_ot_numero: params.otNumero,
    p_autorizado_por: params.autorizadoPor,
    p_notas: params.notas ?? null,
    p_nuevo_formato: params.nuevoFormato ?? null,
    p_paso_id: params.pasoId ?? null,
    p_nueva_cantidad: params.nuevaCantidad ?? null,
  });
  if (error) throw new Error(error.message || "No se pudo revertir el consumo.");
}

export async function fetchPasosItinerarioAdmin(
  supabase: SupabaseClient,
  otId: string,
): Promise<PasoItinerarioAdmin[]> {
  const { data, error } = await supabase
    .from("prod_ot_pasos")
    .select("id, orden, estado, proceso_id")
    .eq("ot_id", otId)
    .order("orden", { ascending: true });
  if (error) throw new Error(error.message || "No se pudo cargar el itinerario.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    orden: typeof row.orden === "number" ? row.orden : 0,
    estado: String(row.estado ?? ""),
    procesoId: typeof row.proceso_id === "number" ? row.proceso_id : null,
  }));
}

export async function corregirCartelaPasoAdmin(
  supabase: SupabaseClient,
  params: {
    pasoId: string;
    otNumero: string;
    otId: string;
    procesoId: number | null;
    datosActuales: DatosProcesoGenerico;
    datosCartela: DatosProcesoGenerico;
    pasosItinerario?: PasoItinerarioConsumo[] | null;
    userId: string;
  },
): Promise<{ hojas: number; consumido: boolean }> {
  const cartelaErr = validarCartelaConsumoAntesCerrar(params.datosCartela);
  if (cartelaErr) throw new Error(cartelaErr);

  const yaConsumido = await pasoYaTieneConsumoCartela(supabase, params.pasoId);
  if (yaConsumido) {
    throw new Error(
      "Este paso ya tiene un consumo de cartela registrado en stock. Contacta con gerencia para ajustes.",
    );
  }

  const parsed = parseCartelaConsumoFromDatos(params.datosCartela);
  let palet = null;
  if (parsed.idStock != null) {
    palet = await fetchPaletByIdStock(supabase, parsed.idStock);
    if (!palet) throw new Error("ID Stock no encontrado en Minerva.");
  }

  const mergedCartela = applyCartelaToDatos(
    params.datosActuales,
    palet,
    parsed.idStock,
    parsed.hojas,
  );

  const { consumido, hojas } = await aplicarConsumoCartelaSiCorresponde(supabase, {
    procesoId: params.procesoId,
    otNumero: params.otNumero,
    pasoId: params.pasoId,
    datos: mergedCartela,
    pasosItinerario: params.pasosItinerario,
  });

  const nextDatos: DatosProcesoGenerico = {
    ...mergedCartela,
    cartela_corregida_at: new Date().toISOString(),
    cartela_corregida_por: params.userId,
  };

  const { error: updErr } = await supabase
    .from("prod_ot_pasos")
    .update({ datos_proceso: nextDatos })
    .eq("id", params.pasoId);
  if (updErr) throw new Error(updErr.message || "No se pudo guardar la cartela en el paso.");

  return { hojas: hojas ?? parsed.hojas ?? 0, consumido };
}

export async function editarDatosPasoAdmin(
  supabase: SupabaseClient,
  params: {
    pasoId: string;
    datos: DatosProcesoGenerico;
    userId: string;
    ejecucionId?: string | null;
    horasReales?: number | null;
  },
): Promise<void> {
  const nextDatos: DatosProcesoGenerico = {
    ...params.datos,
    admin_editado_at: new Date().toISOString(),
    admin_editado_por: params.userId,
  };

  const { error: pasoErr } = await supabase
    .from("prod_ot_pasos")
    .update({ datos_proceso: nextDatos })
    .eq("id", params.pasoId);
  if (pasoErr) throw new Error(pasoErr.message || "No se pudo actualizar el paso.");

  if (params.ejecucionId && params.horasReales != null && params.horasReales > 0) {
    const { error: ejErr } = await supabase
      .from("prod_mesa_ejecuciones")
      .update({
        horas_reales: params.horasReales,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.ejecucionId);
    if (ejErr) throw new Error(ejErr.message || "No se pudo actualizar horas de ejecución.");
  }
}

export async function reabrirPasoAdmin(
  supabase: SupabaseClient,
  params: {
    pasoId: string;
    otId: string;
    ejecucionId?: string | null;
    mesaTrabajoId?: string | null;
    userId: string;
  },
): Promise<void> {
  const pasos = await fetchPasosItinerarioAdmin(supabase, params.otId);
  if (siguientePasoIniciado(pasos, params.pasoId)) {
    throw new Error(
      "No se puede reabrir: un paso posterior ya está en marcha o finalizado.",
    );
  }

  const actual = pasos.find((p) => p.id === params.pasoId);
  if (!actual || actual.estado !== "finalizado") {
    throw new Error("Solo se pueden reabrir pasos en estado finalizado.");
  }

  let ejecucionId = params.ejecucionId ?? null;
  let mesaTrabajoId = params.mesaTrabajoId ?? null;

  if (!ejecucionId) {
    const { data: ejRow } = await supabase
      .from("prod_mesa_ejecuciones")
      .select("id, mesa_trabajo_id")
      .eq("ot_paso_id", params.pasoId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    ejecucionId = ejRow?.id ?? null;
    mesaTrabajoId = mesaTrabajoId ?? (ejRow?.mesa_trabajo_id as string | null) ?? null;
  }

  const now = new Date().toISOString();

  for (const p of pasos) {
    if (p.orden > actual.orden && p.estado === "disponible") {
      const { error } = await supabase
        .from("prod_ot_pasos")
        .update({ estado: "pendiente" })
        .eq("id", p.id);
      if (error) throw new Error(error.message || "No se pudo revertir el paso siguiente.");
    }
  }

  const { error: pasoErr } = await supabase
    .from("prod_ot_pasos")
    .update({
      estado: "disponible",
      fecha_fin: null,
    })
    .eq("id", params.pasoId);
  if (pasoErr) throw new Error(pasoErr.message || "No se pudo reabrir el paso.");

  if (params.ejecucionId) {
    const { error: ejErr } = await supabase
      .from("prod_mesa_ejecuciones")
      .update({
        estado_ejecucion: "pendiente_inicio",
        fin_real_at: null,
        updated_at: now,
      })
      .eq("id", params.ejecucionId);
    if (ejErr) throw new Error(ejErr.message || "No se pudo reabrir la ejecución.");
  } else if (ejecucionId) {
    const { error: ejErr } = await supabase
      .from("prod_mesa_ejecuciones")
      .update({
        estado_ejecucion: "pendiente_inicio",
        fin_real_at: null,
        updated_at: now,
      })
      .eq("id", ejecucionId);
    if (ejErr) throw new Error(ejErr.message || "No se pudo reabrir la ejecución.");
  }

  if (params.mesaTrabajoId) {
    const { error: mesaErr } = await supabase
      .from(TABLE_MESA_PLAN)
      .update({ estado_mesa: "confirmado" })
      .eq("id", params.mesaTrabajoId);
    if (mesaErr) throw new Error(mesaErr.message || "No se pudo actualizar la mesa.");
  } else if (mesaTrabajoId) {
    const { error: mesaErr } = await supabase
      .from(TABLE_MESA_PLAN)
      .update({ estado_mesa: "confirmado" })
      .eq("id", mesaTrabajoId);
    if (mesaErr) throw new Error(mesaErr.message || "No se pudo actualizar la mesa.");
  }

  const { data: pasoRow } = await supabase
    .from("prod_ot_pasos")
    .select("datos_proceso")
    .eq("id", params.pasoId)
    .maybeSingle();
  const prev = (pasoRow?.datos_proceso as DatosProcesoGenerico) ?? {};
  const { error: auditErr } = await supabase
    .from("prod_ot_pasos")
    .update({
      datos_proceso: {
        ...prev,
        paso_reabierto_at: now,
        paso_reabierto_por: params.userId,
      },
    })
    .eq("id", params.pasoId);
  if (auditErr) throw new Error(auditErr.message || "No se pudo registrar la reapertura.");
}

/** Bloque 9.8 §19 — Reset planificación STOP: identifica huecos mesa posteriores. */
export type HuecoMesaPosterior = {
  mesaId: string;
  ejecucionId: string | null;
  pasoId: string;
  procesoNombre: string | null;
  orden: number;
  /** Nombre máquina (p.ej. SpeedMaster CD 102). */
  maquinaNombre: string | null;
  /** Fecha planificada YYYY-MM-DD. */
  fechaPlanificada: string | null;
  /** Turno: manana | tarde | otro. */
  turno: string | null;
};

const MESA_ESTADOS_ACTIVOS = ["borrador", "confirmado", "en_ejecucion"] as const;
const EJEC_ESTADOS_ACTIVOS = ["pendiente_inicio", "en_curso", "pausada"] as const;

/**
 * Identifica huecos de mesa de pasos posteriores.
 * `ot_paso_id` vive en `prod_mesa_ejecuciones` (no en mesa).
 * Fallback: mesa activa por `ot_numero` si aún no hay ejecución (borrador/confirmado).
 */
export async function fetchHuecosMesaPosteriores(
  supabase: SupabaseClient,
  otId: string,
  pasoOrden: number,
  otNumero?: string | null,
): Promise<HuecoMesaPosterior[]> {
  const { data: pasosData, error: pasosErr } = await supabase
    .from("prod_ot_pasos")
    .select("id, orden, proceso_id")
    .eq("ot_id", otId)
    .gt("orden", pasoOrden)
    .order("orden", { ascending: true });
  if (pasosErr) throw new Error(pasosErr.message || "No se pudo cargar el itinerario.");

  const pasos = (pasosData ?? []) as Array<{
    id?: string;
    orden?: number | null;
    proceso_id?: number | null;
  }>;
  if (pasos.length === 0) return [];

  const pasoIds = pasos
    .map((p) => String(p.id ?? "").trim())
    .filter(Boolean);
  if (pasoIds.length === 0) return [];

  const ordenByPasoId = new Map<string, number>();
  const procesoIdByPasoId = new Map<string, number>();
  for (const p of pasos) {
    const pid = String(p.id ?? "").trim();
    if (!pid) continue;
    if (typeof p.orden === "number") ordenByPasoId.set(pid, p.orden);
    if (typeof p.proceso_id === "number") procesoIdByPasoId.set(pid, p.proceso_id);
  }

  // 1) Camino principal: ejecuciones con ot_paso_id de pasos posteriores
  const { data: execByPasoData, error: execByPasoErr } = await supabase
    .from("prod_mesa_ejecuciones")
    .select("id, mesa_trabajo_id, ot_paso_id")
    .in("ot_paso_id", pasoIds)
    .in("estado_ejecucion", [...EJEC_ESTADOS_ACTIVOS]);
  if (execByPasoErr) {
    throw new Error(execByPasoErr.message || "No se pudo cargar ejecuciones de mesa.");
  }

  const execRows = (execByPasoData ?? []) as Array<{
    id?: string;
    mesa_trabajo_id?: string | null;
    ot_paso_id?: string | null;
  }>;

  type PendingHueco = {
    mesaId: string;
    ejecucionId: string | null;
    pasoId: string;
  };
  const byMesa = new Map<string, PendingHueco>();

  for (const e of execRows) {
    const mesaId = String(e.mesa_trabajo_id ?? "").trim();
    const ejecucionId = String(e.id ?? "").trim();
    const pasoId = String(e.ot_paso_id ?? "").trim();
    if (!mesaId || !pasoId || !ejecucionId) continue;
    byMesa.set(mesaId, { mesaId, ejecucionId, pasoId });
  }

  // 2) Fallback: mesa activa por ot_numero (planificada, aún sin ot_paso_id en ejecución)
  const ot = String(otNumero ?? "").trim();
  if (ot) {
    const { data: mesaByOtData, error: mesaByOtErr } = await supabase
      .from("prod_mesa_planificacion_trabajos")
      .select("id, estado_mesa")
      .eq("ot_numero", ot)
      .in("estado_mesa", [...MESA_ESTADOS_ACTIVOS]);
    if (mesaByOtErr) {
      throw new Error(mesaByOtErr.message || "No se pudo cargar la mesa por OT.");
    }

    const mesaByOt = (mesaByOtData ?? []) as Array<{
      id?: string;
      estado_mesa?: string | null;
    }>;
    const missingMesaIds = mesaByOt
      .map((m) => String(m.id ?? "").trim())
      .filter((id) => id && !byMesa.has(id));

    if (missingMesaIds.length > 0) {
      const { data: execFallbackData } = await supabase
        .from("prod_mesa_ejecuciones")
        .select("id, mesa_trabajo_id, ot_paso_id, estado_ejecucion")
        .in("mesa_trabajo_id", missingMesaIds)
        .in("estado_ejecucion", [...EJEC_ESTADOS_ACTIVOS]);

      const execFallbackByMesa = new Map<
        string,
        { id: string; otPasoId: string | null }
      >();
      for (const e of (execFallbackData ?? []) as Array<{
        id?: string;
        mesa_trabajo_id?: string | null;
        ot_paso_id?: string | null;
      }>) {
        const mid = String(e.mesa_trabajo_id ?? "").trim();
        const eid = String(e.id ?? "").trim();
        if (!mid || !eid) continue;
        execFallbackByMesa.set(mid, {
          id: eid,
          otPasoId: String(e.ot_paso_id ?? "").trim() || null,
        });
      }

      // Primer paso posterior = atribución por defecto si no hay ot_paso_id
      const defaultPasoId = pasoIds[0] ?? "";

      for (const mesaId of missingMesaIds) {
        const exec = execFallbackByMesa.get(mesaId);
        // Si la ejecución apunta a un paso NO posterior (p.ej. el actual), no anular
        if (exec?.otPasoId && !ordenByPasoId.has(exec.otPasoId)) continue;

        const pasoId =
          (exec?.otPasoId && ordenByPasoId.has(exec.otPasoId)
            ? exec.otPasoId
            : defaultPasoId) || defaultPasoId;
        if (!pasoId) continue;

        byMesa.set(mesaId, {
          mesaId,
          ejecucionId: exec?.id ?? null,
          pasoId,
        });
      }
    }
  }

  if (byMesa.size === 0) return [];

  // Verificar mesa activa + dónde está (máquina / día / turno)
  const mesaIds = [...byMesa.keys()];
  const { data: mesaActivaData, error: mesaActivaErr } = await supabase
    .from("prod_mesa_planificacion_trabajos")
    .select("id, maquina_id, fecha_planificada, turno")
    .in("id", mesaIds)
    .in("estado_mesa", [...MESA_ESTADOS_ACTIVOS]);
  if (mesaActivaErr) {
    throw new Error(mesaActivaErr.message || "No se pudo verificar estado de mesa.");
  }

  type MesaMeta = {
    maquinaId: string | null;
    fechaPlanificada: string | null;
    turno: string | null;
  };
  const mesaMetaById = new Map<string, MesaMeta>();
  for (const m of (mesaActivaData ?? []) as Array<{
    id?: string;
    maquina_id?: string | null;
    fecha_planificada?: string | null;
    turno?: string | null;
  }>) {
    const mid = String(m.id ?? "").trim();
    if (!mid) continue;
    mesaMetaById.set(mid, {
      maquinaId: String(m.maquina_id ?? "").trim() || null,
      fechaPlanificada: String(m.fecha_planificada ?? "").trim() || null,
      turno: String(m.turno ?? "").trim() || null,
    });
  }

  const maquinaIds = [
    ...new Set(
      [...mesaMetaById.values()]
        .map((m) => m.maquinaId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nombreByMaquinaId = new Map<string, string>();
  if (maquinaIds.length > 0) {
    const { data: maqData } = await supabase
      .from("prod_maquinas")
      .select("id, nombre")
      .in("id", maquinaIds);
    for (const q of (maqData ?? []) as Array<{
      id?: string;
      nombre?: string | null;
    }>) {
      const qid = String(q.id ?? "").trim();
      const nom = String(q.nombre ?? "").trim();
      if (qid && nom) nombreByMaquinaId.set(qid, nom);
    }
  }

  // Nombres de proceso
  const procesoIds = [
    ...new Set(
      [...procesoIdByPasoId.values()].filter((pid) => pid > 0),
    ),
  ];
  const nombresByProcId = new Map<number, string>();
  if (procesoIds.length > 0) {
    const { data: procData } = await supabase
      .from("prod_procesos_cat")
      .select("id, nombre")
      .in("id", procesoIds);
    for (const p of (procData ?? []) as Array<{
      id?: number;
      nombre?: string | null;
    }>) {
      if (typeof p.id === "number" && p.nombre) {
        nombresByProcId.set(p.id, p.nombre);
      }
    }
  }

  const result: HuecoMesaPosterior[] = [];
  for (const hueco of byMesa.values()) {
    const meta = mesaMetaById.get(hueco.mesaId);
    if (!meta) continue;
    const procId = procesoIdByPasoId.get(hueco.pasoId);
    result.push({
      mesaId: hueco.mesaId,
      ejecucionId: hueco.ejecucionId,
      pasoId: hueco.pasoId,
      procesoNombre:
        typeof procId === "number" ? nombresByProcId.get(procId) ?? null : null,
      orden: ordenByPasoId.get(hueco.pasoId) ?? 0,
      maquinaNombre: meta.maquinaId
        ? nombreByMaquinaId.get(meta.maquinaId) ?? null
        : null,
      fechaPlanificada: meta.fechaPlanificada,
      turno: meta.turno,
    });
  }

  return result.sort((a, b) => a.orden - b.orden);
}
