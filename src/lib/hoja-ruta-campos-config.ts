/**
 * Configuración de campos específicos por proceso para la Hoja de Ruta Digital
 * 
 * Cada proceso define sus campos con tipo, label, y metadata adicional.
 * Los campos previsto/real se indican con `hasPrevistoReal: true`.
 */

export type CampoTipo = 
  | 'text' 
  | 'number' 
  | 'boolean' 
  | 'select' 
  | 'textarea' 
  | 'array'
  | 'dimension' // Para campos como "largo x ancho"
  | 'tintas';   // Para campos especiales de tintas (ej: "4+1")

export type CampoDefinicion = {
  id: string;
  label: string;
  tipo: CampoTipo;
  required?: boolean;
  placeholder?: string;
  suffix?: string; // ej: "mm", "horas", "uds"
  options?: { value: string; label: string }[]; // Para select
  hasPrevistoReal?: boolean; // Si true, genera dos campos: "campo_previsto" y "campo_real"
  conditionalOn?: string; // ID del campo del que depende (ej: "caucho" → "codigo_caucho")
  conditionalValue?: string | boolean; // Valor que debe tener el campo condicional
  min?: number; // Para number
  max?: number; // Para number
  arrayItemType?: 'text' | 'select'; // Para tipo array
  arrayItemOptions?: { value: string; label: string }[]; // Opciones para array de selects
};

export type ProcesoConfigCampos = {
  procesoNombre: string;
  campos: CampoDefinicion[];
};

// ============================================================================
// GUILLOTINA
// ============================================================================
const GUILLOTINA_CAMPOS: CampoDefinicion[] = [
  {
    id: 'tamano_inicial',
    label: 'Tamaño inicial papel/cartón',
    tipo: 'dimension',
    placeholder: 'ej: 700 x 1000',
    suffix: 'mm',
  },
  {
    id: 'hojas_iniciales',
    label: 'Hojas iniciales',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'patron_corte',
    label: 'Patrón corte guillotina',
    tipo: 'text',
    placeholder: 'Descripción del patrón',
  },
  {
    id: 'tamano_final',
    label: 'Tamaño final papel/cartón',
    tipo: 'dimension',
    placeholder: 'ej: 350 x 500',
    suffix: 'mm',
  },
  {
    id: 'hojas_finales',
    label: 'Hojas finales',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'horas_proceso',
    label: 'Horas proceso',
    tipo: 'number',
    min: 0,
    suffix: 'h',
  },
];

// ============================================================================
// IMPRESIÓN OFFSET
// ============================================================================
const IMPRESION_OFFSET_CAMPOS: CampoDefinicion[] = [
  {
    id: 'hojas_brutas',
    label: 'Nº hojas brutas impresión',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'hojas_netas',
    label: 'Nº hojas netas impresión',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'formato_hojas',
    label: 'Formato hojas impresión',
    tipo: 'text',
    placeholder: 'ej: 70×100 cm',
  },
  {
    id: 'hojas_merma',
    label: 'Nº hojas merma impresión',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'tintas_cara',
    label: 'Tintas CARA',
    tipo: 'tintas',
    placeholder: 'ej: 4+1 (cuatricromía + 1 pantone)',
  },
  {
    id: 'tintas_dorso',
    label: 'Tintas DORSO',
    tipo: 'tintas',
    placeholder: 'ej: 3+0',
  },
  {
    id: 'acabado_principal',
    label: 'Acabado principal',
    tipo: 'text',
    placeholder: 'barniz graso, barniz acrílico brillo, mate...',
  },
  {
    id: 'caucho',
    label: 'Caucho',
    tipo: 'boolean',
  },
  {
    id: 'codigo_caucho',
    label: 'Código caucho',
    tipo: 'text',
    conditionalOn: 'caucho',
    conditionalValue: true,
    placeholder: 'Código del caucho usado',
  },
  {
    id: 'acabados_secundarios',
    label: 'Acabados secundarios',
    tipo: 'array',
    arrayItemType: 'text',
  },
  {
    id: 'horas_entrada',
    label: 'Horas entrada',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'horas_impresion',
    label: 'Horas impresión',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'densidades_tintas',
    label: 'Densidades tintas',
    tipo: 'array',
    arrayItemType: 'select',
    arrayItemOptions: [
      { value: 'CYAN', label: 'Cyan' },
      { value: 'MAGENTA', label: 'Magenta' },
      { value: 'YELLOW', label: 'Yellow' },
      { value: 'BLACK', label: 'Black' },
      { value: 'BLANCO', label: 'Blanco' },
      { value: 'PANTONE', label: 'Pantone (especificar nº)' },
    ],
  },
  {
    id: 'incidencias',
    label: 'Incidencias',
    tipo: 'textarea',
    placeholder: 'Anotar incidencias durante el proceso...',
  },
];

