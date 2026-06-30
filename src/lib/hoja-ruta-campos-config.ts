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
  | 'combo'     // Input con sugerencias (datalist): opciones + texto libre
  | 'textarea' 
  | 'array'
  | 'dimension' // Para campos como "largo x ancho"
  | 'tintas'    // Para campos especiales de tintas (ej: "4+1")
  | 'densidades'; // Lista de tintas con su valor de densidad (0–2)

/**
 * Ancho del campo dentro de la rejilla de 6 columnas del formulario.
 * - full: ocupa toda la línea (1/1)
 * - half: media línea (1/2) → dos campos por fila
 * - third: un tercio (1/3) → tres campos por fila
 */
export type CampoWidth = 'full' | 'half' | 'third';

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
  step?: number; // Para number (ej: 0.05 en densidades)
  arrayItemType?: 'text' | 'select'; // Para tipo array
  arrayItemOptions?: { value: string; label: string }[]; // Opciones para array de selects
  width?: CampoWidth; // Layout: ancho en la rejilla (por defecto full)
  emphasis?: 'real'; // Resalta el campo como "dato real" clave (resultado del operario)
  hint?: string; // Texto auxiliar bajo el label
};

/** Un elemento de densidad de tinta capturado por el operario. */
export type DensidadTinta = {
  tinta: string;        // CYAN, MAGENTA, ... o PANTONE
  densidad?: number;    // 0.00 – 2.00
  ref?: string;         // Referencia Pantone cuando tinta === 'PANTONE'
};

