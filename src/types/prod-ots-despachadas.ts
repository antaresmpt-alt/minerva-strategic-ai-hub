/** Fila fusionada para la vista OTs Despachadas (despachadas + datos maestro). */
export type OtsDespachadasTableRow = {
  id: string;
  ot_numero: string;
  /** true cuando existe al menos un paso en `prod_ot_pasos` para la OT. */
  has_itinerario: boolean;
  /** Fecha/hora de despacho desde `produccion_ot_despachadas.despachado_at`. */
  despachado_at: string | null;
  material: string | null;
  /** g/m² en `produccion_ot_despachadas`. */
  gramaje: number | null;
  tamano_hoja: string | null;
  num_hojas_netas: number | null;
  num_hojas_brutas: number | null;
  horas_entrada: number | null;
  horas_tiraje: number | null;
  tintas: string | null;
  /** Notas técnicas de despacho (columna `notas`). */
  notas: string | null;
  estado_material: string | null;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
  /** Desde `prod_ots_general.fecha_entrega` (entrega prevista). */
  fecha_entrega_prevista: string | null;
  /** Código enlazable con `prod_troqueles.num_troquel` (columna `troquel`). */
  troquel: string | null;
  /** Poses (`integer` en `produccion_ot_despachadas`). */
  poses: number | null;
  acabado_pral: string | null;
};
