/** Fila de la pestaña Compras de Material (prod_compra_material + cruces en memoria). */
export type ComprasMaterialTableRow = {
  id: string;
  ot_numero: string;
  num_compra: string;
  posicion: number | null;
  cliente: string | null;
  titulo: string | null;
  material: string | null;
  /** Desde `produccion_ot_despachadas.gramaje` (g/m²). */
  gramaje: number | null;
  tamano_hoja: string | null;
  num_hojas_netas: number | null;
  num_hojas_brutas: number | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  /** Fecha límite OT (`prod_ots_general.fecha_entrega`). Urgencia vs hoy. */
  fecha_entrega_maestro: string | null;
  fecha_prevista_recepcion: string | null;
  albaran_proveedor: string | null;
  estado: string | null;
  /** Notas internas de compra (Jordi). */
  notas: string | null;
  /** Última nota registrada desde muelle para esta compra. */
  ultima_recepcion_nota: string | null;
  /** Fecha de la última recepción con nota. */
  ultima_recepcion_fecha: string | null;
  /** UUID del usuario que recepcionó (si quedó registrado). */
  ultima_recepcion_por: string | null;
  /** Email del usuario que recepcionó (snapshot legible). */
  ultima_recepcion_por_email: string | null;
  /** Nombre mostrado del usuario que recepcionó (snapshot legible). */
  ultima_recepcion_por_nombre: string | null;
  /**
   * URLs públicas (`recepciones-fotos`) de todas las recepciones de esta compra
   * (`prod_recepciones_material` → `prod_recepciones_fotos`).
   */
  recepcion_foto_urls: string[];
};
