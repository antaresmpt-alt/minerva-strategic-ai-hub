/** Fila de `prod_ots_general` (PostgREST / Supabase). */
export const PROD_OT_TIPOS = ["simple", "contenedor", "hija"] as const;
export type ProdOtTipo = (typeof PROD_OT_TIPOS)[number];

export const PROD_OT_TIPOS_HIJA = [
  "forma",
  "componente",
  "preimpresion",
  "acabado",
] as const;
export type ProdOtTipoHija = (typeof PROD_OT_TIPOS_HIJA)[number];

export type ProdOtsGeneralRow = {
  id: string;
  num_pedido: string;
  /** Bloque 8: simple (defecto), contenedor (barco) o hija (ejecución). */
  ot_tipo?: ProdOtTipo;
  /** num_pedido del contenedor cuando ot_tipo = hija. */
  ot_padre_numero?: string | null;
  /** Subtipo de hija: forma, componente, preimpresion, acabado. */
  tipo_hija?: ProdOtTipoHija | null;
  /** Etiqueta legible de la hija (ej. Hoja exterior). */
  forma_descripcion?: string | null;
  estado_cod: number | null;
  estado_desc: string | null;
  cliente: string | null;
  pedido_cliente: string | null;
  cantidad: number | null;
  valor_potencial: number | null;
  titulo: string | null;
  fecha_apertura: string | null;
  fecha_entrega: string | null;
  prioridad: number | null;
  ultima_transaccion: string | null;
  familia: string | null;
  tipo_pedido: string | null;
  vendedor: string | null;
  originador: string | null;
  fsc: string | null;
  prueba_color: string | null;
  pdf_ok: string | null;
  muestra_ok: string | null;
  despachado?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};
