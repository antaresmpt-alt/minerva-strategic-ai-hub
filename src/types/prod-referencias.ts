/** Fila de `prod_referencias` (Referencia Minerva: agrupador de repeticiones). */
export type ProdReferenciaRow = {
  id: string;
  codigo: string;
  referencia_cliente: string | null;
  descripcion: string | null;
  cliente: string | null;
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
