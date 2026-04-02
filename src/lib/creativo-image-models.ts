export type CreativoImageModelChoice = {
  id: string;
  label: string;
  hint: string;
  isPro?: boolean;
};

/** Generación vía Hugging Face Inference (FLUX.1-schnell en servidor). */
export const CREATIVO_IMAGE_MODEL_OPTIONS: CreativoImageModelChoice[] = [
  {
    id: "hf-flux-schnell",
    label: "FLUX.1-schnell (Hugging Face)",
    hint: "IA de alta precisión: modelo rápido FLUX en el router de Hugging Face.",
  },
];

const ALLOWED_IDS = new Set(CREATIVO_IMAGE_MODEL_OPTIONS.map((o) => o.id));

export const DEFAULT_CREATIVO_UI_MODEL_ID = "hf-flux-schnell";

export function isAllowedCreativoImageModelId(id: string): boolean {
  return ALLOWED_IDS.has(id);
}

/**
 * Valida el ID enviado desde el cliente (el servidor usa siempre HF / FLUX).
 */
export function resolveCreativoImageModelForApi(
  bodyImageModel: unknown
): string {
  const raw =
    typeof bodyImageModel === "string" ? bodyImageModel.trim() : "";

  if (!raw) {
    return DEFAULT_CREATIVO_UI_MODEL_ID;
  }

  if (!isAllowedCreativoImageModelId(raw)) {
    throw new Error("Modelo de imagen no permitido");
  }

  return raw;
}
