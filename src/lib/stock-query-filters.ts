import type { StockEstadoDerivado } from "@/types/prod-stock";

/** Intención de agregación sobre el conjunto filtrado. */
export type StockQueryAgregacion =
  | "listar"
  | "contar"
  | "sumar_libre"
  | "sumar_fisico"
  | "sumar_reservado";

/** Criterios estructurados extraídos del lenguaje natural (9.9). */
export type StockQueryFilters = {
  material_contiene?: string;
  codigo_articulo_contiene?: string;
  formato_contiene?: string;
  ubicacion_fila?: string;
  nota_entrega_contiene?: string;
  proveedor_contiene?: string;
  gramaje_min?: number;
  gramaje_max?: number;
  gramaje_exacto?: number;
  libre_min?: number;
  libre_max?: number;
  fisico_min?: number;
  fisico_max?: number;
  reservado_min?: number;
  id_stock?: number;
  estado_derivado?: StockEstadoDerivado | StockEstadoDerivado[];
  sin_ot?: boolean;
  solo_libre?: boolean;
  solo_reservado?: boolean;
  ot_numero?: string;
  incluir_prueba?: boolean;
  agregacion?: StockQueryAgregacion;
  limite?: number;
};

export type StockQueryFiltersPayload = {
  interpretacion?: string;
  filtros?: StockQueryFilters;
};

const ESTADOS: StockEstadoDerivado[] = [
  "disponible",
  "parcial",
  "reservado",
  "agotado",
];

const AGREGACIONES: StockQueryAgregacion[] = [
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

function cleanEstado(v: unknown): StockEstadoDerivado | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase() as StockEstadoDerivado;
  return ESTADOS.includes(s) ? s : undefined;
}

function cleanAgregacion(v: unknown): StockQueryAgregacion | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase() as StockQueryAgregacion;
  return AGREGACIONES.includes(s) ? s : undefined;
}

/** Normaliza OT: «OT 36083» → «36083». */
export function normalizeOtNumero(raw: string): string {
  return raw.replace(/^OT\s*/i, "").trim();
}

/** Escapa comodines para filtros ilike de PostgREST. */
export function safeIlikeTerm(raw: string): string {
  return raw.replace(/[%_\\]/g, "").trim().slice(0, 80);
}

/**
 * Valida y sanea el JSON devuelto por el LLM.
 * Devuelve filtros vacíos si el payload no es usable.
 */
export function parseStockQueryFiltersPayload(
  raw: unknown,
): { interpretacion: string; filtros: StockQueryFilters } {
  const root =
    raw != null && typeof raw === "object"
      ? (raw as StockQueryFiltersPayload)
      : {};

  const interpretacion =
    cleanText(root.interpretacion, 240) ?? "Consulta de stock";

  const src = root.filtros ?? {};
  const filtros: StockQueryFilters = {};

  const material = cleanText(src.material_contiene);
  if (material) filtros.material_contiene = safeIlikeTerm(material);

  const codigo = cleanText(src.codigo_articulo_contiene);
  if (codigo) filtros.codigo_articulo_contiene = safeIlikeTerm(codigo);

  const formato = cleanText(src.formato_contiene);
  if (formato) filtros.formato_contiene = safeIlikeTerm(formato);

  const ubicacion = cleanText(src.ubicacion_fila);
  if (ubicacion) filtros.ubicacion_fila = ubicacion.slice(0, 60);

  const albaran = cleanText(src.nota_entrega_contiene);
  if (albaran) filtros.nota_entrega_contiene = safeIlikeTerm(albaran);

  const proveedor = cleanText(src.proveedor_contiene);
  if (proveedor) filtros.proveedor_contiene = safeIlikeTerm(proveedor);

  const gMin = cleanNum(src.gramaje_min);
  if (gMin != null) filtros.gramaje_min = gMin;
  const gMax = cleanNum(src.gramaje_max);
  if (gMax != null) filtros.gramaje_max = gMax;
  const gEx = cleanNum(src.gramaje_exacto);
  if (gEx != null) filtros.gramaje_exacto = gEx;

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

  const idStock = cleanInt(src.id_stock);
  if (idStock != null && idStock > 0) filtros.id_stock = idStock;

  const estadoRaw = src.estado_derivado;
  if (Array.isArray(estadoRaw)) {
    const estados = estadoRaw
      .map(cleanEstado)
      .filter((e): e is StockEstadoDerivado => !!e);
    if (estados.length) filtros.estado_derivado = estados;
  } else {
    const e = cleanEstado(estadoRaw);
    if (e) filtros.estado_derivado = e;
  }

  const sinOt = cleanBool(src.sin_ot);
  if (sinOt) filtros.sin_ot = true;
  const soloLibre = cleanBool(src.solo_libre);
  if (soloLibre) filtros.solo_libre = true;
  const soloRes = cleanBool(src.solo_reservado);
  if (soloRes) filtros.solo_reservado = true;

  const ot = cleanText(src.ot_numero, 32);
  if (ot) filtros.ot_numero = normalizeOtNumero(ot);

  const incluirPrueba = cleanBool(src.incluir_prueba);
  if (incluirPrueba) filtros.incluir_prueba = true;

  const agregacion = cleanAgregacion(src.agregacion);
  if (agregacion) filtros.agregacion = agregacion;

  const limite = cleanInt(src.limite);
  if (limite != null && limite > 0) {
    filtros.limite = Math.min(limite, 120);
  }

  return { interpretacion, filtros };
}

export function isStockAggregation(
  ag?: StockQueryAgregacion,
): ag is Exclude<StockQueryAgregacion, "listar"> {
  return !!ag && ag !== "listar";
}

export const DEFAULT_STOCK_QUERY_LIMIT = 50;
export const STOCK_AGGREGATION_FETCH_LIMIT = 2000;
