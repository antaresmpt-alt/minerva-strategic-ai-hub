/** Fila fusionada para la vista OTs Despachadas (despachadas + datos maestro). */
export type OtsDespachadasTableRow = {
  id: string;
  ot_numero: string;
  material: string | null;
  tamano_hoja: string | null;
  num_hojas_netas: number | null;
  num_hojas_brutas: number | null;
  estado_material: string | null;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
  /** Desde `prod_ots_general.fecha_entrega` (entrega prevista). */
  fecha_entrega_prevista: string | null;
};
