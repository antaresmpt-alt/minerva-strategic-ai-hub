import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

/** Progreso agregado del itinerario para colorear pastillas del calendario. */
export type CalendarioOtProgreso =
  | "sin_itinerario"
  | "sin_empezar"
  | "en_curso"
  | "completa";

export type CalendarioPasoResumen = {
  orden: number;
  nombre: string;
  estado: string;
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

/** Estilos pastilla: badge del nº OT + borde izquierdo. */
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

type OtIdRow = { id: string; num_pedido: string };
type PasoEstadoRow = {
  ot_id: string;
  orden: number | null;
  estado: string | null;
  prod_procesos_cat:
    | { nombre: string | null }
    | { nombre: string | null }[]
    | null;
};

function pickProcesoNombre(
  cat: PasoEstadoRow["prod_procesos_cat"],
): string {
  if (Array.isArray(cat)) return String(cat[0]?.nombre ?? "").trim() || "—";
  return String(cat?.nombre ?? "").trim() || "—";
}

/**
 * Carga progreso agregado por nº OT (batch).
 * No bloquea el calendario si falla: el llamador puede dejar mapa vacío.
 */
export async function fetchProgresoByOtNumeros(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, CalendarioOtProgreso>> {
  const out = new Map<string, CalendarioOtProgreso>();
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
    if (!knownOts.has(ot)) out.set(ot, "sin_itinerario");
  }

  const otIds = [...idToOt.keys()];
  if (otIds.length === 0) return out;

  const pasoRows = await fetchAllInChunks(otIds, 100, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ot_pasos")
      .select("ot_id, orden, estado")
      .in("ot_id", chunk);
    if (error) throw error;
    return (data ?? []) as Pick<PasoEstadoRow, "ot_id" | "orden" | "estado">[];
  });

  const estadosByOt = new Map<string, string[]>();
  for (const p of pasoRows) {
    const ot = idToOt.get(String(p.ot_id ?? "").trim());
    if (!ot) continue;
    const list = estadosByOt.get(ot) ?? [];
    list.push(String(p.estado ?? ""));
    estadosByOt.set(ot, list);
  }

  for (const ot of ots) {
    out.set(ot, progresoFromEstados(estadosByOt.get(ot) ?? []));
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
