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

/** Obtiene el último movimiento de consumo del paso (para revertir). */
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

/** Revierte el consumo de cartela de un paso finalizado (9.8.5). */
export async function revertirConsumoPasoAdmin(
  supabase: SupabaseClient,
  params: {
    paletId: string;
    cantidad: number;
    otNumero: string;
    autorizadoPor: string;
    notas?: string | null;
    nuevoFormato?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc("prod_stock_revertir_consumo", {
    p_palet_id: params.paletId,
    p_cantidad: params.cantidad,
    p_ot_numero: params.otNumero,
    p_autorizado_por: params.autorizadoPor,
    p_notas: params.notas ?? null,
    p_nuevo_formato: params.nuevoFormato ?? null,
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
      .from("prod_mesa_trabajo")
      .update({ estado_mesa: "confirmado" })
      .eq("id", params.mesaTrabajoId);
    if (mesaErr) throw new Error(mesaErr.message || "No se pudo actualizar la mesa.");
  } else if (mesaTrabajoId) {
    const { error: mesaErr } = await supabase
      .from("prod_mesa_trabajo")
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
