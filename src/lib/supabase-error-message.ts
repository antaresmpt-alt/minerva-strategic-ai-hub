/** Extrae mensaje legible de errores Supabase/PostgREST y Error estándar. */
export function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message =
      (typeof candidate.message === "string" && candidate.message.trim()) ||
      (typeof candidate.error === "string" && candidate.error.trim()) ||
      (typeof candidate.details === "string" && candidate.details.trim()) ||
      (typeof candidate.hint === "string" && candidate.hint.trim()) ||
      (typeof candidate.code === "string" && candidate.code.trim()) ||
      "";
    if (message) return message;
  }
  return fallback;
}
