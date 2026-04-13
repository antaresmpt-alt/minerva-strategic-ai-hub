/** Fila de `prod_ots_general` (PostgREST / Supabase). */
export type ProdOtsGeneralRow = {
  id: string;
  num_pedido: string;
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
