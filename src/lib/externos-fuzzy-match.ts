/**
 * Coincidencia tipo «fragmento Excel ⊆ nombre en catálogo» (trim + lower case).
 * Si hay varias coincidencias, se elige el nombre de catálogo más corto (suele ser el más específico).
 */

export type FuzzyNamed = { id: string; nombre: string };

export function fuzzyMatchIdByIncludes(
  excelFragment: string,
  catalog: FuzzyNamed[]
): string {
  const needle = excelFragment.trim().toLowerCase();
  if (!needle) return "";
  const matches = catalog.filter((row) => {
    const hay = row.nombre.trim().toLowerCase();
    return hay.includes(needle);
  });
  if (matches.length === 0) return "";
  const sorted = [...matches].sort(
    (a, b) => a.nombre.length - b.nombre.length || a.nombre.localeCompare(b.nombre)
  );
  return sorted[0].id;
}

export type AcabadoFuzzyRow = FuzzyNamed & { tipo_proveedor_id: string };

/**
 * Igual que proveedor, pero solo entre acabados cuyo `tipo_proveedor_id` esté en la lista
 * (un solo tipo o varios si el proveedor es híbrido).
 */
export function fuzzyMatchAcabadoIdByIncludes(
  procesoExcel: string,
  acabados: AcabadoFuzzyRow[],
  tipoProveedorIds: string[] | null | undefined
): string {
  const needle = procesoExcel.trim().toLowerCase();
  if (!needle) return "";
  let pool = acabados;
  if (tipoProveedorIds && tipoProveedorIds.length > 0) {
    const allow = new Set(tipoProveedorIds);
    pool = acabados.filter((a) => allow.has(a.tipo_proveedor_id));
  }
  return fuzzyMatchIdByIncludes(procesoExcel, pool);
}
