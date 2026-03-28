/**
 * Modelo por defecto para la API Gemini (Google AI Studio).
 * Los alias antiguos (p. ej. gemini-1.5-flash) suelen devolver 404 al desaparecer del endpoint v1beta.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function resolveGeminiModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
}
