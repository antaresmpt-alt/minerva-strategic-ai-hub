import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";

/** Fila de `public.prod_calendario_detalle_dia` (fecha vía join a pastilla). */
export type ProdCalendarioDetalleDiaRow = {
  id: string;
  calendario_ot_id: string;
  ambito: CalendarioAmbito;
  ot_numero: string;
  maquina_id: string | null;
  turno: "manana" | "tarde" | null;
  slot_orden: number;
  horas_planificadas_snapshot: number | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarioDetalleDiaTurno = NonNullable<
  ProdCalendarioDetalleDiaRow["turno"]
>;
