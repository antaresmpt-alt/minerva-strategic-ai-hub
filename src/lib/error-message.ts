/** Mensaje legible desde Error, PostgrestError u otros throws de Supabase. */
export function errorMessageFromUnknown(
  err: unknown,
  fallback = "Ha ocurrido un error inesperado.",
): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (err && typeof err === "object") {
    const e = err as {
      message?: unknown;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [e.message, e.details, e.hint, e.code ? `(${e.code})` : ""]
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => String(s).trim());
    if (parts.length > 0) return parts.join(" · ");
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}
