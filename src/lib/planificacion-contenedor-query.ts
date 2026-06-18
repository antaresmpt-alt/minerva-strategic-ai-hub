import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeCompraEstado } from "@/lib/compras-material-estados";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import {
  PROD_OT_TIPOS,
  type ProdOtTipo,
  type ProdOtTipoHija,
} from "@/types/prod-ots";

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
  /** Nº hijas del contenedor */
  total: number;
  /** Hijas con pool `cerrada` (itinerario completo) */
  completadas: number;
  /** % pasos finalizados en todas las hijas (métrica principal UI) */
  pct: number | null;
  pasosCompletados: number;
  pasosTotal: number;
  /** % hijas cerradas (secundario) */
  hijasCerradasPct: number | null;
};

type PasoEstadoRow = { ot_id?: string | null; estado?: string | null };

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
  numPedidoToOtId: Map<string, string>,
  pasosByOtId: Map<string, PasoEstadoRow[]>,
  poolEstadoByOt: Map<string, string | null>,
): ContenedorProgress {
  const total = hijaNumeros.length;
  if (total === 0) {
    return {
      total: 0,
      completadas: 0,
      pct: null,
      pasosCompletados: 0,
      pasosTotal: 0,
      hijasCerradasPct: null,
    };
  }

  let completadas = 0;
  let pasosCompletados = 0;
  let pasosTotal = 0;

  for (const num of hijaNumeros) {
    const st = String(poolEstadoByOt.get(num) ?? "")
      .trim()
      .toLowerCase();
    if (st === "cerrada") completadas += 1;

    const otId = numPedidoToOtId.get(num);
    if (!otId) continue;
    const pasos = pasosByOtId.get(otId) ?? [];
    pasosTotal += pasos.length;
    pasosCompletados += pasos.filter(
      (p) => String(p.estado ?? "").trim().toLowerCase() === "finalizado",
    ).length;
  }

  return {
    total,
    completadas,
    pasosCompletados,
    pasosTotal,
    pct:
      pasosTotal > 0 ? Math.round((pasosCompletados / pasosTotal) * 100) : null,
    hijasCerradasPct: Math.round((completadas / total) * 100),
  };
}

/** Progreso agregado del barco por padre (pasos + hijas cerradas). */
export async function fetchContenedorProgressByPadre(
  supabase: SupabaseClient,
  hijasByPadre: Map<string, OtContenedorMeta[]>,
): Promise<Map<string, ContenedorProgress>> {
  const out = new Map<string, ContenedorProgress>();
  if (hijasByPadre.size === 0) return out;

  const allHijas = [...hijasByPadre.values()].flatMap((list) => list);
  const hijaNumeros = [...new Set(allHijas.map((h) => h.numPedido).filter(Boolean))];
  if (hijaNumeros.length === 0) return out;

  const idRows = await fetchAllInChunks(hijaNumeros, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_OTS)
      .select("id, num_pedido")
      .in("num_pedido", chunk);
    if (error) throw error;
    return (data ?? []) as Array<{ id?: string | null; num_pedido?: string | null }>;
  });

  const numPedidoToOtId = new Map<string, string>();
  const otIds: string[] = [];
  for (const row of idRows) {
    const num = String(row.num_pedido ?? "").trim();
    const id = String(row.id ?? "").trim();
    if (!num || !id) continue;
    numPedidoToOtId.set(num, id);
    otIds.push(id);
  }

  const poolEstadoByOt = await fetchPoolEstadoByOtNumeros(supabase, hijaNumeros);

  const pasosByOtId = new Map<string, PasoEstadoRow[]>();
  if (otIds.length > 0) {
    const pasoRows = await fetchAllInChunks(otIds, 80, async (chunk) => {
      const { data, error } = await supabase
        .from("prod_ot_pasos")
        .select("ot_id, estado")
        .in("ot_id", chunk);
      if (error) throw error;
      return (data ?? []) as PasoEstadoRow[];
    });
    for (const row of pasoRows) {
      const otId = String(row.ot_id ?? "").trim();
      if (!otId) continue;
      const list = pasosByOtId.get(otId) ?? [];
      list.push(row);
      pasosByOtId.set(otId, list);
    }
  }

  for (const [padre, hijas] of hijasByPadre) {
    out.set(
      padre,
      computeContenedorProgress(
        hijas.map((h) => h.numPedido),
        numPedidoToOtId,
        pasosByOtId,
        poolEstadoByOt,
      ),
    );
  }
  return out;
}