// ============================================================================
// IMPRESIÓN DIGITAL PLANA
// ============================================================================
const IMPRESION_DIGITAL_PLANA_CAMPOS: CampoDefinicion[] = [
  {
    id: 'hojas_brutas',
    label: 'Nº hojas brutas impresión',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'hojas_netas',
    label: 'Nº hojas netas impresión',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'formato_hojas',
    label: 'Formato hojas impresión',
    tipo: 'text',
    placeholder: 'ej: A3, 50×70 cm',
  },
  {
    id: 'hojas_merma',
    label: 'Nº hojas merma impresión',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'tintas_cara',
    label: 'Tintas CARA',
    tipo: 'number',
    min: 0,
    max: 10,
  },
  {
    id: 'tintas_dorso',
    label: 'Tintas DORSO',
    tipo: 'number',
    min: 0,
    max: 10,
  },
  {
    id: 'acabado_clear',
    label: 'Acabado CLEAR',
    tipo: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: '1_cara', label: '1 cara' },
      { value: '2_caras', label: '2 caras' },
    ],
  },
  {
    id: 'acabados_secundarios',
    label: 'Acabados secundarios',
    tipo: 'array',
    arrayItemType: 'text',
  },
  {
    id: 'horas_entrada',
    label: 'Horas entrada',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'horas_impresion',
    label: 'Horas impresión',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'incidencias',
    label: 'Incidencias',
    tipo: 'textarea',
    placeholder: 'Anotar incidencias durante el proceso...',
  },
];

// ============================================================================
// TROQUELADO
// ============================================================================
const TROQUELADO_CAMPOS: CampoDefinicion[] = [
  {
    id: 'troquel',
    label: 'Troquel',
    tipo: 'text',
    placeholder: 'Código o descripción del troquel',
  },
  {
    id: 'poses',
    label: 'Poses',
    tipo: 'number',
    min: 1,
  },
  {
    id: 'tamano_corte',
    label: 'Tamaño corte',
    tipo: 'dimension',
    placeholder: 'ej: 85 x 55',
    suffix: 'mm',
  },
  {
    id: 'pinza',
    label: 'Pinza',
    tipo: 'number',
    min: 0,
    suffix: 'mm',
  },
  {
    id: 'expulsor',
    label: 'Expulsor',
    tipo: 'select',
    options: [
      { value: 'mascle', label: 'Mascle' },
      { value: 'femella', label: 'Femella' },
      { value: 'completo', label: 'Completo' },
    ],
  },
  {
    id: 'arreglos',
    label: 'Arreglos',
    tipo: 'boolean',
  },
  {
    id: 'hojas_troquelar',
    label: 'Nº hojas a troquelar',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'horas_preparacion',
    label: 'Horas preparación',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'horas_tiraje',
    label: 'Horas tiraje',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'hojas_troqueladas',
    label: 'Hojas troqueladas',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'hojas_merma',
    label: 'Hojas merma',
    tipo: 'number',
    min: 0,
  },
];

// ============================================================================
// ENGOMADO
// ============================================================================
const ENGOMADO_CAMPOS: CampoDefinicion[] = [
  {
    id: 'estuches_realizar',
    label: 'Nº estuches a realizar',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'tipo_engomado',
    label: 'Tipo de engomado',
    tipo: 'select',
    options: [
      { value: 'lineal', label: 'Lineal' },
      { value: 'automatico', label: 'Automático' },
      { value: 'semiautomatico', label: 'Semiautomático' },
      { value: 'especial', label: 'Especial' },
      { value: '2_pases', label: '2 pases' },
      { value: '4_puntos', label: '4 puntos' },
      { value: 'konica', label: 'Konica' },
    ],
  },
  {
    id: 'tiempo',
    label: 'Tiempo',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
  },
  {
    id: 'estuches_engomados',
    label: 'Nº estuches engomados',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'estuches_por_bulto',
    label: 'Estuches por bulto',
    tipo: 'number',
    min: 1,
  },
  {
    id: 'codigo_caja_embalaje',
    label: 'Código caja embalaje',
    tipo: 'text',
    placeholder: 'Código de la caja donde va',
  },
  {
    id: 'bultos_por_palet',
    label: 'Bultos por palet',
    tipo: 'number',
    min: 1,
  },
  {
    id: 'palets',
    label: 'Palets',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'cantidad_total',
    label: 'Cantidad total',
    tipo: 'number',
    min: 0,
  },
];

// ============================================================================
// EXTERNOS - CAMPOS COMUNES
// ============================================================================
const EXTERNO_CAMPOS_COMUNES: CampoDefinicion[] = [
  {
    id: 'enlace_externos',
    label: 'Enlace a Módulo Externos',
    tipo: 'text',
    placeholder: 'ID o referencia del registro en Gestión de Externos',
  },
];

