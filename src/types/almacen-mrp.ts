/** Fila de la vista `almacen_control_inteligente` (PostgREST). */
export type AlmacenControlInteligenteRow = {
  /** Suele exponerse el `id` de `almacen_materiales` como `material_id` o `id`. */
  material_id?: string;
  id?: string;
  material: string | null;
  stock_fisico: number | string | null;
  stock_minimo: number | string | null;
  reservado_total: number | string | null;
  pedido_pendiente: number | string | null;
  disponible_real: number | string | null;
  disponible_proyectado: number | string | null;
};

/** Relación embebida PostgREST `almacen_materiales(...)` en reservas / tránsito. */
export type AlmacenMaterialNombreRef = {
  id?: string;
  nombre: string | null;
};

export type AlmacenReservaRow = {
  id: string;
  ot_num: string | null;
  material_id: string | null;
  cantidad_bruta: number | string | null;
  estado: string | null;
  fecha_prevista: string | null;
  almacen_materiales?:
    | AlmacenMaterialNombreRef
    | AlmacenMaterialNombreRef[]
    | null;
};

export type AlmacenPedidoTransitoRow = {
  id: string;
  num_pedido: string | null;
  material_id: string | null;
  cantidad_pedida: number | string | null;
  estado: string | null;
  fecha_llegada: string | null;
  almacen_materiales?:
    | AlmacenMaterialNombreRef
    | AlmacenMaterialNombreRef[]
    | null;
};
