/** Trunca título de trabajo para caber en cartela. */
export function truncateCartelaTitulo(text: string, max = 52): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Extrae título tras "OT - " en ref_lote (import Optimus). */
export function tituloFromRefLote(
  refLote: string | null | undefined,
  otNumero: string
): string | null {
  if (!refLote?.trim()) return null;
  const prefix = `${otNumero.trim()} - `;
  if (refLote.startsWith(prefix)) {
    const rest = refLote.slice(prefix.length).trim();
    return rest || null;
  }
  return null;
}
