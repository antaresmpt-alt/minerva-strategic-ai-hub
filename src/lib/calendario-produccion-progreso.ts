import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
import { inferPlanificacionTipoFromProceso } from "@/lib/planificacion-ambito";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

/** Progreso agregado del itinerario (global OT). */
export type CalendarioOtProgreso =
  | "sin_itinerario"
  | "sin_empezar"
  | "en_curso"
  | "completa";

/**
 * Semáforo de la pastilla respecto al ámbito de esa pastilla
 * (Impresión / Digital / Troquel / Engomado).
 */
export type CalendarioSemaforoAmbito =
  | "sin_paso"
  | "esperando"
  | "listo"
  | "hecho";

export type CalendarioPasoResumen = {
  orden: number;
  nombre: string;
  estado: string;
};

export type CalendarioPasoTipado = {
  orden: number;
  estado: string;
  nombre: string;
  /** Ámbito calendario si el proceso mapea a I/D/T/E; null = CTP/guillotina/etc. */
  ambito: CalendarioAmbito | null;
};

/** Deriva progreso desde estados de `prod_ot_pasos`. */
export function progresoFromEstados(
  estados: readonly string[],
): CalendarioOtProgreso {
  const e = estados
    .map((s) => String(s ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (e.length === 0) return "sin_itinerario";
  if (e.every((x) => x === "finalizado")) return "completa";
  if (
    e.some(
      (x) => x === "finalizado" || x === "en_marcha" || x === "pausado",
    )
  ) {
    return "en_curso";
  }
  return "sin_empezar";
}

/**
 * Semáforo para una pastilla de ámbito concreto.
 * - hecho: todos los pasos de ese ámbito finalizados
 * - listo: algún paso del ámbito disponible / en marcha / pausado (o parcial)
 * - esperando: hay pasos del ámbito pero aún pendientes
 * - sin_paso: la OT no tiene ese proceso en el itinerario
 */
export function semaforoForAmbito(
  pasos: readonly CalendarioPasoTipado[],
  ambito: CalendarioAmbito,
): CalendarioSemaforoAmbito {
  const mine = pasos.filter((p) => p.ambito === ambito);
  if (mine.length === 0) return "sin_paso";
  const estados = mine.map((p) =>
    String(p.estado ?? "").trim().toLowerCase(),
  );
  if (estados.every((e) => e === "finalizado")) return "hecho";
  if (
    estados.some(
      (e) => e === "disponible" || e === "en_marcha" || e === "pausado",
    )
  ) {
    return "listo";
  }
  if (estados.some((e) => e === "finalizado")) return "listo";
  return "esperando";
}

/** Estilos pastilla: badge del nº OT + borde izquierdo (progreso global). */
export const PROGRESO_PILL_STYLES: Record<
  CalendarioOtProgreso,
  { otBadge: string; border: string; title: string }
> = {
  sin_itinerario: {
    otBadge: "bg-slate-100 text-slate-600",
    border: "border-l-slate-300",
    title: "Sin itinerario en Minerva",
  },
  sin_empezar: {
    otBadge: "bg-slate-200 text-slate-800",
    border: "border-l-slate-400",
    title: "Itinerario sin empezar",
  },
  en_curso: {
    otBadge: "bg-sky-100 text-sky-900",
    border: "border-l-sky-500",
    title: "En curso (algún paso iniciado o finalizado)",
  },
  completa: {
    otBadge: "bg-emerald-100 text-emerald-900",
    border: "border-l-emerald-600",
    title: "Itinerario completo",
  },
};

/** Estilos semáforo por ámbito de la pastilla. */
export const SEMAFORO_PILL_STYLES: Record<
  CalendarioSemaforoAmbito,
  { otBadge: string; border: string; title: string; dot: string }
> = {
  sin_paso: {
    otBadge: "bg-slate-100 text-slate-500",
    border: "border-l-slate-300",
    title: "Sin paso de este ámbito en el itinerario",
    dot: "bg-slate-300",
  },
  esperando: {
    otBadge: "bg-amber-100 text-amber-950",
    border: "border-l-amber-400",
    title: "Aún no disponible (upstream pendiente)",
    dot: "bg-amber-400",
  },
  listo: {
    otBadge: "bg-emerald-100 text-emerald-950",
    border: "border-l-emerald-500",
    title: "Listo: paso del ámbito disponible / en marcha",
    dot: "bg-emerald-500",
  },
  hecho: {
    otBadge: "bg-emerald-200 text-emerald-950",
    border: "border-l-emerald-700",
    title: "Hecho: paso(s) del ámbito finalizado(s)",
    dot: "bg-emerald-700",
  },
};

type OtIdRow = { id: string; num_pedido: string };
type PasoEstadoRow = {
  ot_id: string;
  orden: number | null;
  estado: string | null;
  prod_procesos_cat:
    | { nombre: string | null; seccion_slug?: string | null }
    | { nombre: string | null; seccion_slug?: string | null }[]
    | null;
};

function pickProcesoNombre(
  cat: PasoEstadoRow["prod_procesos_cat"],
): string {
  if (Array.isArray(cat)) return String(cat[0]?.nombre ?? "").trim() || "—";
  return String(cat?.nombre ?? "").trim() || "—";
}

function pickSeccionSlug(
  cat: PasoEstadoRow["prod_procesos_cat"],
): string | null {
  if (Array.isArray(cat)) {
    const s = String(cat[0]?.seccion_slug ?? "").trim();
    return s || null;
  }
  const s = String(cat?.seccion_slug ?? "").trim();
  return s || null;
}

function ambitoFromProceso(
  seccionSlug: string | null,
  nombre: string,
): CalendarioAmbito | null {
  const tipo = inferPlanificacionTipoFromProceso(seccionSlug, nombre);
  if (!tipo) return null;
  return isCalendarioAmbito(tipo) ? tipo : null;
}

export type CalendarioItinerarioOt = {
  progreso: CalendarioOtProgreso;
  pasos: CalendarioPasoTipado[];
};

/**
 * Carga progreso + pasos tipados por nº OT (batch) para semáforo de pastillas.
 */
export async function fetchItinerarioCalendarioByOtNumeros(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, CalendarioItinerarioOt>> {
  const out = new Map<string, CalendarioItinerarioOt>();
  const ots = [
    ...new Set(
      otNumeros.map((o) => String(o ?? "").trim()).filter(Boolean),
    ),
  ];
  if (ots.length === 0) return out;

  const otRows = await fetchAllInChunks(ots, 100, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ots_general")
      .select("id, num_pedido")
      .in("num_pedido", chunk);
    if (error) throw error;
    return (data ?? []) as OtIdRow[];
  });

  const idToOt = new Map<string, string>();
  const knownOts = new Set<string>();
  for (const r of otRows) {
    const id = String(r.id ?? "").trim();
    const num = String(r.num_pedido ?? "").trim();
    if (id && num) {
      idToOt.set(id, num);
      knownOts.add(num);
    }
  }

  for (const ot of ots) {
    if (!knownOts.has(ot)) {
      out.set(ot, { progreso: "sin_itinerario", pasos: [] });
    }
  }

  const otIds = [...idToOt.keys()];
  if (otIds.length === 0) return out;

  const pasoRows = await fetchAllInChunks(otIds, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ot_pasos")
      .select("ot_id, orden, estado, prod_procesos_cat(nombre, seccion_slug)")
      .in("ot_id", chunk)
      .order("orden", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PasoEstadoRow[];
  });

  const pasosByOt = new Map<string, CalendarioPasoTipado[]>();
  const estadosByOt = new Map<string, string[]>();
  for (const p of pasoRows) {
    const ot = idToOt.get(String(p.ot_id ?? "").trim());
    if (!ot) continue;
    const nombre = pickProcesoNombre(p.prod_procesos_cat);
    const seccion = pickSeccionSlug(p.prod_procesos_cat);
    const estado = String(p.estado ?? "pendiente").trim() || "pendiente";
    const tipado: CalendarioPasoTipado = {
      orden: typeof p.orden === "number" ? p.orden : 0,
      estado,
      nombre,
      ambito: ambitoFromProceso(seccion, nombre),
    };
    const list = pasosByOt.get(ot) ?? [];
    list.push(tipado);
    pasosByOt.set(ot, list);
    const est = estadosByOt.get(ot) ?? [];
    est.push(estado);
    estadosByOt.set(ot, est);
  }

  for (const ot of ots) {
    const pasos = (pasosByOt.get(ot) ?? []).sort((a, b) => a.orden - b.orden);
    out.set(ot, {
      progreso: progresoFromEstados(estadosByOt.get(ot) ?? []),
      pasos,
    });
  }
  return out;
}

/**
 * Carga progreso agregado por nº OT (batch).
 * No bloquea el calendario si falla: el llamador puede dejar mapa vacío.
 */
export async function fetchProgresoByOtNumeros(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, CalendarioOtProgreso>> {
  const full = await fetchItinerarioCalendarioByOtNumeros(supabase, otNumeros);
  const out = new Map<string, CalendarioOtProgreso>();
  for (const [ot, info] of full) {
    out.set(ot, info.progreso);
  }
  return out;
}

/** Pasos resumidos para el mini-modal (orden + nombre + estado). */
export async function fetchPasosResumenOt(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<CalendarioPasoResumen[]> {
  const ot = String(otNumero ?? "").trim();
  if (!ot) return [];

  const { data: otRow, error: otErr } = await supabase
    .from("prod_ots_general")
    .select("id")
    .eq("num_pedido", ot)
    .maybeSingle();
  if (otErr) throw otErr;
  const otId = String((otRow as { id?: string } | null)?.id ?? "").trim();
  if (!otId) return [];

  const { data, error } = await supabase
    .from("prod_ot_pasos")
    .select("orden, estado, prod_procesos_cat(nombre)")
    .eq("ot_id", otId)
    .order("orden", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as PasoEstadoRow[]).map((p) => ({
    orden: typeof p.orden === "number" ? p.orden : 0,
    nombre: pickProcesoNombre(p.prod_procesos_cat),
    estado: String(p.estado ?? "pendiente").trim() || "pendiente",
  }));
}
