import type {
  ProdEtiquetasCatalogCategoria,
  ProdEtiquetasCatalogRow,
} from "@/types/prod-etiquetas-catalogo";

/** Papeles / materiales en hoja de ruta. */
export const ETIQUETAS_CATALOG_PAPEL: ProdEtiquetasCatalogCategoria[] = [
  "producto",
];

/** Campo producto en compras (papeles + tintas). */
export const ETIQUETAS_CATALOG_COMPRAS_PRODUCTO: ProdEtiquetasCatalogCategoria[] =
  ["producto", "tintas"];

function sortCatalogRows(a: ProdEtiquetasCatalogRow, b: ProdEtiquetasCatalogRow) {
  const c = a.categoria.localeCompare(b.categoria, "es");
  if (c !== 0) return c;
  const o = a.orden - b.orden;
  if (o !== 0) return o;
  return a.label.localeCompare(b.label, "es");
}

/** Labels activos del catálogo para datalist (sin duplicados, ordenados). */
export function catalogLabels(
  catalog: ProdEtiquetasCatalogRow[],
  categorias: ProdEtiquetasCatalogCategoria[]
): string[] {
  const catSet = new Set(categorias);
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = catalog
    .filter((c) => catSet.has(c.categoria) && c.activo)
    .slice()
    .sort(sortCatalogRows);
  for (const c of sorted) {
    const label = c.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Une sugerencias de catálogo con valores ya usados (p. ej. filtro papel en tabla). */
export function mergeCatalogAndUsedLabels(
  catalogLabelsList: string[],
  used: Iterable<string>
): string[] {
  const seen = new Set(catalogLabelsList.map((s) => s.toLowerCase()));
  const out = [...catalogLabelsList];
  const extra: string[] = [];
  for (const raw of used) {
    const label = String(raw ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(label);
  }
  extra.sort((a, b) => a.localeCompare(b, "es"));
  return [...out, ...extra];
}
