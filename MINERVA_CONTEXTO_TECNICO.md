# MINERVA — Contexto Técnico

> Documento de contexto técnico generado automáticamente.
> Proyecto: **minerva-strategic-ai-hub** · Next.js 16 + React 19 + Supabase.
> Fecha de generación: 13 de junio de 2026 · **Última actualización: 17 junio 2026** (Fase FORMATO + fix Pool/Pipeline).

---

## 1. Estructura de carpetas del proyecto (árbol)

> Se excluyen `node_modules/`, `.next/`, `.git/` y la carpeta `repositorio/` (assets de marca).

```
minerva-strategic-ai-hub/
├── .cursor/
│   └── settings.json
├── scripts/
│   └── _seed_chunks/
├── public/
│   └── images/
├── src/
│   ├── middleware.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── admin/
│   │   │   └── ingest/
│   │   ├── almacen/
│   │   ├── analytics/
│   │   │   └── sales/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── logs/
│   │   │   │   ├── planificacion-ia-settings/
│   │   │   │   ├── prod-cajas-embalaje/
│   │   │   │   ├── prod-despacho-catalogo/
│   │   │   │   ├── prod-etiquetas-catalogo/
│   │   │   │   ├── prod-maquinas/
│   │   │   │   ├── prod-procesos-cat/
│   │   │   │   ├── prod-rutas-plantilla/
│   │   │   │   │   └── [id]/
│   │   │   │   ├── role-permissions/
│   │   │   │   ├── sys-parametros/
│   │   │   │   ├── sys-parametros-etiquetas-compras/
│   │   │   │   └── users/
│   │   │   │       └── [id]/
│   │   │   │           ├── ban/
│   │   │   │           ├── password/
│   │   │   │           ├── profile/
│   │   │   │           └── recovery/
│   │   │   ├── chat/
│   │   │   ├── etiquetas-digital/
│   │   │   │   ├── compras-mail-config/
│   │   │   │   └── troquel-archivo/
│   │   │   ├── gemini/
│   │   │   │   ├── analyze/
│   │   │   │   ├── chat/
│   │   │   │   ├── creativo/
│   │   │   │   ├── creativo-video/
│   │   │   │   ├── fichas-tecnicas-analyze/
│   │   │   │   ├── meta-proposal/
│   │   │   │   ├── meta-proposal-image/
│   │   │   │   ├── pmax/
│   │   │   │   ├── produccion-externos-analyze/
│   │   │   │   ├── produccion-externos-optimus-import/
│   │   │   │   ├── sem-creative-lab/
│   │   │   │   │   ├── analyze/
│   │   │   │   │   └── render/
│   │   │   │   ├── slides/
│   │   │   │   └── troqueles-analyze/
│   │   │   ├── ingest/
│   │   │   ├── ingest-pdf/
│   │   │   ├── lead-scoring/
│   │   │   ├── pagespeed/
│   │   │   ├── produccion/
│   │   │   │   ├── caucho-list/
│   │   │   │   ├── planificacion-ia-reorder/
│   │   │   │   └── troquel-pdf/
│   │   │   ├── rag-documents/
│   │   │   ├── sales-chat/
│   │   │   ├── sales-email/
│   │   │   ├── security/
│   │   │   │   ├── access-denied/
│   │   │   │   └── login-attempt/
│   │   │   └── seo/
│   │   │       └── generate/
│   │   ├── auth/
│   │   │   └── continue/
│   │   ├── chat/
│   │   ├── login/
│   │   │   └── mfa-setup/
│   │   ├── produccion/
│   │   │   ├── almacen/
│   │   │   ├── articulos/
│   │   │   ├── ejecucion/
│   │   │   ├── etiquetas-digital/
│   │   │   ├── externos/
│   │   │   ├── fichas/
│   │   │   ├── fichas-tecnicas/
│   │   │   ├── hoja-ruta-test/
│   │   │   ├── muelle/
│   │   │   ├── ordenes/
│   │   │   ├── ots/
│   │   │   ├── pipeline/
│   │   │   └── troqueles/
│   │   ├── sem/
│   │   ├── seo/
│   │   └── settings/
│   ├── components/
│   │   ├── brand/
│   │   ├── chat/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   ├── portal/
│   │   ├── produccion/
│   │   │   ├── almacen/
│   │   │   ├── articulos/
│   │   │   ├── etiquetas-digital/
│   │   │   ├── externos/
│   │   │   ├── fichas-tecnicas/
│   │   │   ├── hoja-ruta/
│   │   │   ├── muelle/
│   │   │   ├── ots/
│   │   │   ├── planificacion/
│   │   │   │   ├── mesa/
│   │   │   │   └── mesa-diaria/
│   │   │   └── troqueles/
│   │   ├── providers/
│   │   ├── sales/
│   │   ├── seo/
│   │   ├── settings/
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   │   ├── api/
│   │   ├── hoja-ruta/
│   │   ├── pipeline/
│   │   └── supabase/
│   ├── types/
│   └── utils/
│       └── supabase/
├── supabase/
│   ├── migrations/
│   │   └── .pending/
│   ├── seeds/
│   └── sql/
├── AGENTS.md
├── CLAUDE.md
├── DATA_MAPPING_PIPELINE_MVP.md
├── FASES_HOJA_RUTA_DIGITAL.md
├── FASES_MAESTRO_ARTICULOS.md
├── GUIA_MAÑANA.md
├── README.md
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## 2. `package.json`

```json
{
  "name": "minerva-strategic-ai-hub",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@ai-sdk/google": "^3.0.53",
    "@ai-sdk/react": "^3.0.143",
    "@anthropic-ai/sdk": "^0.82.0",
    "@base-ui/react": "^1.3.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@google/generative-ai": "^0.24.1",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@supabase/ssr": "^0.10.0",
    "@supabase/supabase-js": "^2.101.1",
    "@tanstack/react-table": "^8.21.3",
    "@vercel/speed-insights": "^2.0.0",
    "ai": "^6.0.141",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "docx": "^9.6.1",
    "dommatrix": "^0.1.1",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "lucide-react": "^1.7.0",
    "next": "16.2.1",
    "openai": "^6.33.0",
    "papaparse": "^5.5.3",
    "pdf-parse": "^2.4.5",
    "pdfjs-dist": "^5.5.207",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-markdown": "^10.1.0",
    "react-to-print": "^3.3.0",
    "recharts": "^3.8.1",
    "shadcn": "^4.1.1",
    "sharp": "^0.34.5",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "xlsx": "^0.18.5",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/papaparse": "^5.5.2",
    "@types/pdf-parse": "^1.1.5",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## 3. `src/lib/hoja-ruta-campos-config.ts`

```typescript
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
  /** Campo de entrada de formato de pliego (encadenado por orden de itinerario). */
  formatInputField?: string;
  /** Campo de salida de formato de pliego (encadenado al siguiente paso). */
  formatOutputField?: string;
  /** Unidad del campo de salida para mostrar en la UI. */
  outputUnit?: string;
  /**
   * IDs de procesos aguas arriba cuya salida (outputField) es compatible
   * como entrada de este proceso. Se leen en orden y se usa el primero
   * con datos finalizados.
   */
  inputFromProcessIds?: number[];
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
  // — Formato (línea propia) —
  {
    id: 'formato_hojas',
    label: 'Formato hojas impresión',
    tipo: 'text',
    placeholder: 'ej: 70×100 cm',
    width: 'half',
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
    hint: 'Se calcula desde netas − merma; ajústalo si difiere.',
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
    id: 'formato_hojas',
    label: 'Formato hojas impresión',
    tipo: 'text',
    placeholder: 'ej: A3, 50×70 cm',
    width: 'half',
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
    hint: 'Se calcula desde netas − merma; ajústalo si difiere.',
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
    label: 'Uds. por paquete',
    tipo: 'number',
    min: 1,
    width: 'third',
    conditionalOn: 'retractilar',
    conditionalValue: true,
    hint: 'Ej: 25 uds. por paquete retractilado.',
  },
  {
    id: 'num_paquetes',
    label: 'Nº paquetes',
    tipo: 'number',
    min: 0,
    width: 'third',
    conditionalOn: 'retractilar',
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
    id: 'operador_ctp',
    label: 'Operador CTP',
    tipo: 'text',
    placeholder: 'Nombre del operador',
    width: 'half',
  },
  {
    id: 'horas_proceso',
    label: 'Horas proceso',
    tipo: 'number',
    min: 0,
    suffix: 'h',
    width: 'half',
    emphasis: 'real',
  },
  // — Tareas (checkboxes rápidos para fichar desde PC) —
  {
    id: 'planchas_nuevas',
    label: 'Planchas nuevas',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'verificacion_troquel',
    label: 'Verificación troquel',
    tipo: 'boolean',
    width: 'third',
  },
  {
    id: 'prueba_color',
    label: 'Prueba de color',
    tipo: 'boolean',
    width: 'third',
  },
  // — Notas libres —
  {
    id: 'notas',
    label: 'Notas',
    tipo: 'textarea',
    placeholder: 'Observaciones del trabajo de preimpresión...',
    width: 'full',
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
  },
  2: {
    procesoNombre: 'Impresión Digital (Plano)',
    campos: IMPRESION_DIGITAL_PLANA_CAMPOS,
    outputField: 'hojas_impresas',
    outputUnit: 'hojas',
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
```

---

## 4. `src/types/planificacion-mesa.ts`

```typescript
import type {
  PlanificacionDraftScope,
  PlanificacionTipoMaquina,
} from "@/lib/planificacion-ambito";

/**
 * Tipos de la Mesa de Secuenciación de OTs (planificación drag & drop).
 *
 * - `PoolOT`: lo que llega al sidebar desde `prod_planificacion_pool` enriquecido
 *   con datos de `produccion_ot_despachadas` y `prod_ots_general`.
 * - `MesaTrabajo`: lo que vive dentro de un turno (fila en
 *   `prod_mesa_planificacion_trabajos` ya con snapshots).
 * - `CapacidadTurno`: capacidad real en `prod_mesa_capacidad_turnos`.
 * - `BoardState` / `DraftBoardState`: estructura tablero usada para render y
 *   para la simulación local (localStorage).
 */

export type TurnoKey = "manana" | "tarde";

/** ymd `yyyy-MM-dd`. */
export type DayKey = string;

/** `${DayKey}::${TurnoKey}` (clave plana de un slot). */
export type SlotKey = string;

export type MaterialStatus = "verde" | "amarillo" | "rojo";
export type TroquelStatus = "ok" | "falta" | "no_aplica" | "sin_informar";
export type TroquelModo = "informado" | "no_aplica" | "sin_informar";

/** Item del Pool en sidebar (enriquecido para mostrar en la tarjeta). */
export interface PoolOT {
  /** Nº OT (clave de negocio). */
  ot: string;
  poolId: string | null;
  cliente: string;
  trabajo: string;
  papel: string;
  tintas: string;
  /** Acabado principal (no es lo mismo que barniz, pero se usa como fallback). */
  acabadoPral: string;
  /** Barniz/acabado del impreso (puede ser null si no se distingue). */
  barniz: string | null;
  fechaEntrega: string | null;
  numHojasBrutas: number;
  /** Horas planificadas totales (entrada + tiraje). */
  horasPlanificadas: number;
  /** Unidades (`prod_ots_general.cantidad`) para tooltip en nº OT. */
  cantidadOt: number | null;
  materialStatus: MaterialStatus;
  troquelStatus: TroquelStatus;
  /** Primer paso `disponible` del itinerario (GPS), si existe. */
  proximoPasoNombre?: string | null;
  proximoPasoSlug?: string | null;
  planificacionTipoPaso?: PlanificacionTipoMaquina | null;
}

/** Item ya planificado en la mesa para una celda (día + turno). */
export interface MesaTrabajo {
  id: string;
  maquinaId: string | null;
  ot: string;
  fechaPlanificada: DayKey;
  turno: TurnoKey;
  slotOrden: number;
  estadoMesa: string;
  fechaEntrega: string | null;
  materialStatus: MaterialStatus;
  troquelStatus: TroquelStatus;
  acabadoPralSnapshot: string;
  /** Snapshots autocontenidos (no requieren joins para pintar la tarjeta). */
  clienteSnapshot: string;
  papelSnapshot: string;
  tintasSnapshot: string;
  barnizSnapshot: string | null;
  numHojasBrutasSnapshot: number;
  horasPlanificadasSnapshot: number;
  /** Título del trabajo (`prod_ots_general.titulo`) para tooltip en nº OT. */
  trabajoTitulo?: string;
  /** Unidades (`prod_ots_general.cantidad`) para tooltip en nº OT. */
  cantidadOt?: number | null;
  /** Estado operativo real de ejecución (si existe registro activo en prod_mesa_ejecuciones). */
  estadoEjecucionActual?: EstadoEjecucionMesa | null;
  /** Minutos pausados acumulados (incluye tramo abierto si está en pausa). */
  minutosPausadaAcumActual?: number;
  /** Pausa abierta asociada a la ejecución activa, si existe. */
  pausaActivaDesdeActual?: string | null;
  motivoPausaActivaActual?: string | null;
  motivoPausaColorHexActual?: string | null;
  motivoPausaCategoriaActual?: MotivoPausaCategoria | null;
  observacionesPausaActivaActual?: string | null;
  /** Ejecución activa enlazada al trabajo de mesa, si existe. */
  ejecucionIdActual?: string | null;
  /** Horas ya informadas en pasos previos de la misma OT. */
  horasPreviasEntrada?: number;
  horasPreviasTiraje?: number;
  horasPreviasTroquelado?: number;
  horasPreviasEngomado?: number;
}

/** Capacidad horaria por día y turno (config). */
export interface CapacidadTurno {
  fecha: DayKey;
  turno: TurnoKey;
  capacidadHoras: number;
  motivoAjuste: string | null;
}

export type EstadoEjecucionMesa =
  | "pendiente_inicio"
  | "en_curso"
  | "pausada"
  | "finalizada"
  | "cancelada";

export type MotivoPausaCategoria =
  | "operativos"
  | "suministros"
  | "calidad"
  | "tecnicos";

export interface MotivoPausa {
  id: string;
  slug: string;
  label: string;
  categoria: MotivoPausaCategoria;
  colorHex: string;
  activo: boolean;
  orden: number;
  /** Tipos de máquina donde aplica. Null/vacío = motivo universal. */
  tiposMaquina: string[] | null;
}

/** Registro operativo manual de una OT iniciada en máquina. */
export interface MesaEjecucion {
  id: string;
  mesaTrabajoId: string | null;
  /** Paso de itinerario (`prod_ot_pasos`) al liberar la OT, si aplica. */
  otPasoId: string | null;
  /** proceso_id del paso de itinerario (para motor de campos dinámicos). */
  procesoId: number | null;
  /** Datos de proceso almacenados en prod_ot_pasos.datos_proceso (JSONB). */
  datosProcesoJson: Record<string, unknown> | null;
  /** proceso_id del paso aguas arriba que actúa como entrada de este paso. */
  procesoAnteriorId: number | null;
  /** Valor real de salida del paso anterior (outputField de ese proceso). */
  salidaProcesoAnterior: number | null;
  /** Nombre del proceso anterior para mostrarlo en la UI. */
  salidaProcesoAnteriorNombre: string | null;
  ot: string;
  maquinaId: string;
  maquinaNombre: string;
  maquinaTipo: string | null;
  fechaPlanificada: DayKey | null;
  turno: TurnoKey | null;
  slotOrden: number | null;
  liberadaAt: string | null;
  inicioRealAt: string | null;
  finRealAt: string | null;
  estadoEjecucion: EstadoEjecucionMesa;
  pausaActivaDesde: string | null;
  motivoPausaActiva: string | null;
  motivoPausaCategoriaActiva: MotivoPausaCategoria | null;
  motivoPausaColorHexActiva: string | null;
  haEstadoPausada: boolean;
  numPausas: number;
  minutosPausadaAcum: number;
  horasPlanificadasSnapshot: number | null;
  horasReales: number | null;
  horasRealesEntrada: number | null;
  horasRealesTiraje: number | null;
  horasRealesTroquelado: number | null;
  horasRealesEngomado: number | null;
  numHojasProducidas: number | null;
  cantidadUnidades: number | null;
  incidencia: string | null;
  accionCorrectiva: string | null;
  maquinista: string | null;
  densidadesJson: Record<string, unknown> | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MesaEjecucionPausa {
  id: string;
  ejecucionId: string;
  pausedAt: string;
  resumedAt: string | null;
  motivoId: string;
  motivoLabel: string;
  motivoCategoria: MotivoPausaCategoria;
  motivoColorHex: string;
  observacionesPausa: string | null;
  minutosPausa: number | null;
  createdAt: string;
}

export interface PlanificacionIaSettings {
  pesoTintas: number;
  pesoCmyk: number;
  pesoBarniz: number;
  pesoPapel: number;
  pesoFechaEntrega: number;
  pesoBalanceCarga: number;
  promptBase: string;
}

export type PlanificacionIaScope =
  | "turno"
  | "dia"
  | "dias_contiguos"
  | "semana";

/** Estado completo del tablero (lo que se renderiza). */
export interface BoardState {
  /** Trabajos por slot, ya ordenados por slot_orden. */
  bySlot: Record<SlotKey, MesaTrabajo[]>;
  /** Capacidad efectiva por slot (con default 8h si no hay registro). */
  capacityBySlot: Record<SlotKey, number>;
}

/** Borrador local usado por el "Modo Simulación" (persistido en localStorage). */
export interface DraftBoardState {
  /** Identificador (yyyy-MM-dd del lunes) para asociar el draft a la semana. */
  weekMondayKey: DayKey;
  /** Máquina productiva a la que pertenece el draft. */
  maquinaId: string;
  /** Ámbito funcional de la pantalla que creó el draft. */
  scope: PlanificacionDraftScope;
  bySlot: Record<SlotKey, MesaTrabajo[]>;
  /** Marca temporal para evitar mostrar drafts antiguos. */
  updatedAt: string;
}

/** Resultado del cálculo de carga de un turno. */
export interface TurnLoad {
  totalHoras: number;
  capacidadHoras: number;
  /** Porcentaje (puede superar 100). */
  pct: number;
  bucket: "verde" | "naranja" | "rojo";
}
```

---

## 5. Migraciones en `supabase/migrations/`

> Total: **33 migraciones** (ordenadas cronológicamente por timestamp del nombre).
> Además existe la carpeta `supabase/migrations/.pending/` para migraciones aún no aplicadas.

| # | Archivo de migración |
|---|----------------------|
| 1 | `20260503120000_pool_en_transito_itinerario.sql` |
| 2 | `20260503180000_plan_pool_rls_seccion_roles.sql` |
| 3 | `20260503200000_mesa_ot_activa_per_maquina.sql` |
| 4 | `20260503220000_externos_itinerario_ot_paso_recibido.sql` |
| 5 | `20260505193500_add_troquelado_engomado_hours.sql` |
| 6 | `20260507194500_mesa_action_modal_unidades_flags.sql` |
| 7 | `20260507212000_prod_despacho_catalogo.sql` |
| 8 | `20260514180000_prod_etiquetas_hoja_ruta.sql` |
| 9 | `20260515120000_prod_etiquetas_compras_catalogo.sql` |
| 10 | `20260516100000_prod_etiquetas_compras_enviado_comunicacion.sql` |
| 11 | `20260517120000_prod_etiquetas_digital_delete_role.sql` |
| 12 | `20260517130000_prod_etiquetas_catalogo_tintas.sql` |
| 13 | `20260517140000_prod_etiquetas_stock_bobinas.sql` |
| 14 | `20260517150000_prod_etiquetas_hoja_ruta_fechas_maquina.sql` |
| 15 | `20260517160000_prod_etiquetas_calendario_apunte.sql` |
| 16 | `20260518120000_prod_etiquetas_material_catalogo.sql` |
| 17 | `20260519120000_prod_calendario_festivo.sql` |
| 18 | `20260525090000_prod_etiquetas_hoja_ruta_metros.sql` |
| 19 | `20260525105000_prod_etiquetas_troqueles.sql` |
| 20 | `20260525112500_prod_etiquetas_hoja_ruta_troquel_id.sql` |
| 21 | `20260525120000_troqueles_config_etiquetas_path.sql` |
| 22 | `20260601120000_prod_referencias_y_ot_anterior.sql` |
| 23 | `20260601130000_prod_referencias_referencia_cliente.sql` |
| 24 | `20260602210000_prod_referencias_campos_ampliados.sql` |
| 25 | `20260603190000_prod_ot_pasos_datos_proceso.sql` |
| 26 | `20260606164500_sys_motivos_pausa_tipos_maquina.sql` |
| 27 | `20260609150000_prod_cajas_embalaje.sql` |
| 28 | `20260609151000_prod_referencias_fsc.sql` |
| 29 | `20260609160000_despacho_catalogo_tipo_engomado.sql` |
| 30 | `20260609161000_tipo_engomado_columns.sql` |
| 31 | `20260609170000_sys_parametros_sobreproduccion.sql` |
| 32 | `20260609180000_procesos_ctp_desbroce_preimpresion.sql` |
| 33 | `20260610084500_etiquetas_troqueles_flex_reparacion.sql` |
| … | *(ver carpeta `supabase/migrations/` — lista parcial; no todas las migraciones posteriores están aquí)* |
| — | `20260717140000_prod_calendario_produccion_ot.sql` — Calendario Producción (17 jul) |
| — | `20260717150000_prod_calendario_produccion_ot_delete_rls.sql` — RLS delete alineado |

**Calendario Producción (UI/PDF, 18 jul):** `calendario-produccion-page.tsx`, `calendario-produccion.ts`, `calendario-produccion-progreso.ts`, `calendario-produccion-export.ts` (PDF grid mes/semana + **listado por día**), `calendario-produccion-import.ts`. Detalle: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §15.11–15.12.

> Nota: aparte de `migrations/`, hay scripts SQL operativos en `supabase/sql/` (RLS, funciones, parches puntuales) y seeds en `supabase/seeds/`.

---

## 6. Reglas de Cursor / AGENTS

> No existe la carpeta `.cursor/rules/`. Las reglas del proyecto viven en `AGENTS.md`
> (referenciado por `CLAUDE.md` mediante `@AGENTS.md`). También existe `.cursor/settings.json`
> con la configuración de plugins.

### `.cursor/settings.json`

```json
{
  "plugins": {
    "supabase": {
      "enabled": true
    }
  }
}
```

### `AGENTS.md`

```markdown
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
```

### `CLAUDE.md`

```markdown
@AGENTS.md
```

---

## 7. Índice de módulos clave — Hoja de Ruta y Pipeline

> Mapa rápido de los archivos centrales del CORE (Hoja de Ruta Virtual + Pipeline) para localizar
> dónde tocar sin tener que rastrear el árbol entero.

### `src/lib/hoja-ruta/`
| Archivo | Responsabilidad |
|---------|-----------------|
| `hoja-ruta-query.ts` | Loader `fetchHojaRutaOt(otNumero)`: monta la hoja completa juntando cabecera, despacho, itinerario + `datos_proceso`, ejecución, pausas (`prod_mesa_ejecuciones_pausas` + `sys_motivos_pausa`) y externos. Incluye `resolveEstadoOtLabel()` (estado derivado del itinerario, p. ej. "Itinerario completo"). |
| `hoja-ruta-formatters.ts` | Helpers compartidos modal + PDF: `fmtDate`, `fmtCantidad`, `formatDensidades`, `buildCamposVista`, etiquetas de tipo de máquina, etc. |
| `hoja-ruta-pdf.ts` | Exportador PDF (A4 vertical): cabecera, badges de ruta, tarjetas por proceso (altura dinámica + color por estado), detalle de pausas, gráfico previsto/real por proceso, footer. Etiqueta despacho: **Formato compra** (`tamano_hoja`). |

### `src/lib/` — encadenado formato + consultas Supabase (17 jun 2026)
| Archivo | Responsabilidad |
|---------|-----------------|
| `hoja-ruta-formato-encadenado.ts` | Encadenado de formato de pliego por `prod_ot_pasos.orden`: `resolveFormatoSalidaProceso`, `aplicarPrefillFormatoEncadenado`, `buildFormatoAnteriorByOtPasoId`. Guillotina `tamano_inicial`/`tamano_final` → Impresión/externos `formato_hojas`. |
| `planificacion-contenedor-query.ts` | Bloque 8.1: meta `ot_tipo`, hijas por padre, progreso contenedor, filtros UI. |
| `supabase-error-message.ts` | Normaliza mensajes de error PostgREST para UI. |

### `src/components/produccion/hoja-ruta/`
| Archivo | Responsabilidad |
|---------|-----------------|
| `datos-proceso-form.tsx` | Formulario dinámico `DatosProcesoForm`: renderiza campos según `procesoId` (layout por `width`, previsto/real, condicionales, densidades con guía ISO 12647, derivaciones). Modo `readonly` para lectura. |
| `hoja-ruta-ot-dialog.tsx` | `HojaRutaOtDialog`: la Hoja de Ruta Virtual (lectura). Punto de entrada único con botones PDF/Recargar y placeholders (recalcular presupuesto / ficha técnica). |
| `hoja-ruta-test-page.tsx` | Página de pruebas de la hoja de ruta (`/produccion/hoja-ruta-test`). |

### `src/lib/pipeline/`
| Archivo | Responsabilidad |
|---------|-----------------|
| `pipeline-data.ts` | Mappers y helpers puros del contrato de datos del Pipeline (`pasoActual`, `siguientePaso`, `riesgo`, `badges`). |
| `pipeline-query.ts` | Capa de lectura/consulta de las filas del Pipeline. |
| `pipeline-export.ts` | Exportación del Pipeline. |
| `pipeline-data.test.ts` | Tests unitarios de las reglas de estado del Pipeline. |

### Captura / ejecución (motor que escribe `datos_proceso`)
| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/hoja-ruta-campos-config.ts` | Config-driven: definición de campos por proceso (ver sección 3). Incluye `formatInputField` / `formatOutputField` por proceso (Fase FORMATO). |
| `src/types/planificacion-mesa.ts` | Tipos de la mesa/ejecución (ver sección 4). Campos `formatoAnterior` / `formatoAnteriorOrigenNombre` en `MesaEjecucion`. |
| `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx` | Tarjeta de ejecución: prefill cantidad + **formato encadenado**, derivaciones (`computeDerivedDatosProceso`), semáforos, banner "Formato pliego de entrada", persistencia en todas las acciones. |
| `src/utils/supabase/client.ts` | Cliente browser Supabase **singleton** (evita contención de lock GoTrue al abrir Pool + Pipeline). |

### Páginas de Producción (`src/app/produccion/*/page.tsx`)
`almacen` · `articulos` (Maestro) · `ejecucion` · `etiquetas-digital` · `externos` · `fichas` ·
`fichas-tecnicas` · `hoja-ruta-test` · `muelle` · `ordenes` · `ots` (despacho) · `pipeline` ·
`troqueles`.

---

## 8. Scripts SQL operativos (`supabase/sql/`)

> A diferencia de `migrations/` (versionadas y aplicadas en orden), estos son scripts SQL operativos /
> de referencia (RLS, funciones, parches puntuales). Listado:

| Script | Tema |
|--------|------|
| `prod_compra_material_campos_material.sql` | Campos de material en compra. |
| `prod_compra_material_sync_recepcion.sql` | Sync de recepción de material. |
| `prod_comunicacion_logs.sql` | Logs de comunicación. |
| `prod_configuracion.sql` | Configuración de producción. |
| `prod_etiquetas_compras_catalogo.sql` | Catálogo de compras de etiquetas. |
| `prod_etiquetas_compras_enviado_comunicacion.sql` | Estado enviado/comunicación de compras etiquetas. |
| `prod_etiquetas_hoja_ruta.sql` | Hoja de ruta de etiquetas (flujo Hugo). |
| `prod_etiquetas_material_catalogo.sql` | Catálogo de material de etiquetas. |
| `prod_etiquetas_stock_bobinas.sql` | Stock de bobinas de etiquetas. |
| `prod_externos_itinerario_ot_paso.sql` | Enlace externos ↔ paso de itinerario. |
| `prod_fichas_tecnicas.sql` | Fichas técnicas. |
| `prod_itinerario_rutas_rls.sql` | RLS de itinerario/rutas. |
| `prod_mesa_ejecuciones_ot_paso_itinerario.sql` | Enlace ejecución ↔ paso de itinerario. |
| `prod_mesa_itinerario_repair_stuck_pasos.sql` | Reparación de pasos atascados en el itinerario. |
| `prod_mesa_secuenciacion.sql` | Mesa de secuenciación. |
| `prod_procesos_catalogo_crud_tipo_planificacion.sql` | CRUD catálogo de procesos + tipo planificación. |
| `prod_roles_seccion_digital_troquel_engom.sql` | Roles por sección (digital/troquel/engomado). |
| `prod_seguimiento_externos_f_entrega_ot.sql` | Fecha de entrega OT en seguimiento de externos. |
| `prod_troqueles_config_caucho_path.sql` | Config de troqueles (caucho/path). |
| `produccion_ot_despachadas_tecnicos.sql` | Datos técnicos en despachadas. |
| `profiles_select_admin_gerencia.sql` | Política de select para admin/gerencia. |
| `role_permissions.sql` | Permisos por rol. |
| `role_permissions_etiquetas_digital.sql` | Permisos rol etiquetas digital. |
| `role_permissions_muelle_almacen.sql` | Permisos rol muelle/almacén. |
| `sys_parametros_ots_compras.sql` | Parámetros de OTs/compras. |

> Además: `supabase/seeds/etiquetas_material_catalogo.json` (seed), `supabase/seed_troqueles_test.sql`
> (seed de prueba) y `supabase/migrations/.pending/` (migraciones aún no aplicadas).

---

## Resumen del stack técnico

| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 16.2.1 (App Router) |
| **UI** | React 19.2.4, Tailwind CSS v4, shadcn, lucide-react, Radix Tooltip, Base UI |
| **Estado** | Zustand 5 |
| **Backend / BD** | Supabase (Postgres + Auth + RLS), `@supabase/ssr`, `@supabase/supabase-js` |
| **IA** | Vercel AI SDK (`ai`), `@ai-sdk/google`, `@ai-sdk/react`, `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` |
| **Tablas / Datos** | `@tanstack/react-table`, `papaparse`, `xlsx` |
| **Drag & Drop** | `@dnd-kit/*` (planificación mesa) |
| **PDF / Docs** | `jspdf`, `jspdf-autotable`, `pdfjs-dist`, `pdf-parse`, `docx`, `react-to-print` |
| **Gráficos** | `recharts` |
| **Imágenes** | `sharp` |
| **Notificaciones** | `sonner` |
| **Lenguaje** | TypeScript 5 |
| **Lint** | ESLint 9 + `eslint-config-next` |
