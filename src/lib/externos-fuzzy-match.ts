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
 * Igual que proveedor, pero solo entre acabados del tipo de proveedor indicado (si existe).
 */
export function fuzzyMatchAcabadoIdByIncludes(
  procesoExcel: string,
  acabados: AcabadoFuzzyRow[],
  tipoProveedorId: string | null | undefined
): string {
  const needle = procesoExcel.trim().toLowerCase();
  if (!needle) return "";
  const pool =
    tipoProveedorId != null && tipoProveedorId !== ""
      ? acabados.filter((a) => a.tipo_proveedor_id === tipoProveedorId)
      : acabados;
  return fuzzyMatchIdByIncludes(procesoExcel, pool);
}
