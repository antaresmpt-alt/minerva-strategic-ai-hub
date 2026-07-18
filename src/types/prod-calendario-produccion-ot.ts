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

import type { CalendarioPasoResumen } from "@/lib/calendario-produccion-progreso";

/** Detalle enriquecido maestro + despacho + itinerario para el mini modal. */
export type CalendarioProduccionOtDetalle = {
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  cantidad: number | null;
  fechaEntrega: string | null;
  despachado: boolean;
  estadoOt: string | null;
  material: string | null;
  gramaje: number | null;
  tamanoHoja: string | null;
  tintas: string | null;
  acabadoPral: string | null;
  troquel: string | null;
  poses: number | null;
  hojasBrutas: number | null;
  hojasNetas: number | null;
  pasos: CalendarioPasoResumen[];
};
