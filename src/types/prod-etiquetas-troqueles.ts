/**
 * Tipo para la tabla prod_etiquetas_troqueles
 * Catálogo de troqueles de la máquina troqueladora de etiquetas
 */

export type ProdEtiquetasTroquelRow = {
  id: number;
  
  /** Código del troquel normalizado a 4 dígitos (ej: 0001, 0157). Único. */
  codigo: string;
  
  /** Nombre original de la carpeta de donde se extrajo el troquel. */
  carpeta_original: string;
  
  /** Ruta de la carpeta en el sistema de archivos. */
  carpeta_path: string | null;
  
  /** Forma del troquel: rectangular, redondo, ovalado, triangulo, hexagonal, multiple, especial, desconocida. */
  forma: string | null;
  
  /** Ancho del troquel en milímetros. */
  ancho_mm: number | null;
  
  /** Alto del troquel en milímetros (para formas rectangulares/ovaladas). */
  alto_mm: number | null;
  
  /** Diámetro del troquel en milímetros (para formas redondas). */
  diametro_mm: number | null;
  
  /** Representación textual de las dimensiones tal como aparecen en la carpeta original. */
  dimensiones_texto: string | null;
  
  /** Indica si es un troquel especial (true) o estándar (false). */
  especial: boolean;
  
  /** Indica si es un troquel múltiple/doble (true) o simple (false). */
  multiple: boolean;
  
  /** Indica si el troquel incluye hendido (true) o no (false). */
  con_hendido: boolean;
  
  /** Nombre del cliente asociado al troquel (TURRIS, VINESTAR, etc). */
  cliente: string | null;
  
  /** Descripción del trabajo o proyecto asociado al troquel. */
  trabajo: string | null;
  
  /** Estado actual del troquel: activo, vacio, mantenimiento, etc. */
  estado: string;
  
  /** Indica si el troquel necesita revisión manual (datos incompletos, ambiguos, etc). */
  necesita_revision: boolean;
  
  /** Notas adicionales sobre el troquel. */
  notas: string | null;
  
  /** Array JSON con metadatos de documentos asociados. */
  documentos: TroquelDocumento[] | null;
  
  created_at: string;
  updated_at: string;
};

/**
 * Metadatos de un documento asociado a un troquel
 */
export type TroquelDocumento = {
  /** Nombre del archivo */
  nombre: string;
  
  /** Tipo de documento: prod, presentacion, mockup, link, nuevo, base */
  tipo: string;
  
  /** Extensión del archivo (sin punto): pdf, tif, jpg, png, etc */
  extension: string;
  
  /** Tamaño del archivo en bytes */
  bytes: number;
};

/**
 * Tipo para inserción (campos requeridos para crear un nuevo troquel)
 */
export type ProdEtiquetasTroquelInsert = Omit<
  ProdEtiquetasTroquelRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: number;
  created_at?: string;
  updated_at?: string;
};

/**
 * Tipo para actualización (todos los campos opcionales excepto id)
 */
export type ProdEtiquetasTroquelUpdate = Partial<ProdEtiquetasTroquelInsert> & {
  id: number;
};

/**
 * Fila parseada del Excel maestro (estructura que viene del script de parsing)
 */
export type TroquelExcelRow = {
  codigo: string;
  carpeta_original: string;
  estado: string;
  forma: string;
  ancho_mm: number | null;
  alto_mm: number | null;
  diametro_mm: number | null;
  dimensiones_texto: string;
  especial: string;
  multiple: string;
  con_hendido: string;
  cliente: string;
  trabajo: string;
  necesita_revision: string;
  notas: string;
  carpeta_path: string;
  documentos: string;
  documentos_detalle: string;
  nombre_normalizado: string;
};
