/**
 * Filtros NL → consulta segura sobre stock_articulos_atp (Bloque 15).
 */

import type { StockArticuloEstadoDerivado } from "@/types/prod-stock-articulos";
import type { StockArticuloEstadoProceso } from "@/types/prod-stock-articulos";
import type { StockArticuloUnidad } from "@/types/prod-stock-articulos";

export type StockArticulosQueryAgregacion =
  | "listar"
  | "contar"
  | "sumar_libre"
  | "sumar_fisico"
  | "sumar_reservado";

export type StockArticulosQueryFilters = {
  cliente_contiene?: string;
  referencia_cliente_contiene?: string;
  referencia_codigo_contiene?: string;
  descripcion_contiene?: string;
  ubicacion_contiene?: string;
  ot_origen?: string;
  unidad?: StockArticuloUnidad;
  estado_proceso?: StockArticuloEstadoProceso | StockArticuloEstadoProceso[];
  estado_derivado?: StockArticuloEstadoDerivado | StockArticuloEstadoDerivado[];
  libre_min?: number;
  libre_max?: number;
  fisico_min?: number;
  fisico_max?: number;
  reservado_min?: number;
  solo_libre?: boolean;
  solo_reservado?: boolean;
  /** Solo PT: unidad uds + proceso terminado. */
  solo_pt?: boolean;
  incluir_agotados?: boolean;
  agregacion?: StockArticulosQueryAgregacion;
  limite?: number;
};

export type StockArticulosQueryFiltersPayload = {
  interpretacion?: string;
  filtros?: StockArticulosQueryFilters;
};

export const DEFAULT_STOCK_ARTICULOS_QUERY_LIMIT = 80;

const ESTADOS: StockArticuloEstadoDerivado[] = [
  "disponible",
  "parcial",
  "reservado",
  "agotado",
];

const PROCESOS: StockArticuloEstadoProceso[] = [
  "terminado",
  "impreso",
  "troquelado",
  "otro",
];

const UNIDADES: StockArticuloUnidad[] = ["uds", "hojas"];

const AGREGACIONES: StockArticulosQueryAgregacion[] = [
  "listar",
  "contar",
  "sumar_libre",
  "sumar_fisico",
  "sumar_reservado",
];

function cleanText(v: unknown, max = 80): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : undefined;
}

function cleanNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function cleanInt(v: unknown): number | undefined {
  const n = cleanNum(v);
  if (n == null) return undefined;
  return Math.trunc(n);
}

function cleanBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

export function safeIlikeTermArticulos(raw: string): string {
  return raw.replace(/[%_\\]/g, "").trim().slice(0, 80);
}

export function isStockArticulosAggregation(
  v: StockArticulosQueryAgregacion | undefined
): boolean {
  return v != null && v !== "listar";
}

export function parseStockArticulosQueryFiltersPayload(raw: unknown): {
  interpretacion: string;
  filtros: StockArticulosQueryFilters;
} {
  const root =
    raw != null && typeof raw === "object"
      ? (raw as StockArticulosQueryFiltersPayload)
      : {};

  const interpretacion =
    cleanText(root.interpretacion, 240) ?? "Consulta de stock de artículos";

  const src = root.filtros ?? {};
  const filtros: StockArticulosQueryFilters = {};

  const cliente = cleanText(src.cliente_contiene);
  if (cliente) filtros.cliente_contiene = safeIlikeTermArticulos(cliente);

  const refCli = cleanText(src.referencia_cliente_contiene);
  if (refCli) filtros.referencia_cliente_contiene = safeIlikeTermArticulos(refCli);

  const refCod = cleanText(src.referencia_codigo_contiene);
  if (refCod) filtros.referencia_codigo_contiene = safeIlikeTermArticulos(refCod);

  const desc = cleanText(src.descripcion_contiene);
  if (desc) filtros.descripcion_contiene = safeIlikeTermArticulos(desc);

  const ubic = cleanText(src.ubicacion_contiene);
  if (ubic) filtros.ubicacion_contiene = safeIlikeTermArticulos(ubic);

  const ot = cleanText(src.ot_origen, 40);
  if (ot) filtros.ot_origen = ot.replace(/^OT\s*/i, "").trim();

  if (typeof src.unidad === "string") {
    const u = src.unidad.trim().toLowerCase() as StockArticuloUnidad;
    if (UNIDADES.includes(u)) filtros.unidad = u;
  }

  if (Array.isArray(src.estado_proceso)) {
    const procs = src.estado_proceso
      .map((p) =>
        typeof p === "string"
          ? (p.trim().toLowerCase() as StockArticuloEstadoProceso)
          : null
      )
      .filter((p): p is StockArticuloEstadoProceso => !!p && PROCESOS.includes(p));
    if (procs.length === 1) filtros.estado_proceso = procs[0];
    else if (procs.length > 1) filtros.estado_proceso = procs;
  } else if (typeof src.estado_proceso === "string") {
    const p = src.estado_proceso.trim().toLowerCase() as StockArticuloEstadoProceso;
    if (PROCESOS.includes(p)) filtros.estado_proceso = p;
  }

  if (Array.isArray(src.estado_derivado)) {
    const ests = src.estado_derivado
      .map((e) =>
        typeof e === "string"
          ? (e.trim().toLowerCase() as StockArticuloEstadoDerivado)
          : null
      )
      .filter((e): e is StockArticuloEstadoDerivado => !!e && ESTADOS.includes(e));
    if (ests.length === 1) filtros.estado_derivado = ests[0];
    else if (ests.length > 1) filtros.estado_derivado = ests;
  } else if (typeof src.estado_derivado === "string") {
    const e = src.estado_derivado.trim().toLowerCase() as StockArticuloEstadoDerivado;
    if (ESTADOS.includes(e)) filtros.estado_derivado = e;
  }

  const libMin = cleanInt(src.libre_min);
  if (libMin != null) filtros.libre_min = Math.max(0, libMin);
  const libMax = cleanInt(src.libre_max);
  if (libMax != null) filtros.libre_max = Math.max(0, libMax);
  const fisMin = cleanInt(src.fisico_min);
  if (fisMin != null) filtros.fisico_min = Math.max(0, fisMin);
  const fisMax = cleanInt(src.fisico_max);
  if (fisMax != null) filtros.fisico_max = Math.max(0, fisMax);
  const resMin = cleanInt(src.reservado_min);
  if (resMin != null) filtros.reservado_min = Math.max(0, resMin);

  const soloLibre = cleanBool(src.solo_libre);
  if (soloLibre != null) filtros.solo_libre = soloLibre;
  const soloRes = cleanBool(src.solo_reservado);
  if (soloRes != null) filtros.solo_reservado = soloRes;
  const soloPt = cleanBool(src.solo_pt);
  if (soloPt != null) filtros.solo_pt = soloPt;
  const inclAg = cleanBool(src.incluir_agotados);
  if (inclAg != null) filtros.incluir_agotados = inclAg;

  if (typeof src.agregacion === "string") {
    const a = src.agregacion.trim().toLowerCase() as StockArticulosQueryAgregacion;
    if (AGREGACIONES.includes(a)) filtros.agregacion = a;
  }

  const lim = cleanInt(src.limite);
  if (lim != null) {
    filtros.limite = Math.min(120, Math.max(1, lim));
  }

  return { interpretacion, filtros };
}