export type ProcesoConfigCampos = {
  procesoNombre: string;
  campos: CampoDefinicion[];
  /**
   * Campo de `datos_proceso` que representa la salida real de este proceso
   * (lo que "viaja" al siguiente paso).
   */
  outputField?: string;
  /** Unidad del campo de salida para mostrar en la UI. */
  outputUnit?: string;
  /**
   * IDs de procesos aguas arriba cuya salida (outputField) es compatible
   * como entrada de este proceso. Se leen en orden y se usa el primero
   * con datos finalizados.
   */
  inputFromProcessIds?: number[];
  /**
   * Campo de `datos_proceso` con el formato de pliego de salida hacia el
   * siguiente paso del itinerario.
   */
  formatOutputField?: string;
  /**
   * Campo donde se registra el formato de entrada en este paso (p. ej. guillotina:
   * `tamano_inicial`). Si no se indica, se usa `formatOutputField`.
   */
  formatInputField?: string;
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
    hint: 'Encadenado del paso anterior o formato compra',
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
    emphasis: 'real',
    hint: 'Formato de salida — viaja al siguiente proceso',
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
    id: 'material_impresion',
    label: 'Material soporte impresión',
    tipo: 'combo',
    placeholder: 'Selecciona el soporte que entra en máquina...',
    width: 'full',
    hint: 'Se propone desde las líneas de material marcadas como soporte o por heurística; puedes corregirlo.',
  },
  // — Formato (línea propia) —
  {
    id: 'formato_hojas',
    label: 'Formato hojas impresión',
    tipo: 'text',
    placeholder: 'ej: 70×100 cm',
    width: 'half',
    hint: 'Encadenado del paso anterior o formato compra',
  },
  {
    id: 'caucho',
    label: 'Caucho',
    tipo: 'boolean',
    width: 'half',
  },
  {
    id: 'codigo_caucho',
    label: 'Código caucho',
    tipo: 'text',
    conditionalOn: 'caucho',
    conditionalValue: true,
    placeholder: 'Código del caucho usado',
    width: 'half',
  },
  // — Recuento de hojas: previsto (brutas/netas) y real (merma/buenas) —
  {
    id: 'hojas_brutas',
    label: 'Hojas brutas (plan)',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
  {
    id: 'hojas_netas',
    label: 'Hojas netas (plan)',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
  {
    id: 'hojas_merma',
    label: 'Hojas merma',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
  },
  {
    id: 'hojas_impresas',
    label: 'Hojas buenas impresas',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Se calcula desde brutas − merma; ajústalo si difiere.',
  },
  // — Tintas + acabado en una línea (tres tercios) —
  {
    id: 'tintas_cara',
    label: 'Tintas CARA',
    tipo: 'tintas',
    placeholder: 'ej: 4+1',
    width: 'third',
  },
  {
    id: 'tintas_dorso',
    label: 'Tintas DORSO',
    tipo: 'tintas',
    placeholder: 'ej: 3+0',
    width: 'third',
  },
  {
    id: 'acabado_principal',
    label: 'Acabado principal',
    tipo: 'text',
    placeholder: 'barniz graso, acrílico brillo, mate...',
    width: 'third',
  },
  // — Tiempos previsto/real —
  {
    id: 'horas_entrada',
    label: 'Horas entrada',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  {
    id: 'horas_impresion',
    label: 'Horas impresión',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  // — Densidades de tinta con valor (0–2) —
  {
    id: 'densidades_tintas',
    label: 'Densidades tintas',
    tipo: 'densidades',
    width: 'full',
    arrayItemOptions: [
      { value: 'CYAN', label: 'Cyan' },
      { value: 'MAGENTA', label: 'Magenta' },
      { value: 'YELLOW', label: 'Yellow' },
      { value: 'BLACK', label: 'Black' },
      { value: 'BLANCO', label: 'Blanco' },
      { value: 'PANTONE', label: 'Pantone (especificar nº)' },
    ],
    hint: 'Guía ISO 12647-2 offset estucado: C 1,30–1,50 · M 1,40–1,60 · Y 1,20–1,40 · K 1,60–1,80. Cartoncillo/folding: ~0,10 menos en cada color.',
  },
  {
    id: 'acabados_secundarios',
    label: 'Acabados secundarios',
    tipo: 'array',
    arrayItemType: 'text',
    width: 'full',
  },
  {
    id: 'incidencias',
    label: 'Incidencias',
    tipo: 'textarea',
    placeholder: 'Anotar incidencias durante el proceso...',
    width: 'full',
  },
];

// ============================================================================
// IMPRESIÓN DIGITAL PLANA
// ============================================================================
const IMPRESION_DIGITAL_PLANA_CAMPOS: CampoDefinicion[] = [
  {
    id: 'material_impresion',
    label: 'Material soporte impresión',
    tipo: 'combo',
    placeholder: 'Selecciona el soporte que entra en máquina...',
    width: 'full',
    hint: 'Se propone desde las líneas de material marcadas como soporte o por heurística; puedes corregirlo.',
  },
  {
    id: 'formato_hojas',
    label: 'Formato hojas impresión',
    tipo: 'text',
    placeholder: 'ej: A3, 50×70 cm',
    width: 'half',
    hint: 'Encadenado del paso anterior o formato compra',
  },
  {
    id: 'acabado_clear',
    label: 'Acabado CLEAR',
    tipo: 'select',
    width: 'half',
    options: [
      { value: 'no', label: 'No' },
      { value: '1_cara', label: '1 cara' },
      { value: '2_caras', label: '2 caras' },
    ],
  },
  {
    id: 'hojas_brutas',
    label: 'Hojas brutas (plan)',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
  {
    id: 'hojas_netas',
    label: 'Hojas netas (plan)',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
  {
    id: 'hojas_merma',
    label: 'Hojas merma',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
  },
  {
    id: 'hojas_impresas',
    label: 'Hojas buenas impresas',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Se calcula desde brutas − merma; ajústalo si difiere.',
  },
  {
    id: 'tintas_cara',
    label: 'Tintas CARA',
    tipo: 'number',
    min: 0,
    max: 10,
    width: 'half',
  },
  {
    id: 'tintas_dorso',
    label: 'Tintas DORSO',
    tipo: 'number',
    min: 0,
    max: 10,
    width: 'half',
  },
  {
    id: 'horas_entrada',
    label: 'Horas entrada',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  {
    id: 'horas_impresion',
    label: 'Horas impresión',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  {
    id: 'acabados_secundarios',
    label: 'Acabados secundarios',
    tipo: 'array',
    arrayItemType: 'text',
    width: 'full',
  },
  {
    id: 'incidencias',
    label: 'Incidencias',
    tipo: 'textarea',
    placeholder: 'Anotar incidencias durante el proceso...',
    width: 'full',
  },
];

// ============================================================================
// TROQUELADO
// ============================================================================
const TROQUELADO_CAMPOS: CampoDefinicion[] = [
  // — Identificación / geometría (líneas anchas) —
  {
    id: 'troquel',
    label: 'Troquel',
    tipo: 'text',
    placeholder: 'Código o descripción del troquel',
    width: 'half',
  },
  {
    id: 'tamano_corte',
    label: 'Tamaño corte',
    tipo: 'dimension',
    placeholder: 'ej: 85 x 55',
    suffix: 'mm',
    width: 'half',
  },
  // — Expulsor / arreglos / hojas a troquelar en una línea —
  {
    id: 'expulsor',
    label: 'Expulsor',
    tipo: 'select',
    width: 'third',
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
    width: 'third',
  },
  {
    id: 'hojas_troquelar',
    label: 'Hojas a troquelar (plan)',
    tipo: 'number',
    min: 0,
    width: 'third',
  },
  // — Poses y pinza compactos (valores pequeños) —
  {
    id: 'poses',
    label: 'Poses',
    tipo: 'number',
    min: 1,
    width: 'third',
  },
  {
    id: 'pinza',
    label: 'Pinza',
    tipo: 'number',
    min: 0,
    suffix: 'mm',
    width: 'third',
  },
  // — Tiempos previsto/real —
  {
    id: 'horas_preparacion',
    label: 'Horas preparación',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  {
    id: 'horas_tiraje',
    label: 'Horas tiraje',
    tipo: 'number',
    hasPrevistoReal: true,
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  // — Resultado real —
  {
    id: 'hojas_merma',
    label: 'Hojas merma',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
  },
  {
    id: 'hojas_troqueladas',
    label: 'Hojas troqueladas buenas',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Se calcula desde hojas a troquelar − merma; ajústalo si difiere.',
  },
];

// ============================================================================
// ENGOMADO
// ============================================================================
const ENGOMADO_CAMPOS: CampoDefinicion[] = [
  {
    id: 'estuches_realizar',
    label: 'Estuches a realizar (plan)',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
  {
    id: 'tipo_engomado',
    label: 'Tipo de engomado',
    tipo: 'combo',
    width: 'half',
    hint: 'Elige del catálogo o escribe uno libre.',
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
    width: 'half',
  },
  {
    id: 'estuches_engomados',
    label: 'Estuches engomados buenos',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Se siembra desde el plan y arrastra cantidad total.',
  },
  {
    id: 'codigo_caja_embalaje',
    label: 'Caja de embalaje',
    tipo: 'select',
    width: 'half',
    options: [], // Se rellena dinámicamente desde prod_cajas_embalaje.
    hint: 'Al elegirla se propone bultos/palet por defecto (editable).',
  },
  {
    id: 'estuches_por_bulto',
    label: 'Estuches por bulto',
    tipo: 'number',
    min: 1,
    width: 'third',
  },
  {
    id: 'bultos_por_palet',
    label: 'Bultos por palet',
    tipo: 'number',
    min: 1,
    width: 'third',
    hint: 'Por defecto el de la caja; ajústalo si el cliente admite otra altura.',
  },
  {
    id: 'bultos_completos',
    label: 'Bultos completos',
    tipo: 'number',
    min: 0,
    width: 'third',
    hint: 'Calculado: estuches ÷ estuches por bulto (entero).',
  },
  {
    id: 'pico',
    label: 'Pico (bulto incompleto)',
    tipo: 'number',
    min: 0,
    width: 'third',
    hint: 'Estuches sueltos del último bulto parcial.',
  },
  {
    id: 'bultos_totales',
    label: 'Bultos totales',
    tipo: 'number',
    min: 0,
    width: 'third',
    emphasis: 'real',
    hint: 'Bultos completos + 1 si hay pico.',
  },
  {
    id: 'palets',
    label: 'Palets',
    tipo: 'number',
    min: 0,
    width: 'third',
    hint: 'Calculado con tolerancia: no abre palet por un pico suelto.',
  },
  {
    id: 'cantidad_total',
    label: 'Cantidad total',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Sincronizado con estuches engomados.',
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
  {
    id: 'hojas_enviadas',
    label: 'Hojas enviadas',
    tipo: 'number',
    min: 0,
    width: 'half',
    hint: 'Cantidad enviada al proveedor externo.',
  },
  {
    id: 'hojas_recibidas_muelle',
    label: 'Hojas recibidas muelle',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Dato de retorno; si existe, tiene prioridad sobre hojas enviadas.',
  },
  {
    id: 'unidades_recibidas_muelle',
    label: 'Unidades recibidas muelle',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
  {
    id: 'palets_recibidos_muelle',
    label: 'Palets recibidos muelle',
    tipo: 'number',
    min: 0,
    width: 'half',
  },
];

// ============================================================================
// EXTERNOS - FAMILIA HOJAS
// Plastificado, stamping, UVI, serigrafía, relieve...
// ============================================================================
const EXTERNO_HOJAS_CAMPOS: CampoDefinicion[] = [
  ...EXTERNO_CAMPOS_COMUNES,
  {
    id: 'formato_hojas',
    label: 'Formato pliego',
    tipo: 'text',
    placeholder: 'ej: 70×100 cm',
    width: 'half',
    hint: 'Encadenado del paso anterior o formato compra',
  },
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
    width: 'full',
  },
  {
    id: 'unidades',
    label: 'Unidades',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
  },
  {
    id: 'tiempo_total',
    label: 'Tiempo total',
    tipo: 'number',
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  // — Retractilado (aparece solo si retractilar = true) —
  {
    id: 'retractilar',
    label: 'Retractilar',
    tipo: 'boolean',
    width: 'half',
    hint: 'Activa los campos de retractilado.',
  },
  {
    id: 'unidades_por_paquete',
    label: 'Uds. por paquete (retractilar)',
    tipo: 'number',
    min: 1,
    width: 'third',
    conditionalOn: 'retractilar',
    conditionalValue: true,
    hint: 'Ej: 25 uds. por paquete retractilado.',
  },
  {
    id: 'num_paquetes',
    label: 'Nº paquetes (retractilar)',
    tipo: 'number',
    min: 0,
    width: 'third',
    conditionalOn: 'retractilar',
    conditionalValue: true,
    hint: 'Calculado: unidades ÷ uds. por paquete.',
  },
  // — Etiquetado (aparece solo si etiquetar = true) —
  {
    id: 'etiquetar',
    label: 'Etiquetar',
    tipo: 'boolean',
    width: 'half',
    hint: 'Activa los campos de etiquetado.',
  },
  {
    id: 'unidades_por_paquete_etiqueta',
    label: 'Uds. por paquete (etiquetar)',
    tipo: 'number',
    min: 1,
    width: 'third',
    conditionalOn: 'etiquetar',
    conditionalValue: true,
    hint: 'Ej: 6 uds. por paquete etiquetado.',
  },
  {
    id: 'num_paquetes_etiqueta',
    label: 'Nº paquetes (etiquetar)',
    tipo: 'number',
    min: 0,
    width: 'third',
    conditionalOn: 'etiquetar',
    conditionalValue: true,
    hint: 'Calculado: unidades ÷ uds. por paquete.',
  },
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    width: 'full',
    placeholder: 'Observaciones del manipulado o retractilado...',
  },
];

// ============================================================================
// CTP / PREIMPRESIÓN
// ============================================================================
const CTP_PREIMPRESION_CAMPOS: CampoDefinicion[] = [
  {
    id: 'retoque_diseno',
    label: 'Retoque diseño',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'gestion_troquel',
    label: 'Gestión troquel',
    tipo: 'boolean',
    width: 'third',
    hint: 'Troquel nuevo o recuperado de archivo.',
  },
  {
    id: 'gestion_relieves_stamping',
    label: 'Relieves / stamping / varios',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'prueba_gmg',
    label: 'Prueba GMG',
    tipo: 'boolean',
    width: 'third',
    hint: 'Prueba contractual de color cuando aplique.',
  },
  {
    id: 'pdf_x_ok',
    label: 'PDF X OK',
    tipo: 'boolean',
    width: 'third',
    hint: 'Validación contractual PDF/X en preimpresión.',
  },
  {
    id: 'prueba_digital',
    label: 'Prueba digital',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'maqueta',
    label: 'Maqueta',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'gestion_fsc',
    label: 'Gestión FSC',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'preparacion_montaje',
    label: 'Preparación montaje',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'planchas_hechas',
    label: 'Planchas hechas',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'num_planchas',
    label: 'Nº de planchas',
    tipo: 'number',
    min: 0,
    width: 'third',
    emphasis: 'real',
    conditionalOn: 'planchas_hechas',
    conditionalValue: true,
    hint: 'Dato clave pedido por preimpresión.',
  },
  {
    id: 'horas_proceso',
    label: 'Horas proceso',
    tipo: 'number',
    min: 0,
    suffix: 'h',
    width: 'third',
    emphasis: 'real',
    hint: 'Horas reales dedicadas al trabajo CTP/preimpresión.',
  },
];

// ============================================================================
// DESBROCE
// ============================================================================
const DESBROCE_CAMPOS: CampoDefinicion[] = [
  {
    id: 'hojas_entrada',
    label: 'Hojas de entrada',
    tipo: 'number',
    min: 0,
    width: 'half',
    hint: 'Hojas troqueladas recibidas de la troqueladora.',
  },
  {
    id: 'poses',
    label: 'Poses',
    tipo: 'number',
    min: 1,
    width: 'half',
    hint: 'Estuches por hoja (se toma del despacho si está informado).',
  },
  {
    id: 'estuches_desbrozados',
    label: 'Estuches desbrozados',
    tipo: 'number',
    min: 0,
    width: 'half',
    emphasis: 'real',
    hint: 'Calculado: hojas × poses.',
  },
  {
    id: 'horas_proceso',
    label: 'Horas proceso',
    tipo: 'number',
    min: 0,
    suffix: 'h',
    width: 'half',
  },
  {
    id: 'notas',
    label: 'Notas / incidencias',
    tipo: 'textarea',
    width: 'full',
    placeholder: 'Observaciones del desbroce...',
  },
];

// ============================================================================
// IDs de proceso conocidos (deben coincidir con prod_procesos_cat en BD)
// ============================================================================
/** @internal IDs de proceso para la lógica de encadenado y semáforo. */
export const PROCESO_CTP_ID = 16;
export const PROCESO_DESBROCE_ID = 22;

// ============================================================================
// MAPEO: Proceso ID real → Config
// Catálogo actual prod_procesos_cat:
// 1 Offset, 2 Digital plano, 10 Troquelado, 12 Engomado, 15 Manipulados (Int),
// 16 CTP/Preimpresión, 17 Guillotina. Etiquetas (18/19/20) quedan fuera.
// 22 Desbroce.
// ============================================================================
export const PROCESO_CAMPOS_CONFIG: Record<number, ProcesoConfigCampos> = {
  1: {
    procesoNombre: 'Impresión Offset',
    campos: IMPRESION_OFFSET_CAMPOS,
    outputField: 'hojas_impresas',
    outputUnit: 'hojas',
    formatOutputField: 'formato_hojas',
    inputFromProcessIds: [17],
  },
  2: {
    procesoNombre: 'Impresión Digital (Plano)',
    campos: IMPRESION_DIGITAL_PLANA_CAMPOS,
    outputField: 'hojas_impresas',
    outputUnit: 'hojas',
    formatOutputField: 'formato_hojas',
    inputFromProcessIds: [17],
  },
  10: {
    procesoNombre: 'Troquelado',
    campos: TROQUELADO_CAMPOS,
    outputField: 'hojas_troqueladas',
    outputUnit: 'hojas',
    inputFromProcessIds: [1, 2],
  },
  12: {
    procesoNombre: 'Engomado',
    campos: ENGOMADO_CAMPOS,
    outputField: 'estuches_engomados',
    outputUnit: 'estuches',
    // 22 (Desbroce) tiene prioridad: si hay desbroce previo, toma estuches ya separados.
    // 10 (Troquelado) es el fallback cuando no hay desbroce.
    inputFromProcessIds: [PROCESO_DESBROCE_ID, 10],
  },
  15: {
    procesoNombre: 'Manipulados internos',
    campos: MANIPULADOS_INTERNOS_CAMPOS,
    inputFromProcessIds: [12, PROCESO_DESBROCE_ID, 10],
  },
  [PROCESO_CTP_ID]: {
    procesoNombre: 'CTP / Preimpresión',
    campos: CTP_PREIMPRESION_CAMPOS,
    // Sin outputField: CTP no produce unidades que encadenen al siguiente proceso.
  },
  17: {
    procesoNombre: 'Guillotina',
    campos: GUILLOTINA_CAMPOS,
    outputField: 'hojas_finales',
    outputUnit: 'hojas',
    formatInputField: 'tamano_inicial',
    formatOutputField: 'tamano_final',
  },
  [PROCESO_DESBROCE_ID]: {
    procesoNombre: 'Desbroce',
    campos: DESBROCE_CAMPOS,
    outputField: 'estuches_desbrozados',
    outputUnit: 'estuches',
    inputFromProcessIds: [10],
  },
};

export const PROCESOS_ETIQUETA_DIGITAL_IDS = new Set([18, 19, 20]);

export const PROCESO_EXTERNO_CAMPOS_CONFIG: Record<number, ProcesoConfigCampos> = {
  3: { procesoNombre: 'Plastificado (Ext)', campos: EXTERNO_HOJAS_CAMPOS, formatOutputField: 'formato_hojas' },
  4: { procesoNombre: 'Stamping (Ext)', campos: EXTERNO_HOJAS_CAMPOS, formatOutputField: 'formato_hojas' },
  5: { procesoNombre: 'UVI Serigrafía (Ext)', campos: EXTERNO_HOJAS_CAMPOS, formatOutputField: 'formato_hojas' },
  6: { procesoNombre: 'Serigrafía Digital (MGI/Scodix)', campos: EXTERNO_HOJAS_CAMPOS, formatOutputField: 'formato_hojas' },
  7: { procesoNombre: 'Contracolado Microcanal (Ext)', campos: EXTERNO_CONTRACOLADO_CAMPOS },
  8: { procesoNombre: 'Relieve (Interno)', campos: EXTERNO_HOJAS_CAMPOS, formatOutputField: 'formato_hojas' },
  9: { procesoNombre: 'Relieve (Ext)', campos: EXTERNO_HOJAS_CAMPOS, formatOutputField: 'formato_hojas' },
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
  hojas_impresas?: number;
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
  densidades_tintas?: DensidadTinta[];
  incidencias?: string;
};

export type DatosProcesoImpresionDigitalPlana = {
  hojas_brutas?: number;
  hojas_netas?: number;
  formato_hojas?: string;
  hojas_merma?: number;
  hojas_impresas?: number;
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
  bultos_completos?: number;
  pico?: number;
  bultos_totales?: number;
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
  retractilar?: boolean;
  unidades_por_paquete?: number;
  num_paquetes?: number;
  etiquetar?: boolean;
  unidades_por_paquete_etiqueta?: number;
  num_paquetes_etiqueta?: number;
  notas?: string;
};

export type DatosProcesoCTP = {
  operador_ctp?: string;
  horas_proceso?: number;
  planchas_nuevas?: boolean;
  verificacion_troquel?: boolean;
  prueba_color?: boolean;
  notas?: string;
};

export type DatosProcesoDesbroce = {
  hojas_entrada?: number;
  poses?: number;
  estuches_desbrozados?: number;
  horas_proceso?: number;
  notas?: string;
};
