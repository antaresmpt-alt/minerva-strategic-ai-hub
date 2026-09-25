/** Fila de `public.prod_etiquetas_hoja_ruta_sesiones`. */
export type EtiquetasSesionProceso = "I" | "T" | "N";

export type ProdEtiquetasHojaRutaSesionRow = {
  id: string;
  hoja_ruta_id: string;
  proceso: EtiquetasSesionProceso;
  /** YYYY-MM-DD */
  fecha: string;
  nota: string | null;
  created_at: string;
};
