/**
 * OTs de laboratorio Minerva (Manel): numeración ≥ 98000.
 * Igual espíritu que cartelas sandbox (≥99000), pero umbral de OT real de planta.
 */

export const OT_PRUEBA_NUM_MIN = 98000;

/** Extrae el número base (98010-01 → 98010). */
export function parseOtNumeroBase(ot: string | null | undefined): number | null {
  const m = String(ot ?? "")
    .trim()
    .match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** True si es OT de prueba/lab (≥ 98000), incl. hijas `98010-01`. */
export function isOtNumeroPrueba(ot: string | null | undefined): boolean {
  const n = parseOtNumeroBase(ot);
  return n != null && n >= OT_PRUEBA_NUM_MIN;
}
