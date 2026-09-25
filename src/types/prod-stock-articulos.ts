/**
 * Tipos Bloque 15 — stock de artículos (producto / WIP).
 * Tablas: prod_stock_articulos, prod_stock_articulos_reservas,
 *         prod_stock_articulos_movimientos
 * Vista: stock_articulos_atp (libre + estado_derivado calculados)
 */

export type StockArticuloUnidad = "uds" | "hojas";

export type StockArticuloEstadoProceso =
  | "terminado"
  | "impreso"
  | "troquelado"
  | "semielaborado"
  | "otro";

/** Estado ATP calculado — nunca persistido en el lote. */
export type StockArticuloEstadoDerivado =
  | "disponible"
  | "parcial"
  | "reservado"
  | "agotado";

export type StockArticuloMovimientoTipo =
  | "entrada"
  | "reserva"
  | "liberacion"
  | "consumo"
  | "ajuste"
  | "transformacion";

/** Fila `prod_stock_articulos`. */
export type ProdStockArticuloRow = {
  id: string;
  referencia_id: string;
  referencia_codigo: string;
  referencia_descripcion: string | null;
  referencia_cliente: string | null;
  /** Texto Optimus; null = usable por cualquier cliente. */
  cliente: string | null;
  cantidad_actual: number;
  unidad: StockArticuloUnidad;
  poses: number | null;
  estado_proceso: StockArticuloEstadoProceso;
  ot_origen: string | null;
  bultos: number | null;
  palets: number | null;
  ubicacion_fisica: string | null;
  cantidad_minima_alerta: number | null;
  notas: string | null;
  condicion: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Fila `prod_stock_articulos_reservas`. */
export type ProdStockArticuloReservaRow = {
  id: string;
  stock_articulo_id: string;
  ot_numero: string;
  num_pedido: string | null;
  cantidad_reservada: number;
  bultos_reservados: number | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
};

/** Fila `prod_stock_articulos_movimientos`. */
export type ProdStockArticuloMovimientoRow = {
  id: string;
  stock_articulo_id: string;
  tipo: StockArticuloMovimientoTipo;
  cantidad: number;
  bultos: number | null;
  ot_numero: string | null;
  num_pedido: string | null;
  stock_articulo_destino_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
};

/** Fila vista `stock_articulos_atp`. */
export type StockArticuloAtpRow = {
  id: string;
  referencia_id: string;
  referencia_codigo: string;
  referencia_descripcion: string | null;
  referencia_cliente: string | null;
  cliente: string | null;
  unidad: StockArticuloUnidad;
  poses: number | null;
  estado_proceso: StockArticuloEstadoProceso;
  ot_origen: string | null;
  bultos: number | null;
  palets: number | null;
  ubicacion_fisica: string | null;
  cantidad_minima_alerta: number | null;
  notas: string | null;
  condicion: string | null;
  created_at: string;
  updated_at: string;
  cantidad_fisica: number;
  cantidad_reservada_total: number;
  cantidad_libre: number;
  reservas_count: number;
  sobre_reservado: boolean;
  estado_derivado: StockArticuloEstadoDerivado;
  es_critico: boolean;
};

export type ProdStockArticuloInsert = {
  referencia_id: string;
  referencia_codigo: string;
  referencia_descripcion?: string | null;
  referencia_cliente?: string | null;
  cliente?: string | null;
  cantidad_actual: number;
  unidad?: StockArticuloUnidad;
  poses?: number | null;
  estado_proceso?: StockArticuloEstadoProceso;
  ot_origen?: string | null;
  bultos?: number | null;
  palets?: number | null;
  ubicacion_fisica?: string | null;
  cantidad_minima_alerta?: number | null;
  notas?: string | null;
  condicion?: string | null;
  created_by?: string | null;
};
