/**
 * Identificadores del selector global (Header). Los nombres orientan al usuario;
 * el router (`llm-router.ts`) los traduce a IDs reales de cada proveedor.
 */
export const GLOBAL_MODEL_IDS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "claude-3-5-sonnet",
  "gpt-4o",
] as const;

export type GlobalModelId = (typeof GLOBAL_MODEL_IDS)[number];

export const DEFAULT_GLOBAL_MODEL: GlobalModelId = "gemini-1.5-flash";

export function isGlobalModelId(v: string): v is GlobalModelId {
  return (GLOBAL_MODEL_IDS as readonly string[]).includes(v);
}

export function parseModelFromBody(model: unknown): GlobalModelId {
  if (typeof model === "string" && isGlobalModelId(model)) {
    return model;
  }
  return DEFAULT_GLOBAL_MODEL;
}

/** Modelo Google API estable (v1beta); los alias "1.5" del UI apuntan aquí cuando aplica. */
export function resolveGoogleApiModel(id: GlobalModelId): string {
  switch (id) {
    case "gemini-1.5-flash":
      return "gemini-2.5-flash";
    case "gemini-1.5-pro":
      return "gemini-2.5-pro";
    default:
      return "gemini-2.5-flash";
  }
}
