/** Días naturales desde hoy hasta la fecha ISO (negativo si la entrega ya pasó). */
export function diasDesdeHastaFecha(
  iso: string | null | undefined
): number | null {
  if (iso == null || String(iso).trim() === "") return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const today = new Date();
  const d0 = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const d1 = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((d1 - d0) / 86400000);
}

/**
 * Más de `umbralSobrestock` días hasta entrega OT → aviso de sobrestock al solicitar material.
 * @param umbralSobrestock días (p. ej. desde `sys_parametros`); por defecto 30.
 */
export function esPrioridadStockAmarilla(
  fechaEntregaMaestro: string | null | undefined,
  umbralSobrestock: number = 30
): boolean {
  const d = diasDesdeHastaFecha(fechaEntregaMaestro);
  if (d === null) return false;
  return d > umbralSobrestock;
}
