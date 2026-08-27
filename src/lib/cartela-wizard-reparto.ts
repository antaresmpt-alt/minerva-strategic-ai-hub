/**
 * Reparte hojas de albarán entre N palets físicos (resto en los primeros).
 * Ej. 16000 / 8 → ocho de 2000; 10 / 3 → 4, 3, 3.
 */
export function repartirHojasEntrePalets(total: number, n: number): number[] {
  const count = Math.max(0, Math.trunc(n));
  if (count <= 0) return [];
  const t = Math.max(0, Math.trunc(total));
  if (t <= 0) return Array.from({ length: count }, () => 0);
  const base = Math.floor(t / count);
  const rem = t % count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}
