/**
 * Ámbito de planificación (pool / mesa / ejecución) según rol y paso de itinerario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

import { normalizeDbRole } from "@/lib/permissions";

export type PlanificacionTipoMaquina =
  | "impresion"
  | "digital"
  | "troquelado"
  | "engomado"
  | "preimpresion"
  | "guillotina"
  | "desbroce";

export type PlanificacionDraftScope = PlanificacionTipoMaquina | "todas";

export const PLANIFICACION_TIPOS_MAQUINA: PlanificacionTipoMaquina[] = [
  "preimpresion",
  "guillotina",
  "impresion",
  "digital",
  "troquelado",
  "desbroce",
  "engomado",
];

/** Orden UI cuando el usuario ve todas las áreas: evita que la primera máquina sea siempre offset. */
const PLANIFICACION_TIPO_UI_ORDER: Record<PlanificacionTipoMaquina, number> = {
  preimpresion: 0,
  guillotina: 1,
  digital: 2,
  troquelado: 3,
  desbroce: 4,
  engomado: 5,
  impresion: 6,
};

export function parsePlanificacionTipoMaquina(
  raw: string | null | undefined,
): PlanificacionTipoMaquina | null {
  const t = String(raw ?? "").trim();
  if ((PLANIFICACION_TIPOS_MAQUINA as readonly string[]).includes(t)) {
    return t as PlanificacionTipoMaquina;
  }
  return null;
}

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
  "preimpresion",
  "guillotina",
  "impresion",
  "digital",
  "troquelado",
  "desbroce",
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
  if (r === "preimpresion") return "preimpresion";
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
  if (s.includes("preimpres") || s.includes("ctp")) return "preimpresion";
  if (s.includes("guillot")) return "guillotina";
  if (s.includes("desbroc")) return "desbroce";
  if (s.includes("digital")) return "digital";
  if (s.includes("engom") || s.includes("manipul")) return "engomado";
  if (s.includes("troquel")) return "troquelado";
  if (slug.includes("offset") || s.includes("offset")) return "impresion";
  if (s.includes("impres") && !s.includes("digital")) return "impresion";
  return null;
}

export function etiquetaAmbitoPlanificacion(
  tipo: PlanificacionTipoMaquina | null,
): string {
  if (!tipo) return "Todas las áreas";
  if (tipo === "preimpresion") return "CTP / Preimpresión";
  if (tipo === "guillotina") return "Guillotina";
  if (tipo === "impresion") return "Impresión offset";
  if (tipo === "digital") return "Impresión digital";
  if (tipo === "troquelado") return "Troquelado";
  if (tipo === "desbroce") return "Desbroce";
  return "Engomado";
}

export type ProximoPasoInfo = {
  nombre: string;
  seccionSlug: string | null;
  tipoPlanificacionDb: string | null;
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

  const ogRows = await fetchAllInChunks(nums, 100, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ots_general")
      .select("id, num_pedido")
      .in("num_pedido", chunk);
    if (error) throw error;
    return data ?? [];
  });

  const idByNum = new Map<string, string>();
  for (const row of ogRows) {
    const r = row as { id?: string; num_pedido?: string | null };
    const num = String(r.num_pedido ?? "").trim();
    const id = String(r.id ?? "").trim();
    if (num && id) idByNum.set(num, id);
  }

  const otIds = [...new Set([...idByNum.values()])];
  if (otIds.length === 0) return out;

  const pasoRows = await fetchAllInChunks(otIds, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ot_pasos")
      .select(
        "ot_id, orden, estado, prod_procesos_cat(nombre, seccion_slug, tipo_planificacion)",
      )
      .in("ot_id", chunk)
      .eq("estado", "disponible")
      .order("orden", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

  type PasoRow = {
    ot_id?: string;
    prod_procesos_cat?: {
      nombre?: string | null;
      seccion_slug?: string | null;
      tipo_planificacion?: string | null;
    } | null;
  };

  const seenOtId = new Set<string>();
  for (const raw of pasoRows as PasoRow[]) {
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
    const tipoFromDb =
      cat?.tipo_planificacion != null &&
      String(cat.tipo_planificacion).trim().length > 0
        ? String(cat.tipo_planificacion).trim().toLowerCase()
        : null;
    const tipoMaquina =
      parsePlanificacionTipoMaquina(tipoFromDb) ??
      inferPlanificacionTipoFromProceso(slug, nombre);
    out.set(num, {
      nombre,
      seccionSlug: slug,
      tipoPlanificacionDb: tipoFromDb,
      tipoMaquina,
    });
  }

  return out;
}
