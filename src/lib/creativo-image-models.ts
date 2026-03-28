import { DEFAULT_GEMINI_IMAGE_MODEL } from "@/lib/gemini-model";

function defaultServerImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}

/** Persistencia en el cliente (solo pestaña estática). */
export const CREATIVO_IMAGE_MODEL_STORAGE_KEY = "minerva-creativo-image-model";

export type CreativoImageModelChoice = {
  id: string;
  label: string;
  hint: string;
  isPro?: boolean;
};

/** Solo modelos compatibles con `generateContent` + salida de imagen (misma ruta API). */
export const CREATIVO_IMAGE_MODEL_OPTIONS: CreativoImageModelChoice[] = [
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    hint: "Recomendado: buen equilibrio calidad, velocidad y coste.",
  },
  {
    id: "gemini-2.5-flash-image-preview",
    label: "Gemini 2.5 Flash Image (preview)",
    hint: "Variante preview; cuotas o disponibilidad pueden diferir.",
  },
  {
    id: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image (preview)",
    hint: "Mayor calidad; suele consumir más tokens y coste.",
    isPro: true,
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (preview)",
    hint: "Enfoque en velocidad; confirma en AI Studio que admite imagen en tu cuenta.",
  },
  {
    id: "__env__",
    label: "Servidor: GEMINI_IMAGE_MODEL (.env)",
    hint: "Usa el modelo definido en el servidor (variable de entorno), no el ID del desplegable.",
  },
];

const ALLOWED_IDS = new Set(
  CREATIVO_IMAGE_MODEL_OPTIONS.map((o) => o.id)
);

export const DEFAULT_CREATIVO_UI_MODEL_ID = "gemini-2.5-flash-image";

export function isAllowedCreativoImageModelId(id: string): boolean {
  return ALLOWED_IDS.has(id);
}

/**
 * Resuelve el ID de modelo para la API (solo servidor).
 * - Vacío: mismo comportamiento que hasta ahora (`resolveGeminiImageModel()`).
 * - `__env__`: fuerza lectura de `GEMINI_IMAGE_MODEL` o default del paquete.
 * - Otro ID permitido: se usa tal cual.
 */
export function resolveCreativoImageModelForApi(
  bodyImageModel: unknown
): string {
  const raw =
    typeof bodyImageModel === "string" ? bodyImageModel.trim() : "";

  if (!raw) {
    return defaultServerImageModel();
  }

  if (!isAllowedCreativoImageModelId(raw)) {
    throw new Error("Modelo de imagen no permitido");
  }

  if (raw === "__env__") {
    return defaultServerImageModel();
  }

  return raw;
}
