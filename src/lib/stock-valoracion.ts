/**
 * Valoración remanente de palets (Bloque 9.2).
 * `coste` en BD = compra total del palet (estilo Optimus); el remanente se prorratea por hojas.
 */

/** Coste en € del stock físico restante (null si no hay coste o sin físico). */
export function costeRemanentePalet(
  coste: number | null | undefined,
  cantidadInicial: number | null | undefined,
  cantidadActual: number | null | undefined,
): number | null {
  if (coste == null || !Number.isFinite(coste) || coste <= 0) return null;
  const ini = cantidadInicial ?? 0;
  const act = cantidadActual ?? 0;
  if (ini <= 0 || act <= 0) return null;
  if (act >= ini) return Math.round(coste * 100) / 100;
  return Math.round(((coste * act) / ini) * 100) / 100;
}

export type ReservaAtpLike = {
  cantidad_reservada: number | null;
};

/**
 * Palet sin reservas duras: todo el físico es libre (reimpresión etiqueta remanente).
 * Incluye sobrante tras consumo (refs OT blandas pueden quedar en bridge).
 */
export function esCartelaRemanenteLibre(
  cantidadActual: number,
  reservas: ReservaAtpLike[] | undefined,
): boolean {
  if (cantidadActual <= 0) return false;
  const reservadaTotal = (reservas ?? [])
    .filter((r) => r.cantidad_reservada != null && r.cantidad_reservada > 0)
    .reduce((acc, r) => acc + (r.cantidad_reservada ?? 0), 0);
  return reservadaTotal === 0;
}
