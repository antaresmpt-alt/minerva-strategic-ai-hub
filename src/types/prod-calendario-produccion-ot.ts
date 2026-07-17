/** Fila de `public.prod_calendario_produccion_ot`. */
export type ProdCalendarioProduccionOtRow = {
  id: string;
  fecha: string;
  ot_numero: string;
  orden: number;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Detalle enriquecido maestro + despacho para el mini modal. */
export type CalendarioProduccionOtDetalle = {
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  cantidad: number | null;
  fechaEntrega: string | null;
  despachado: boolean;
  material: string | null;
  gramaje: number | null;
  tamanoHoja: string | null;
  tintas: string | null;
  acabadoPral: string | null;
  troquel: string | null;
  poses: number | null;
  hojasBrutas: number | null;
  hojasNetas: number | null;
};
