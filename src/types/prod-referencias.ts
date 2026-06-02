/** Fila de `prod_referencias` (Referencia Minerva: agrupador de repeticiones y maestro de artículos). */
export type ProdReferenciaRow = {
  id: string;
  codigo: string;
  referencia_cliente: string | null;
  descripcion: string | null;
  cliente: string | null;

  /** Tipo de artículo: estuche, etiqueta, prospecto, manual, caja, otro… */
  tipo_producto: string | null;
  subtipo: string | null;
  /** false = discontinuado, no aparece en picker de despacho */
  activo: boolean;

  /** Dimensiones en mm */
  formato_largo_mm: number | null;
  formato_ancho_mm: number | null;
  formato_fondo_mm: number | null;

  /** Sugerencias técnicas por defecto (pre-rellenan el modal de despacho) */
  material_habitual: string | null;
  poses_habitual: number | null;
  troquel_habitual: string | null;
  tintas_habituales: string | null;
  acabado_habitual: string | null;
  ruta_habitual: string | null;

  /** Trazabilidad histórica (actualizado automáticamente por el sistema) */
  ultima_ot_numero: string | null;
  ultima_ot_fecha: string | null;
  total_repeticiones: number;

  notas: string | null;

  created_at: string | null;
  updated_at: string | null;
};

/** Fila de `prod_despacho_materiales_lineas` (líneas de material flexibles del despacho). */
export type ProdDespachoMaterialLineaRow = {
  id: string;
  ot_numero: string;
  tipo: string | null;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  orden: number | null;
  notas: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Tipos de línea de material sugeridos para el despacho flexible. */
export const DESPACHO_MATERIAL_LINEA_TIPOS = [
  "material",
  "tinta",
  "proceso_especial",
  "merma",
  "otro",
] as const;

export type DespachoMaterialLineaTipo =
  (typeof DESPACHO_MATERIAL_LINEA_TIPOS)[number];

/** Tipos de producto para el maestro de artículos */
export const ARTICULO_TIPO_PRODUCTO_OPTIONS = [
  "estuche",
  "etiqueta",
  "prospecto",
  "manual",
  "caja",
  "caja display",
  "otro",
] as const;

export type ArticuloTipoProducto = (typeof ARTICULO_TIPO_PRODUCTO_OPTIONS)[number];

/** Estructura de una fila del Excel de artículos (importación) */
export type ArticuloExcelRow = {
  codigo?: string | null;
  referencia_cliente?: string | null;
  descripcion?: string | null;
  cliente?: string | null;
  tipo_producto?: string | null;
  subtipo?: string | null;
  activo?: string | null;
  formato_largo_mm?: string | number | null;
  formato_ancho_mm?: string | number | null;
  formato_fondo_mm?: string | number | null;
  material_habitual?: string | null;
  poses_habitual?: string | number | null;
  troquel_habitual?: string | null;
  tintas_habituales?: string | null;
  acabado_habitual?: string | null;
  ruta_habitual?: string | null;
  notas?: string | null;
};
