/** Fila de `prod_procesos_cat`. */
export type ProdProcesoCatRow = {
  id: number;
  nombre: string;
  seccion_slug: string;
  es_externo: boolean | null;
  orden_sugerido: number | null;
  activo: boolean | null;
};

/** Fila de `prod_rutas_plantilla`. */
export type ProdRutaPlantillaRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean | null;
  creado_at: string | null;
};

/** Paso guardado en `prod_rutas_plantilla_pasos`. */
export type ProdRutaPlantillaPasoRow = {
  id: string;
  plantilla_id: string;
  proceso_id: number;
  orden: number;
};
