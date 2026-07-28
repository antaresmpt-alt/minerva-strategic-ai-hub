/** Defaults de configuración por proceso guardados en el maestro (Ola 2 Fase 2).
 *  Mismas claves que DespachoWizardProcesoDatos, pero solo campos estables por artículo.
 *  Prohibido: hojas_iniciales, hojas_finales, hojas_brutas, hojas_netas, horas_*. */
export type DefaultsProcesoCtpMaestro = Partial<Record<
  | "prueba_digital"
  | "prueba_gmg"
  | "pdf_x_ok"
  | "maqueta"
  | "gestion_troquel"
  | "preparacion_montaje"
  | "retoque_diseno"
  | "gestion_relieves_stamping"
  | "gestion_fsc",
  boolean
>>;

export type DefaultsProcesoGuillotinaMaestro = {
  patron_corte?: string | null;
  tamano_final?: string | null;
};

export type DefaultsProcesoExternoMaestro = {
  acabado_detalle?: string | null;
  acabado_cara?: string | null;
  acabado_dorso?: string | null;
};

export type DefaultsProcesoMaestro = {
  ctp?: DefaultsProcesoCtpMaestro;
  guillotina?: DefaultsProcesoGuillotinaMaestro;
  /** Clave = proceso_id como string (igual que DespachoWizardProcesoDatos.externos). */
  externos?: Record<string, DefaultsProcesoExternoMaestro>;
};

/** Fila de `prod_referencias` (Referencia Minerva: agrupador de repeticiones y maestro de artículos). */
export type ProdReferenciaRow = {
  id: string;
  codigo: string;
  referencia_cliente: string | null;
  descripcion: string | null;
  cliente: string | null;

  /** Tipo de artículo: estuche, etiqueta, prospecto, manual, caja, otro… */
  tipo_producto: string | null;
  subtipo: string | null;
  /** false = discontinuado, no aparece en picker de despacho */
  activo: boolean;

  /** Dimensiones en mm */
  formato_largo_mm: number | null;
  formato_ancho_mm: number | null;
  formato_fondo_mm: number | null;

  /** Sugerencias técnicas por defecto (pre-rellenan el modal de despacho) */
  material_habitual: string | null;
  gramaje_habitual: number | null;
  poses_habitual: number | null;
  troquel_habitual: string | null;
  tintas_habituales: string | null;
  acabado_habitual: string | null;
  ruta_habitual: string | null;
  tipo_engomado_habitual: string | null;
  caja_embalaje_habitual: string | null;
  unidades_por_embalaje_habitual: number | null;

  /** Certificación FSC */
  fsc: boolean;
  fsc_fecha_validacion: string | null;

  /** Trazabilidad histórica (actualizado automáticamente por el sistema) */
  ultima_ot_numero: string | null;
  ultima_ot_fecha: string | null;
  total_repeticiones: number;

  notas: string | null;

  /** Defaults de configuración por proceso (CTP, guillotina, externos). Solo campos estables. */
  defaults_proceso: DefaultsProcesoMaestro | null;

  // ─── Bloque 6.x — promedios / oficial (§7.1) ───────────────────────────────
  /** Último recálculo desde prod_ot_producidas. */
  promedios_actualizados_at: string | null;
  /** Nº de OTs usadas en el último recálculo (tras filtros). */
  promedios_basados_en_n_ots: number | null;

  material_promedio: string | null;
  material_oficial: string | null;
  troquel_promedio: string | null;
  troquel_oficial: string | null;
  tintas_promedio: string | null;
  tintas_oficial: string | null;
  acabado_promedio: string | null;
  acabado_oficial: string | null;
  tipo_engomado_promedio: string | null;
  tipo_engomado_oficial: string | null;
  caja_embalaje_promedio: string | null;
  caja_embalaje_oficial: string | null;

  poses_promedio: number | null;
  poses_oficial: number | null;
  poses_muestra_n: number | null;
  gramaje_promedio: number | null;
  gramaje_oficial: number | null;
  gramaje_muestra_n: number | null;
  unidades_por_embalaje_promedio: number | null;
  unidades_por_embalaje_oficial: number | null;
  unidades_por_embalaje_muestra_n: number | null;
  merma_promedio: number | null;
  merma_oficial: number | null;
  merma_muestra_n: number | null;

  horas_prep_impresion_promedio: number | null;
  horas_prep_impresion_oficial: number | null;
  horas_prep_impresion_muestra_n: number | null;
  horas_prep_troquelado_promedio: number | null;
  horas_prep_troquelado_oficial: number | null;
  horas_prep_troquelado_muestra_n: number | null;
  horas_prep_engomado_promedio: number | null;
  horas_prep_engomado_oficial: number | null;
  horas_prep_engomado_muestra_n: number | null;

  horas_millar_impresion_promedio: number | null;
  horas_millar_impresion_oficial: number | null;
  horas_millar_impresion_muestra_n: number | null;
  horas_millar_troquelado_promedio: number | null;
  horas_millar_troquelado_oficial: number | null;
  horas_millar_troquelado_muestra_n: number | null;
  horas_millar_engomado_promedio: number | null;
  horas_millar_engomado_oficial: number | null;
  horas_millar_engomado_muestra_n: number | null;

  created_at: string | null;
  updated_at: string | null;
};

/** Columnas de promedios/oficiales (Bloque 6.x): no van en Excel ni en formularios habituales. */
export type ProdReferenciaPromediosKey = Extract<
  keyof ProdReferenciaRow,
  | "promedios_actualizados_at"
  | "promedios_basados_en_n_ots"
  | `${string}_promedio`
  | `${string}_oficial`
  | `${string}_muestra_n`
>;

/** Fila de `prod_despacho_materiales_lineas` (líneas de material flexibles del despacho). */
export type ProdDespachoMaterialLineaRow = {
  id: string;
  ot_numero: string;
  tipo: string | null;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  orden: number | null;
  soporte_impresion: boolean;
  notas: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Tipos de línea de material sugeridos para el despacho flexible. */
export const DESPACHO_MATERIAL_LINEA_TIPOS = [
  "material",
  "tinta",
  "proceso_especial",
  "merma",
  "otro",
] as const;

export type DespachoMaterialLineaTipo =
  (typeof DESPACHO_MATERIAL_LINEA_TIPOS)[number];

/** Tipos de producto para el maestro de artículos */
export const ARTICULO_TIPO_PRODUCTO_OPTIONS = [
  "estuche",
  "etiqueta",
  "prospecto",
  "manual",
  "caja",
  "caja display",
  "otro",
] as const;

export type ArticuloTipoProducto = (typeof ARTICULO_TIPO_PRODUCTO_OPTIONS)[number];

/** Estructura de una fila del Excel de artículos (importación) */
export type ArticuloExcelRow = {
  codigo?: string | null;
  referencia_cliente?: string | null;
  descripcion?: string | null;
  cliente?: string | null;
  tipo_producto?: string | null;
  subtipo?: string | null;
  activo?: string | null;
  formato_largo_mm?: string | number | null;
  formato_ancho_mm?: string | number | null;
  formato_fondo_mm?: string | number | null;
  material_habitual?: string | null;
  poses_habitual?: string | number | null;
  troquel_habitual?: string | null;
  tintas_habituales?: string | null;
  acabado_habitual?: string | null;
  ruta_habitual?: string | null;
  notas?: string | null;
};
