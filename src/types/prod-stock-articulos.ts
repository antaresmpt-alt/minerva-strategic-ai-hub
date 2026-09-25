/**
 * Tipos Bloque 15 — stock de artículos (producto / WIP).
 */

export type StockArticuloUnidad = "uds" | "hojas";

export type StockArticuloEstadoProceso =
  | "terminado"
  | "impreso"
  | "troquelado"
  | "otro";

export type StockArticuloEstadoDerivado =
  | "disponible"
  | "parcial"
  | "reservado"
  | "agotado";

export type StockArticuloReservaEstado =
  | "activa"
  | "parcial"
  | "consumida"
  | "liberada";

export type StockArticuloMovimientoTipo =
  | "entrada"
  | "reserva"
  | "liberacion"
  | "consumo"
  | "ajuste"
  | "transformacion";

export type ProfileCapacidad = "stock_articulos_write";

export type ProdStockArticuloRow = {
  id: string;
  referencia_id: string;
  referencia_codigo: string;
  referencia_descripcion: string | null;
  referencia_cliente: string | null;
  cliente: string | null;
  cliente_norm: string | null;
  cantidad_actual: number;
  unidad: StockArticuloUnidad;
  poses: number | null;
  estado_proceso: StockArticuloEstadoProceso;
  ot_origen: string | null;
  bultos: number | null;
  palets: number | null;
  ubicacion_fisica: string | null;
  notas: string | null;
  condicion: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProdStockArticuloReservaRow = {
  id: string;
  stock_articulo_id: string;
  ot_numero: string;
  num_pedido: string | null;
  cantidad_reservada: number;
  cantidad_consumida: number;
  estado: StockArticuloReservaEstado;
  bultos_reservados: number | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProdStockArticuloMovimientoRow = {
  id: string;
  stock_articulo_id: string;
  tipo: StockArticuloMovimientoTipo;
  cantidad: number;
  cantidad_antes: number | null;
  cantidad_despues: number | null;
  cantidad_destino: number | null;
  cantidad_merma: number | null;
  bultos: number | null;
  ot_numero: string | null;
  num_pedido: string | null;
  stock_articulo_destino_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockArticuloAtpRow = {
  id: string;
  referencia_id: string;
  referencia_codigo: string;
  referencia_descripcion: string | null;
  referencia_cliente: string | null;
  cliente: string | null;
  cliente_norm: string | null;
  unidad: StockArticuloUnidad;
  poses: number | null;
  estado_proceso: StockArticuloEstadoProceso;
  ot_origen: string | null;
  bultos: number | null;
  palets: number | null;
  ubicacion_fisica: string | null;
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
};

export type StockArticuloCriticoPorRefRow = {
  referencia_id: string;
  referencia_codigo: string;
  referencia_cliente: string | null;
  cliente_norm: string | null;
  stock_cantidad_minima: number | null;
  cantidad_fisica_total: number;
  cantidad_libre_total: number;
  es_critico: boolean;
};
