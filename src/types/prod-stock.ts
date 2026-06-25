/**
 * Tipos para las tablas de stock de material (Bloque 9).
 * prod_stock_palets — cartelas de palet (1 fila = 1 palet físico = 1 ID Stock)
 * prod_stock_palet_ots — bridge OTs referenciadas sin cantidad por OT
 * prod_stock_movimientos — log inmutable de consumos/ajustes/traspasos
 */

/** Valores válidos para `tipo_stock`. MVP: solo `materia_prima`. */
export type StockTipo =
  | "materia_prima"
  | "semielaborado"
  | "producto_terminado"
  | "consumible";

/** Valores válidos para `unidad`. MVP: solo `hojas`. */
export type StockUnidad = "hojas" | "uds" | "kg" | "m";

/** Estado del palet. */
export type StockEstado = "disponible" | "reservado" | "parcial" | "consumido";

/** Tipos de movimiento. */
export type StockMovimientoTipo =
  | "consumo"
  | "ajuste"
  | "sobrante"
  | "traspaso"
  | "entrada";

/** Fila de `prod_stock_palets` tal como la devuelve Supabase. */
export type ProdStockPaletRow = {
  id: string;
  id_stock: number;
  tipo_stock: StockTipo;
  unidad: StockUnidad;
  recepcion_id: string | null;
  compra_id: string | null;
  codigo_articulo: string | null;
  descripcion_material: string | null;
  material_nombre: string | null;
  gramaje: number | null;
  formato: string | null;
  marca: string | null;
  cantidad_peso: number | null;
  cantidad_peso_unidad: "kg" | "tn" | null;
  cantidad_inicial: number;
  cantidad_actual: number;
  ot_destino_numero: string | null;
  estado: StockEstado;
  ubicacion_fila: string | null;
  nota_entrega: string | null;
  ref_lote_proveedor: string | null;
  ref_lote: string | null;
  es_fsc: boolean;
  es_pefc: boolean;
  fsc_certificado_proveedor: string | null;
  pefc_certificado_proveedor: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Fila de `prod_stock_palet_ots` (bridge cartela → OTs). */
export type ProdStockPaletOtRow = {
  id: string;
  palet_id: string;
  ot_numero: string;
  created_at: string;
};

/** Fila de `prod_stock_movimientos`. */
export type ProdStockMovimientoRow = {
  id: string;
  palet_id: string;
  tipo: StockMovimientoTipo;
  /** Siempre positivo; la semántica de suma/resta la da `tipo`. */
  cantidad: number;
  ot_numero: string | null;
  ot_origen_numero: string | null;
  ot_destino_numero: string | null;
  autorizado_por: string | null;
  paso_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
};

/** Palet enriquecido con sus OTs para la UI (join en memoria o PostgREST). */
export type ProdStockPaletConOts = ProdStockPaletRow & {
  ots: string[];
  /** Join opcional desde recepción → compra → proveedor (solo UI/impresión). */
  proveedor_nombre?: string | null;
};

/**
 * Agrupación de recepciones pendientes de cartelar por albarán.
 * Construida en la UI a partir de `prod_recepciones_material` JOIN `prod_compra_material`.
 */
export type AlbaranPendienteGroup = {
  albaran_proveedor: string;
  proveedor_nombre: string | null;
  fecha_recepcion: string;
  palets_recibidos: number | null;
  hojas_recibidas_total: number;
  recepciones: AlbaranRecepcionLine[];
  /** Cuántas cartelas ya existen para este albarán (antiduplicado). */
  cartelas_existentes: number;
};

export type AlbaranRecepcionLine = {
  recepcion_id: string;
  compra_id: string;
  ot_numero: string;
  material: string | null;
  gramaje: number | null;
  tamano_hoja: string | null;
  num_hojas_brutas: number | null;
  cliente_nombre: string | null;
  trabajo_titulo: string | null;
  proveedor_nombre: string | null;
};

/** Datos que el wizard de cartelado necesita para cada palet. */
export type WizardPaletInput = {
  /** Prefill desde la recepción/compra; editable. */
  material_nombre: string;
  gramaje: string;
  formato: string;
  cantidad_inicial: string;
  /** Código artículo proveedor (PHFOAL…); opcional en piloto. */
  codigo_articulo: string;
  /** OTs referenciadas en la cartela (sin cantidad). */
  ots_referencia: string[];
  stock_libre: boolean;
  ubicacion_fila: string;
  ref_lote_proveedor: string;
  es_fsc: boolean;
  es_pefc: boolean;
  notas: string;
};

/** Filas de ubicación predefinidas (§3g C3). */
export const UBICACIONES_FILA = [
  "ALLYKING",
  "ZENITH",
  "COMCOTE/TPWHITE",
  "GRISES",
  "GRISES PAPRINSA",
  "KRAFTLINER",
  "ESTUCADOS",
  "PAPELES ESPECIALES Y OFFSET",
] as const;

export type UbicacionFila = (typeof UBICACIONES_FILA)[number];
