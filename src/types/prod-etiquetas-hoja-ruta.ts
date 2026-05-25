/** Fila de `public.prod_etiquetas_hoja_ruta`. */
export type ProdEtiquetasHojaRutaRow = {
  id: string;
  ot_numero: string;
  ot_general_id: string | null;
  cliente: string | null;
  trabajo: string | null;
  papel: string | null;
  cantidad: number | null;
  fecha_entrega_ot: string | null;
  fecha_entrada_depto: string | null;
  urgencia: "normal" | "urgente";
  observacion: string | null;
  konica: boolean;
  troqueladora: boolean;
  numeradora: boolean;
  /** Fin impresión Konica → calendario mensual `I-{ot_numero}`. */
  fecha_fin_konica: string | null;
  /** Fin troquelado → calendario `T-{ot_numero}`. */
  fecha_fin_troqueladora: string | null;
  /** Fin numeración → calendario `N-{ot_numero}`. */
  fecha_fin_numeradora: string | null;
  /** Metros de papel consumidos en impresión Konica (se solicita al marcar konica = true). */
  metros_impresion: number | null;
  troquel_utillaje: string | null;
  fecha_inicio_produccion: string | null;
  fecha_fin_produccion: string | null;
  cajas: number | null;
  bobinas: number | null;
  etiquetas: number | null;
  cajas_restantes: string | null;
  finalizado: boolean;
  created_at: string;
  updated_at: string;
};
