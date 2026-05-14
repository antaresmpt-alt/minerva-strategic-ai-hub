import type { ProdEtiquetasTipoLinea } from "@/types/prod-etiquetas-catalogo";

export type ProdEtiquetasCompraPropietario = "RITA" | "HUGO";
export type ProdEtiquetasCompraPrioridad = "ALTA" | "MEDIA" | "BAJA";

/** Fila de `public.prod_etiquetas_compras`. */
export type ProdEtiquetasCompraRow = {
  id: string;
  producto: string;
  unidad: number;
  recibido: boolean;
  /** Confirmación de envío del correo de petición (migración `prod_etiquetas_compras` enviado). */
  enviado: boolean;
  enviado_at: string | null;
  propietario: ProdEtiquetasCompraPropietario;
  fecha_pedido: string;
  fecha_llegada: string | null;
  equipo: string;
  tipo_linea: ProdEtiquetasTipoLinea;
  marca: string;
  prioridad: ProdEtiquetasCompraPrioridad;
  created_at: string;
  updated_at: string;
};

/** Fila de `public.prod_etiquetas_compras_comunicacion`. */
export type ProdEtiquetasCompraComunicacionRow = {
  id: string;
  compra_ids: string[];
  asunto: string;
  cuerpo: string;
  enviado_por: string | null;
  created_at: string;
};