// ============================================================================
// EXTERNOS - FAMILIA HOJAS
// Plastificado, stamping, UVI, serigrafía, relieve...
// ============================================================================
const EXTERNO_HOJAS_CAMPOS: CampoDefinicion[] = [
  ...EXTERNO_CAMPOS_COMUNES,
  {
    id: 'numero_hojas',
    label: 'Nº hojas',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'acabado_detalle',
    label: 'Detalle acabado',
    tipo: 'text',
    placeholder: 'Mate, brillo, soft-touch, UVI 2D, UVI 3D...',
  },
  {
    id: 'unidades',
    label: 'Unidades',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'reservas',
    label: 'Reservas',
    tipo: 'text',
    placeholder: 'Sí/no o detalle de reservas',
  },
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    placeholder: 'Notas específicas sobre el proceso externo...',
  },
];

// ============================================================================
// EXTERNOS - CONTRACOLADO
// ============================================================================
const EXTERNO_CONTRACOLADO_CAMPOS: CampoDefinicion[] = [
  ...EXTERNO_CAMPOS_COMUNES,
  {
    id: 'hojas_material_1',
    label: 'Hojas material 1',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'hojas_material_2',
    label: 'Hojas material 2',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'hojas_resultantes',
    label: 'Hojas resultantes',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    placeholder: 'Materiales, montaje, mermas o indicaciones...',
  },
];

// ============================================================================
// EXTERNOS - FORRADO
// ============================================================================
const EXTERNO_FORRADO_CAMPOS: CampoDefinicion[] = [
  ...EXTERNO_CAMPOS_COMUNES,
  {
    id: 'descripcion',
    label: 'Descripción',
    tipo: 'textarea',
    placeholder: 'Tapa + base, base + carcaj + interior + embellecedor...',
  },
  {
    id: 'numero_hojas',
    label: 'Nº hojas',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'unidades',
    label: 'Unidades',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    placeholder: 'Notas específicas sobre forrado...',
  },
];

// ============================================================================
// EXTERNOS - VENTANA
// ============================================================================
const EXTERNO_VENTANA_CAMPOS: CampoDefinicion[] = [
  ...EXTERNO_CAMPOS_COMUNES,
  {
    id: 'unidades',
    label: 'Unidades',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'tipo_ventana',
    label: 'Tipo ventana',
    tipo: 'text',
    placeholder: 'PVC, PET...',
  },
  {
    id: 'formato_ventana',
    label: 'Formato ventana',
    tipo: 'text',
    placeholder: 'ej: 15x21, 4x6 cm',
  },
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    placeholder: 'Notas específicas sobre ventana...',
  },
];

// ============================================================================
// EXTERNOS - GENÉRICO
// ============================================================================
const EXTERNO_GENERICO_CAMPOS: CampoDefinicion[] = [
  ...EXTERNO_CAMPOS_COMUNES,
  {
    id: 'numero_hojas',
    label: 'Nº hojas',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'unidades',
    label: 'Unidades',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'descripcion',
    label: 'Descripción',
    tipo: 'textarea',
    placeholder: 'Descripción del trabajo externo...',
  },
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    placeholder: 'Notas específicas sobre el proceso externo...',
  },
];

// ============================================================================
// MANIPULADOS INTERNOS
// ============================================================================
const MANIPULADOS_INTERNOS_CAMPOS: CampoDefinicion[] = [
  {
    id: 'descripcion',
    label: 'Descripción',
    tipo: 'textarea',
    placeholder: 'Descripción detallada del manipulado (encajar, montar, manipular, pegar, retractilar...)',
    required: true,
  },
  {
    id: 'unidades',
    label: 'Unidades',
    tipo: 'number',
    min: 0,
  },
  {
    id: 'tiempo_total',
    label: 'Tiempo total',
    tipo: 'number',
    min: 0,
    suffix: 'h',
  },
];

// ============================================================================
// MAPEO: Proceso ID real → Config
// Catálogo actual prod_procesos_cat:
// 1 Offset, 2 Digital plano, 10 Troquelado, 12 Engomado, 15 Manipulado,
// 17 Guillotina. Etiquetas (18/19/20) quedan fuera: ver Bloque 5.
// ============================================================================
export const PROCESO_CAMPOS_CONFIG: Record<number, ProcesoConfigCampos> = {
  1: { procesoNombre: 'Impresión Offset', campos: IMPRESION_OFFSET_CAMPOS },
  2: { procesoNombre: 'Impresión Digital (Plano)', campos: IMPRESION_DIGITAL_PLANA_CAMPOS },
  10: { procesoNombre: 'Troquelado', campos: TROQUELADO_CAMPOS },
  12: { procesoNombre: 'Engomado', campos: ENGOMADO_CAMPOS },
  15: { procesoNombre: 'Manipulado/Encajado', campos: MANIPULADOS_INTERNOS_CAMPOS },
  17: { procesoNombre: 'Guillotina', campos: GUILLOTINA_CAMPOS },
};

