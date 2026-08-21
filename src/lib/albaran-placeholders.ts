/**
 * Valores de albarán considerados "sin número real" (placeholder).
 *
 * Fuente de verdad en TS para UI (Cartelas filtro, Compras UX).
 * KEEP IN SYNC con `public.prod_albaran_es_placeholder()` en
 * `supabase/migrations/*_sync_albaran_compra_recepcion.sql`
 * y `supabase/sql/prod_compra_material_sync_recepcion.sql`.
 */

/** Valor canónico que persiste el sync cuando la compra no tiene albarán. */
export const ALBARAN_PLACEHOLDER_CANONICO = "-" as const;

/**
 * Lista nombrada de placeholders (trim + comparación case-insensitive
 * donde aplica). Incluye vacío y variantes legibles.
 */
export const ALBARAN_PLACEHOLDERS = [
  "",
  ALBARAN_PLACEHOLDER_CANONICO,
  "(sin albarán)",
  "(sin albaran)",
] as const;

export type AlbaranPlaceholder = (typeof ALBARAN_PLACEHOLDERS)[number];

/** Normaliza para comparar (trim; lower solo para variantes con texto). */
export function normalizeAlbaranKey(
  value: string | null | undefined
): string {
  return (value ?? "").trim();
}

/**
 * True si el albarán no es un número/código real de proveedor
 * (vacío, "-", "(sin albarán)", etc.).
 */
export function esAlbaranPlaceholder(
  value: string | null | undefined
): boolean {
  const t = normalizeAlbaranKey(value);
  if (t === "") return true;
  if (t === ALBARAN_PLACEHOLDER_CANONICO) return true;
  const lower = t.toLowerCase();
  return lower === "(sin albarán)" || lower === "(sin albaran)";
}

/** Valor a persistir en recepción cuando la compra no trae albarán. */
export function albaranParaRecepcion(
  value: string | null | undefined
): string {
  const t = normalizeAlbaranKey(value);
  return t.length > 0 && !esAlbaranPlaceholder(t)
    ? t
    : ALBARAN_PLACEHOLDER_CANONICO;
}
