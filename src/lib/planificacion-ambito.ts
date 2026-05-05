/**
 * Ámbito de planificación (pool / mesa / ejecución) según rol y paso de itinerario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDbRole } from "@/lib/permissions";

export type PlanificacionTipoMaquina =
  | "impresion"
  | "digital"
  | "troquelado"
  | "engomado";

export type PlanificacionDraftScope = PlanificacionTipoMaquina | "todas";

export const PLANIFICACION_TIPOS_MAQUINA: PlanificacionTipoMaquina[] = [
  "impresion",
  "digital",
  "troquelado",
  "engomado",
];

/** Orden UI cuando el usuario ve todas las áreas: evita que la primera máquina sea siempre offset. */
const PLANIFICACION_TIPO_UI_ORDER: Record<PlanificacionTipoMaquina, number> = {
  digital: 0,
  troquelado: 1,
  engomado: 2,
  impresion: 3,
};

export type MaquinaPlanificacionSortRow = {
  tipo_maquina: string;
  orden_visual?: number | string | null;
  nombre: string;
};

export function sortMaquinasPlanificacionUiOrder<T extends MaquinaPlanificacionSortRow>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const ta =
      PLANIFICACION_TIPO_UI_ORDER[a.tipo_maquina as PlanificacionTipoMaquina] ??
      99;
    const tb =
      PLANIFICACION_TIPO_UI_ORDER[b.tipo_maquina as PlanificacionTipoMaquina] ??
      99;
    if (ta !== tb) return ta - tb;
    const oa = Number(a.orden_visual ?? 0);
    const ob = Number(b.orden_visual ?? 0);
    if (oa !== ob) return oa - ob;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

const DRAFT_SCOPES: PlanificacionDraftScope[] = [
  "impresion",
  "digital",
  "troquelado",
  "engomado",
  "todas",
];

export function isPlanificacionDraftScope(
  v: unknown,
): v is PlanificacionDraftScope {
  return typeof v === "string" && (DRAFT_SCOPES as string[]).includes(v);
}

/**
 * null = sin filtro por tipo de máquina (admin, gerencia, producción, resto con acceso).
 */
export function getPlanificacionTipoMaquinaFilter(
  role: string | null | undefined,
): PlanificacionTipoMaquina | null {
  const r = normalizeDbRole(role ?? null);
  if (!r) return null;
  if (r === "admin" || r === "gerencia" || r === "produccion") return null;
  if (r === "impresion") return "impresion";
  if (r === "digital") return "digital";
  if (r === "troquelado") return "troquelado";
  if (r === "engomado") return "engomado";
  return null;
}

/**
 * Filtro de pool/mesa por tipo de proceso: prioriza el rol de sección; si no hay
 * (admin/gerencia/producción), usa el `tipo_maquina` de la máquina seleccionada.
 */
export function planificacionTipoFiltroEfectivo(
  tipoDesdeRol: PlanificacionTipoMaquina | null,
  tipoMaquinaSeleccionada: string | null | undefined,
): PlanificacionTipoMaquina | null {
  if (tipoDesdeRol) return tipoDesdeRol;
  const t = String(tipoMaquinaSeleccionada ?? "").trim();
  if (
    (PLANIFICACION_TIPOS_MAQUINA as readonly string[]).includes(
      t as PlanificacionTipoMaquina,
    )
  ) {
    return t as PlanificacionTipoMaquina;
  }
  return null;
}

export function draftScopeFromTipoFilter(
  tipo: PlanificacionTipoMaquina | null,
): PlanificacionDraftScope {
  return tipo ?? "todas";
}

export function inferPlanificacionTipoFromProceso(
  seccionSlug: string | null | undefined,
  nombreProceso: string | null | undefined,
): PlanificacionTipoMaquina | null {
  const slug = (seccionSlug ?? "").toLowerCase().trim();
  const nom = (nombreProceso ?? "").toLowerCase().trim();
  if (!slug && !nom) return null;
  const s = `${slug} ${nom}`;
  if (s.includes("digital")) return "digital";
  if (s.includes("troquel")) return "troquelado";
  if (s.includes("engom")) return "engomado";
  if (slug.includes("offset") || s.includes("offset")) return "impresion";
  if (s.includes("impres") && !s.includes("digital")) return "impresion";
  return null;
}

export function etiquetaAmbitoPlanificacion(
  tipo: PlanificacionTipoMaquina | null,
): string {
  if (!tipo) return "Todas las áreas";
  if (tipo === "impresion") return "Impresión offset";
  if (tipo === "digital") return "Impresión digital";
  if (tipo === "troquelado") return "Troquelado";
  return "Engomado";
}

export type ProximoPasoInfo = {
  nombre: string;
  seccionSlug: string | null;
  tipoMaquina: PlanificacionTipoMaquina | null;
};

/**
 * Primer paso en estado `disponible` por OT (nº pedido), con catálogo de proceso.
 */
export async function fetchProximoPasoDisponiblePorOt(
  supabase: SupabaseClient,
  otNumeros: string[],
): Promise<Map<string, ProximoPasoInfo>> {
  const out = new Map<string, ProximoPasoInfo>();
  const nums = [
    ...new Set(
      otNumeros.map((n) => String(n).trim()).filter((n) => n.length > 0),
    ),
  ];
  if (nums.length === 0) return out;

  const { data: ogs, error: ogErr } = await supabase
    .from("prod_ots_general")
    .select("id, num_pedido")
    .in("num_pedido", nums);
  if (ogErr) throw ogErr;

  const idByNum = new Map<string, string>();
  for (const row of ogs ?? []) {
    const r = row as { id?: string; num_pedido?: string | null };
    const num = String(r.num_pedido ?? "").trim();
    const id = String(r.id ?? "").trim();
    if (num && id) idByNum.set(num, id);
  }

  const otIds = [...new Set([...idByNum.values()])];
  if (otIds.length === 0) return out;

  const { data: pasos, error: pErr } = await supabase
    .from("prod_ot_pasos")
    .select(
      "ot_id, orden, estado, prod_procesos_cat(nombre, seccion_slug)",
    )
    .in("ot_id", otIds)
    .eq("estado", "disponible")
    .order("orden", { ascending: true });
  if (pErr) throw pErr;

  type PasoRow = {
    ot_id?: string;
    prod_procesos_cat?: {
      nombre?: string | null;
      seccion_slug?: string | null;
    } | null;
  };

  const seenOtId = new Set<string>();
  for (const raw of (pasos ?? []) as PasoRow[]) {
    const otId = String(raw.ot_id ?? "").trim();
    if (!otId || seenOtId.has(otId)) continue;
    seenOtId.add(otId);
    let num: string | null = null;
    for (const [n, oid] of idByNum) {
      if (oid === otId) {
        num = n;
        break;
      }
    }
    if (!num) continue;
    const cat = raw.prod_procesos_cat;
    const nombre = String(cat?.nombre ?? "").trim() || "—";
    const slug =
      cat?.seccion_slug != null && String(cat.seccion_slug).trim()
        ? String(cat.seccion_slug).trim()
        : null;
    const tipoMaquina = inferPlanificacionTipoFromProceso(slug, nombre);
    out.set(num, { nombre, seccionSlug: slug, tipoMaquina });
  }

  return out;
}