export const PROCESOS_ETIQUETA_DIGITAL_IDS = new Set([18, 19, 20]);

export const PROCESO_EXTERNO_CAMPOS_CONFIG: Record<number, ProcesoConfigCampos> = {
  3: { procesoNombre: 'Plastificado (Ext)', campos: EXTERNO_HOJAS_CAMPOS },
  4: { procesoNombre: 'Stamping (Ext)', campos: EXTERNO_HOJAS_CAMPOS },
  5: { procesoNombre: 'UVI Serigrafía (Ext)', campos: EXTERNO_HOJAS_CAMPOS },
  6: { procesoNombre: 'Serigrafía Digital (MGI/Scodix)', campos: EXTERNO_HOJAS_CAMPOS },
  7: { procesoNombre: 'Contracolado Microcanal (Ext)', campos: EXTERNO_CONTRACOLADO_CAMPOS },
  8: { procesoNombre: 'Relieve (Interno)', campos: EXTERNO_HOJAS_CAMPOS },
  9: { procesoNombre: 'Relieve (Ext)', campos: EXTERNO_HOJAS_CAMPOS },
  11: { procesoNombre: 'Poner Ventana PVC (Ext)', campos: EXTERNO_VENTANA_CAMPOS },
  13: { procesoNombre: 'Forrado de Cajas (Ext)', campos: EXTERNO_FORRADO_CAMPOS },
  14: { procesoNombre: 'Encuadernación/Plegado (Ext)', campos: EXTERNO_GENERICO_CAMPOS },
  21: { procesoNombre: 'Impresión EXTERNA', campos: EXTERNO_GENERICO_CAMPOS },
};

/**
 * Obtiene la configuración de campos para un proceso dado su ID.
 */
export function getCamposConfigByProcesoId(procesoId: number): ProcesoConfigCampos | null {
  if (PROCESOS_ETIQUETA_DIGITAL_IDS.has(procesoId)) return null;
  return PROCESO_CAMPOS_CONFIG[procesoId] ?? PROCESO_EXTERNO_CAMPOS_CONFIG[procesoId] ?? null;
}

/**
 * Tipos para los datos guardados en prod_ot_pasos.datos_proceso
 */
export type DatosProcesoGenerico = Record<string, unknown>;

export type DatosProcesoGuillotina = {
  tamano_inicial?: string;
  hojas_iniciales?: number;
  patron_corte?: string;
  tamano_final?: string;
  hojas_finales?: number;
  horas_proceso?: number;
};

export type DatosProcesoImpresionOffset = {
  hojas_brutas?: number;
  hojas_netas?: number;
  formato_hojas?: string;
  hojas_merma?: number;
  tintas_cara?: string;
  tintas_dorso?: string;
  acabado_principal?: string;
  caucho?: boolean;
  codigo_caucho?: string;
  acabados_secundarios?: string[];
  horas_entrada_previsto?: number;
  horas_entrada_real?: number;
  horas_impresion_previsto?: number;
  horas_impresion_real?: number;
  densidades_tintas?: string[];
  incidencias?: string;
};

export type DatosProcesoImpresionDigitalPlana = {
  hojas_brutas?: number;
  hojas_netas?: number;
  formato_hojas?: string;
  hojas_merma?: number;
  tintas_cara?: number;
  tintas_dorso?: number;
  acabado_clear?: string;
  acabados_secundarios?: string[];
  horas_entrada_previsto?: number;
  horas_entrada_real?: number;
  horas_impresion_previsto?: number;
  horas_impresion_real?: number;
  incidencias?: string;
};

export type DatosProcesoTroquelado = {
  troquel?: string;
  poses?: number;
  tamano_corte?: string;
  pinza?: number;
  expulsor?: string;
  arreglos?: boolean;
  hojas_troquelar?: number;
  horas_preparacion_previsto?: number;
  horas_preparacion_real?: number;
  horas_tiraje_previsto?: number;
  horas_tiraje_real?: number;
  hojas_troqueladas?: number;
  hojas_merma?: number;
};

export type DatosProcesoEngomado = {
  estuches_realizar?: number;
  tipo_engomado?: string;
  tiempo_previsto?: number;
  tiempo_real?: number;
  estuches_engomados?: number;
  estuches_por_bulto?: number;
  codigo_caja_embalaje?: string;
  bultos_por_palet?: number;
  palets?: number;
  cantidad_total?: number;
};

export type DatosProcesoExterno = {
  enlace_externos?: string;
  notas_sync?: string;
};

export type DatosProcesoManipuladosInternos = {
  descripcion?: string;
  unidades?: number;
  tiempo_total?: number;
};
