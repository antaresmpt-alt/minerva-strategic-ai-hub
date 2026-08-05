/**
 * Parseo decimal permisivo para inputs de producción (horas, metros, etc.).
 * Acepta `,` y `.` como separador decimal (teclado ES + teclado numérico).
 */

export function parseDecimalLoose(raw: string | null | undefined): number | null {
  const t = String(raw ?? "").trim().replace(/\s/g, "");
  if (!t) return null;

  // "1.234,56" (miles EN/ES) → quitar puntos de miles si hay coma decimal
  let normalized = t;
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else {
    normalized = normalized.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** ¿El texto es un borrador válido mientras se escribe? (p. ej. "0,", "0.", "-", ""). */
export function isDecimalDraft(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return true;
  return /^-?\d*[.,]?\d*$/.test(t);
}
