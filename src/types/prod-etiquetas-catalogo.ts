export type ProdEtiquetasCatalogCategoria =
  | "producto"
  | "equipo"
  | "marca"
  | "propietario"
  | "prioridad"
  | "tipo_linea";

export type ProdEtiquetasTipoLinea =
  | "ETIQUETAS"
  | "ASISTENCIA"
  | "TINTAS"
  | "TROQUEL"
  | "MANDRIL";

export const PROD_ETIQUETAS_TIPO_LINEA_VALUES: ProdEtiquetasTipoLinea[] = [
  "ETIQUETAS",
  "ASISTENCIA",
  "TINTAS",
  "TROQUEL",
  "MANDRIL",
];

export type ProdEtiquetasCatalogRow = {
  id: string;
  categoria: ProdEtiquetasCatalogCategoria;
  grupo: string | null;
  label: string;
  activo: boolean;
  orden: number;
  created_at?: string;
  updated_at?: string;
};