export function formatContenedorProgressBadge(prog: ContenedorProgress | undefined): string {
  if (!prog || prog.total <= 0) return "";
  const hijasLabel = `${prog.total} hija${prog.total === 1 ? "" : "s"}`;
  if (prog.pct == null) return hijasLabel;
  const pasosDetail =
    prog.pasosTotal > 0 ? ` · ${prog.pasosCompletados}/${prog.pasosTotal} pasos` : "";
  const cerradasDetail =
    prog.completadas > 0 ? ` · ${prog.completadas}/${prog.total} cerradas` : "";
  return `${hijasLabel} · ${prog.pct}%${pasosDetail}${cerradasDetail}`;
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

export type PoolMaterialBarcoPadre = {
  ot: string;
  material: string | null;
  hojasObjetivo: number;
  hojasRecibidasTotal: number;
  hasCompraGenerada: boolean;
  compraEstado: string;
  numCompra: string | null;
  compraProveedor: string | null;
  materialStatus: "verde" | "amarillo" | "rojo";
};

export type PoolMaterialBarcoHijaInput = {
  materialHija: string | null;
  hojasObjetivoHija: number;
};

export type PoolMaterialBarcoResult = {
  hasCompraGenerada: boolean;
  materialStatus: "verde" | "amarillo" | "rojo";
  hojasRecibidasTotal: number;
  hojasObjetivo: number;
  numCompra: string | null;
  compraEstado: string;
  compraProveedor: string | null;
  materialViaBarcoLabel: string | null;
};

function normalizeMaterialToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Material hija compatible con compra del padre (mismo papel o hija sin material explícito). */
export function isMaterialCompatibleBarco(
  materialHija: string | null | undefined,
  materialPadre: string | null | undefined,
): boolean {
  const padre = normalizeMaterialToken(materialPadre);
  if (!padre || padre === "—") return false;
  const hija = normalizeMaterialToken(materialHija);
  if (!hija || hija === "—") return true;
  return hija === padre || padre.includes(hija) || hija.includes(padre);
}

export function isCompraPadreRecibida(
  compraEstado: string,
  hojasRecibidasTotal: number,
): boolean {
  const n = normalizeCompraEstado(compraEstado);
  if (n === "recibido" || n === "recibido parcial") return true;
  return hojasRecibidasTotal > 0;
}

export function materialViaBarcoLabel(padreOt: string): string {
  return `Material vía barco ${padreOt}`;
}

/** Herencia de compra/material del contenedor para OT hija en Pool. */
export function resolvePoolMaterialHijaViaBarco(
  padre: PoolMaterialBarcoPadre,
  hija: PoolMaterialBarcoHijaInput,
): PoolMaterialBarcoResult {
  const hojasObjetivo = Math.max(0, Math.trunc(hija.hojasObjetivoHija));
  const sinHerencia: PoolMaterialBarcoResult = {
    hasCompraGenerada: false,
    materialStatus: "rojo",
    hojasRecibidasTotal: 0,
    hojasObjetivo,
    numCompra: null,
    compraEstado: "Sin compra",
    compraProveedor: null,
    materialViaBarcoLabel: null,
  };

  if (
    !padre.hasCompraGenerada ||
    !isMaterialCompatibleBarco(hija.materialHija, padre.material)
  ) {
    return sinHerencia;
  }

  const recibida = isCompraPadreRecibida(padre.compraEstado, padre.hojasRecibidasTotal);
  if (!recibida) {
    return {
      ...sinHerencia,
      hasCompraGenerada: true,
      compraEstado: padre.compraEstado,
      numCompra: padre.numCompra,
      compraProveedor: padre.compraProveedor,
      materialViaBarcoLabel: materialViaBarcoLabel(padre.ot),
      materialStatus: "rojo",
    };
  }

  let materialStatus: "verde" | "amarillo" | "rojo" = "rojo";
  if (padre.hojasRecibidasTotal <= 0) {
    materialStatus = "rojo";
  } else if (hojasObjetivo <= 0 || padre.hojasRecibidasTotal >= hojasObjetivo) {
    materialStatus = "verde";
  } else {
    materialStatus = "amarillo";
  }

  return {
    hasCompraGenerada: true,
    materialStatus,
    hojasRecibidasTotal: padre.hojasRecibidasTotal,
    hojasObjetivo,
    numCompra: padre.numCompra,
    compraEstado: padre.compraEstado,
    compraProveedor: padre.compraProveedor,
    materialViaBarcoLabel: materialViaBarcoLabel(padre.ot),
  };
}

export function poolMaterialBarcoPadreFromRow(row: {
  ot: string;
  material: string;
  hojasObjetivo: number;
  hojasRecibidasTotal: number;
  hasCompraGenerada: boolean;
  compraEstado: string;
  numCompra: string | null;
  compraProveedor: string | null;
  materialStatus: "verde" | "amarillo" | "rojo";
}): PoolMaterialBarcoPadre {
  const material = String(row.material ?? "").trim();
  return {
    ot: row.ot,
    material: material && material !== "—" ? material : null,
    hojasObjetivo: row.hojasObjetivo,
    hojasRecibidasTotal: row.hojasRecibidasTotal,
    hasCompraGenerada: row.hasCompraGenerada,
    compraEstado: row.compraEstado,
    numCompra: row.numCompra,
    compraProveedor: row.compraProveedor,
    materialStatus: row.materialStatus,
  };
}

export function isPoolRowSelectableForMesa(row: {
  otTipo: ProdOtTipo;
  hasCompraGenerada: boolean;
}): boolean {
  if (row.otTipo === "contenedor") return false;
  return row.hasCompraGenerada;
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
