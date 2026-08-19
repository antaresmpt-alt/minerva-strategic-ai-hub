/**
 * Librería compartida — Bloque 9.8.2
 * Comprueba si un formato de papel es suficiente para un troquel con márgenes mínimos.
 *
 * Usa 4 combinaciones (2 asignaciones de dimensiones del troquel × 2 orientaciones
 * del papel) para evitar asumir qué dimensión del troquel es "ancho" o "alto".
 *
 * Acordado en sesión 19 ago 2026 con análisis Claude + Cursor.
 * Futura reutilización: módulo de Presupuestos (Bloque 10).
 */

/**
 * Márgenes mínimos de impresión (todos en milímetros).
 *
 * - pinza:    margen inferior/agarre de la máquina (grip).
 * - superior: margen superior.
 * - lateral:  margen a CADA lado (total lateral = lateral × 2).
 */
export type MargenesImpr = {
  pinza: number;
  superior: number;
  lateral: number;
};

/** Valores por defecto — se leen de sys_parametros si existen. */
export const MARGENES_IMPR_DEFAULT: MargenesImpr = {
  pinza: 15,
  superior: 5,
  lateral: 10,
};

/** Claves en `sys_parametros` para los márgenes. */
export const SYS_PARAM_MARGENES = {
  pinza: "impr_margen_pinza",
  superior: "impr_margen_superior",
  lateral: "impr_margen_lateral",
} as const;

/**
 * Parsea "num1 x num2", "num1X num2", "num1×num2" → [num1, num2].
 * Acepta coma decimal o punto. Devuelve null si el formato no es válido.
 */
export function parseDimensions(text: string): [number, number] | null {
  const clean = String(text ?? "")
    .trim()
    .replace(/\s*(mm|cm|m)\s*$/i, "")
    .replace(/,/g, ".")
    .replace(/\s/g, "");
  const m = clean.match(/^(\d+(?:\.\d+)?)[xX×](\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return [a, b];
}

export type FormatoCabeResult = {
  /** Si alguna de las 4 combinaciones encaja, `cabe = true`. */
  cabe: boolean;
  /** False cuando falta datos (troquel o papel no parseable) — no mostrar aviso. */
  canCheck: boolean;
  /** Ancho mínimo necesario (mm) en la combo más canónica; null si cabe o no se puede calcular. */
  requiredAncho: number | null;
  /** Alto mínimo necesario (mm) en la combo más canónica; null si cabe o no se puede calcular. */
  requiredAlto: number | null;
};

/**
 * Umbral para autodetectar si el formato está en cm o mm.
 * Si ambas dimensiones son ≤ MAX_CM_DIM → se asume cm (×10).
 * Si alguna es > MAX_CM_DIM → se asume mm (ya en mm).
 *
 * 162 cm = 1620 mm = máximo formato de máquinas grandes (KBA Rapida 162).
 * Formatos standard de compra: 65×92, 72×102, 75×105, 100×140, 120×160 (todos ≤ 162).
 * Formatos post-guillotina en mm: 500×590, 650×920, etc. (todos > 162).
 */
const MAX_CM_DIM = 162;

/**
 * Comprueba si el papel cabe para el troquel con márgenes mínimos.
 * Autodetecta si el formato del papel está en cm o mm.
 *
 * @param formatoPapel - Formato del papel (ej. "72x102" en cm o "650x460" en mm).
 * @param midesTroquel - Medida de corte del troquel en **mm** (ej. "649.5x447.45").
 * @param margenes     - Márgenes en mm. Por defecto: MARGENES_IMPR_DEFAULT.
 */
export function checkFormatoCabe(
  formatoPapel: string,
  midesTroquel: string,
  margenes: MargenesImpr = MARGENES_IMPR_DEFAULT,
): FormatoCabeResult {
  const papel = parseDimensions(formatoPapel);
  const troquel = parseDimensions(midesTroquel);

  if (!papel || !troquel) {
    return { cabe: true, canCheck: false, requiredAncho: null, requiredAlto: null };
  }

  // Autodetección: si ambas dimensiones ≤ 162 → cm (×10); si alguna > 162 → ya en mm
  const esCm = papel[0] <= MAX_CM_DIM && papel[1] <= MAX_CM_DIM;
  const factor = esCm ? 10 : 1;
  const [pw_mm, ph_mm] = [papel[0] * factor, papel[1] * factor];
  const [t1, t2] = troquel; // ya en mm
  const { pinza, superior, lateral } = margenes;
  const totalVertical = pinza + superior;
  const totalLateral = lateral * 2;

  /**
   * 4 combinaciones:
   *   - Troquel: t1 o t2 como dimensión lateral (y la otra como dimensión vertical/alto)
   *   - Papel: orientación normal o rotado 90°
   *
   * Para cada combo: [dim_lateral_troquel, dim_alto_troquel, ancho_papel, alto_papel]
   */
  const combos: Array<[number, number, number, number]> = [
    [t1, t2, pw_mm, ph_mm], // troquel t1=lateral, t2=alto | papel normal
    [t1, t2, ph_mm, pw_mm], // troquel t1=lateral, t2=alto | papel rotado
    [t2, t1, pw_mm, ph_mm], // troquel t2=lateral, t1=alto | papel normal
    [t2, t1, ph_mm, pw_mm], // troquel t2=lateral, t1=alto | papel rotado
  ];

  for (const [tLateral, tAlto, pAncho, pAlto] of combos) {
    if (pAncho >= tLateral + totalLateral && pAlto >= tAlto + totalVertical) {
      return { cabe: true, canCheck: true, requiredAncho: null, requiredAlto: null };
    }
  }

  // No cabe en ninguna combinación.
  // Reporta el requerimiento mínimo de la combinación más canónica (t1=lateral, t2=alto, papel normal).
  const requiredAncho = Math.ceil(t1 + totalLateral);
  const requiredAlto = Math.ceil(t2 + totalVertical);

  return { cabe: false, canCheck: true, requiredAncho, requiredAlto };
}

/** Formatea el resultado como mensaje de aviso para el usuario. */
export function formatoCabeAvisoMsg(
  result: FormatoCabeResult,
  formatoPapel: string,
  troquelCode: string,
  margenes: MargenesImpr,
): string | null {
  if (!result.canCheck || result.cabe) return null;
  const req = result.requiredAncho != null && result.requiredAlto != null
    ? ` Mínimo estimado: ${(result.requiredAncho / 10).toFixed(1)}×${(result.requiredAlto / 10).toFixed(1)} cm.`
    : "";
  return (
    `Estimación: con márgenes mínimos (pinza ${margenes.pinza} mm, superior ${margenes.superior} mm, ` +
    `laterales ${margenes.lateral} mm/lado), el papel ${formatoPapel} podría ser demasiado pequeño ` +
    `para el troquel ${troquelCode}.${req} ` +
    `Verificar con CTP/troquelador. No bloquea.`
  );
}
