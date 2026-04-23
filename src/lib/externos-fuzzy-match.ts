/**
 * Coincidencia tipo «fragmento Excel ⊆ nombre en catálogo» (trim + lower case).
 * Si hay varias coincidencias, se elige el nombre de catálogo más corto (suele ser el más específico).
 */

export type FuzzyNamed = { id: string; nombre: string };

const STOPWORDS = new Set([
  "sl",
  "sa",
  "s",
  "l",
  "sociedad",
  "anonima",
  "limitada",
  "del",
  "de",
  "la",
  "el",
]);

const SYNONYMS: Record<string, string> = {
  polipropileno: "pp",
  plastificado: "plast",
  brillo: "brillo",
  mate: "mate",
  llobregat: "llobregat",
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(s\.?\s*l\.?|s\.?\s*a\.?)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTokens(s: string): string[] {
  const tokens = normalizeText(s)
    .split(" ")
    .map((t) => SYNONYMS[t] ?? t)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}

function tokenOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bs = new Set(b);
  const common = a.filter((x) => bs.has(x)).length;
  return common / Math.max(a.length, b.length);
}

export function fuzzyMatchBestIdByScore(
  input: string,
  catalog: FuzzyNamed[]
): { id: string; score: number } {
  const rawNeedle = normalizeText(input);
  const needleTokens = normalizeTokens(input);
  if (!rawNeedle) return { id: "", score: 0 };
  let best: { id: string; score: number } = { id: "", score: 0 };
  for (const row of catalog) {
    const hayRaw = normalizeText(row.nombre);
    const hayTokens = normalizeTokens(row.nombre);
    let score = 0;
    if (hayRaw === rawNeedle) {
      score = 1;
    } else if (hayRaw.includes(rawNeedle) || rawNeedle.includes(hayRaw)) {
      score = 0.85;
    } else {
      score = tokenOverlapScore(needleTokens, hayTokens);
      const prefixBonus =
        needleTokens.some((t) => hayTokens.some((h) => h.startsWith(t) || t.startsWith(h)))
          ? 0.08
          : 0;
      score = Math.min(0.99, score + prefixBonus);
    }
    if (score > best.score) {
      best = { id: row.id, score };
    }
  }
  return best;
}

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
