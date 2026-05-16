/** Fila de `public.prod_etiquetas_material_catalogo`. */
export type ProdEtiquetasMaterialMarca = "ADESTOR" | "FEDRIGONI";

export type ProdEtiquetasMaterialCatalogoRow = {
  id: string;
  marca: ProdEtiquetasMaterialMarca;
  categoria: string | null;
  item_number: string;
  face_name: string | null;
  adhesive: string | null;
  backing: string | null;
  price_m2: number | null;
  ean_code: string | null;
  notes: string | null;
  stock_dimensions: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};
