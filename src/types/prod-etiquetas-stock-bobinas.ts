/** Fila de `public.prod_etiquetas_stock_bobinas`. */
export type ProdEtiquetasStockBobinaRow = {
  id: string;
  papel: string;
  fabricante: string;
  codigo: string;
  unidades_stock: number;
  fecha_pedido: string | null;
  fecha_recepcion: string | null;
  ancho_mm: number | null;
  ubicacion: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};
