/**
 * Modelo por defecto para la API Gemini (Google AI Studio).
 * Los alias antiguos (p. ej. gemini-1.5-flash) suelen devolver 404 al desaparecer del endpoint v1beta.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function resolveGeminiModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
}

/**
 * Modelo de imagen nativa (Creativo IA — generateContent + responseModalities).
 * El preview 2.0 (`gemini-2.0-flash-preview-image-generation`) ya no está en v1beta.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image
 */
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
