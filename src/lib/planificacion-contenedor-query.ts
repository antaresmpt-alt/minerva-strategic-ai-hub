import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PROD_OT_TIPOS,
  type ProdOtTipo,
  type ProdOtTipoHija,
} from "@/types/prod-ots";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

const TABLE_OTS = "prod_ots_general";
const TABLE_POOL = "prod_planificacion_pool";

/** OTs visibles en listados planificados por defecto (sin hijas sueltas). */
export const PLANIFICACION_OT_TIPOS_VISIBLE = ["simple", "contenedor"] as const;

export type PlanificacionOtTipoFiltroUi =
  | "agrupado"
  | "solo_simples"
  | "solo_contenedores"
  | "todas_planas";

export type OtContenedorMeta = {
  numPedido: string;
  otTipo: ProdOtTipo;
  otPadreNumero: string | null;
  tipoHija: ProdOtTipoHija | null;
  formaDescripcion: string | null;
  cliente: string | null;
  titulo: string | null;
  fechaEntrega: string | null;
};

export type ContenedorProgress = {
  total: number;
  completadas: number;
  pct: number | null;
};

type OtMetaRow = {
  num_pedido?: string | null;
  ot_tipo?: string | null;
  ot_padre_numero?: string | null;
  tipo_hija?: string | null;
  forma_descripcion?: string | null;
  cliente?: string | null;
  titulo?: string | null;
  fecha_entrega?: string | null;
};

export function normalizeOtTipo(value: unknown): ProdOtTipo {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if ((PROD_OT_TIPOS as readonly string[]).includes(v)) {
    return v as ProdOtTipo;
  }
  return "simple";
}

export function isOtVisibleInPlanificacionList(otTipo: ProdOtTipo): boolean {
  return otTipo === "simple" || otTipo === "contenedor";
}

export function formatHijaDisplayLabel(meta: {
  ot: string;
  tipoHija?: ProdOtTipoHija | null;
  formaDescripcion?: string | null;
  trabajo?: string | null;
}): string {
  const desc = String(meta.formaDescripcion ?? "").trim();
  if (desc) return desc;
  const tipo = String(meta.tipoHija ?? "").trim();
  if (tipo) return tipo;
  const trabajo = String(meta.trabajo ?? "").trim();
  if (trabajo && trabajo !== "—") return trabajo;
  return meta.ot;
}

export function computeContenedorProgress(
  hijaNumeros: string[],
  poolEstadoByOt: Map<string, string | null>,
): ContenedorProgress {
  const total = hijaNumeros.length;
  if (total === 0) return { total: 0, completadas: 0, pct: null };
  let completadas = 0;
  for (const ot of hijaNumeros) {
    const st = String(poolEstadoByOt.get(ot) ?? "")
      .trim()
      .toLowerCase();
    if (st === "cerrada") completadas += 1;
  }
  return {
    total,
    completadas,
    pct: Math.round((completadas / total) * 100),
  };
}

function mapOtMetaRow(row: OtMetaRow): OtContenedorMeta | null {
  const numPedido = String(row.num_pedido ?? "").trim();
  if (!numPedido) return null;
  const tipoHijaRaw = String(row.tipo_hija ?? "").trim();
  return {
    numPedido,
    otTipo: normalizeOtTipo(row.ot_tipo),
    otPadreNumero: String(row.ot_padre_numero ?? "").trim() || null,
    tipoHija: (["forma", "componente", "preimpresion", "acabado"] as const).includes(
      tipoHijaRaw as ProdOtTipoHija,
    )
      ? (tipoHijaRaw as ProdOtTipoHija)
      : null,
    formaDescripcion: String(row.forma_descripcion ?? "").trim() || null,
    cliente: row.cliente ?? null,
    titulo: row.titulo ?? null,
    fechaEntrega: row.fecha_entrega ?? null,
  };
}

const OT_META_SELECT =
  "num_pedido, ot_tipo, ot_padre_numero, tipo_hija, forma_descripcion, cliente, titulo, fecha_entrega";

export async function fetchOtMetaByNumPedidos(
  supabase: SupabaseClient,
  numPedidos: string[],
): Promise<Map<string, OtContenedorMeta>> {
  const unique = [...new Set(numPedidos.map((n) => String(n).trim()).filter(Boolean))];
  const out = new Map<string, OtContenedorMeta>();
  if (unique.length === 0) return out;

  const rows = await fetchAllInChunks(unique, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_OTS)
      .select(OT_META_SELECT)
      .in("num_pedido", chunk);
    if (error) throw error;
    return (data ?? []) as OtMetaRow[];
  });

  for (const row of rows) {
    const meta = mapOtMetaRow(row);
    if (meta) out.set(meta.numPedido, meta);
  }
  return out;
}

export async function fetchHijasByPadreNumeros(
  supabase: SupabaseClient,
  padreNumeros: string[],
): Promise<Map<string, OtContenedorMeta[]>> {
  const padres = [...new Set(padreNumeros.map((n) => String(n).trim()).filter(Boolean))];
  const out = new Map<string, OtContenedorMeta[]>();
  if (padres.length === 0) return out;

  const rows = await fetchAllInChunks(padres, 80, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_OTS)
      .select(OT_META_SELECT)
      .eq("ot_tipo", "hija")
      .in("ot_padre_numero", chunk);
    if (error) throw error;
    return (data ?? []) as OtMetaRow[];
  });

  for (const row of rows) {
    const meta = mapOtMetaRow(row);
    if (!meta?.otPadreNumero) continue;
    const list = out.get(meta.otPadreNumero) ?? [];
    list.push(meta);
    out.set(meta.otPadreNumero, list);
  }

  for (const [padre, list] of out) {
    list.sort((a, b) =>
      a.numPedido.localeCompare(b.numPedido, "es", { numeric: true, sensitivity: "base" }),
    );
    out.set(padre, list);
  }
  return out;
}

export async function fetchPoolEstadoByOtNumeros(
  supabase: SupabaseClient,
  otNumeros: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(otNumeros.map((n) => String(n).trim()).filter(Boolean))];
  const out = new Map<string, string | null>();
  if (unique.length === 0) return out;

  const rows = await fetchAllInChunks(unique, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_POOL)
      .select("ot_numero, estado_pool")
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as Array<{ ot_numero?: string | null; estado_pool?: string | null }>;
  });

  for (const row of rows) {
    const ot = String(row.ot_numero ?? "").trim();
    if (!ot || out.has(ot)) continue;
    out.set(ot, row.estado_pool ?? null);
  }
  return out;
}

export function matchesPlanificacionOtTipoFiltro(
  otTipo: ProdOtTipo,
  filtro: PlanificacionOtTipoFiltroUi,
): boolean {
  switch (filtro) {
    case "agrupado":
      return isOtVisibleInPlanificacionList(otTipo);
    case "solo_simples":
      return otTipo === "simple";
    case "solo_contenedores":
      return otTipo === "contenedor";
    case "todas_planas":
      return true;
    default:
      return isOtVisibleInPlanificacionList(otTipo);
  }
}
