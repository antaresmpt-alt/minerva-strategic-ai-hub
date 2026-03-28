import sharp from "sharp";
import { DEFAULT_GEMINI_IMAGE_MODEL } from "@/lib/gemini-model";
import type { CreativoVariant } from "@/lib/creativo-variants";
import { VARIANT_META } from "@/lib/creativo-variants";

export function resolveGeminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}

export async function cropProductToVariant(
  input: Buffer,
  variant: CreativoVariant
): Promise<{ buffer: Buffer; mime: "image/png" }> {
  const { w, h } = VARIANT_META[variant];
  const buffer = await sharp(input)
    .rotate()
    .resize(w, h, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  return { buffer, mime: "image/png" };
}

export async function enforceDimensions(
  image: Buffer,
  w: number,
  h: number
): Promise<Buffer> {
  return sharp(image)
    .resize(w, h, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number };
};

export async function generateCreativoImageFromParts(params: {
  apiKey: string;
  model?: string;
  parts: GeminiPart[];
}): Promise<Buffer> {
  const model = params.model ?? resolveGeminiImageModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: params.parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        temperature: 0.35,
      },
    }),
  });

  const raw = (await res.json()) as GeminiResponse;

  if (!res.ok) {
    const msg =
      raw.error?.message ||
      (typeof raw === "object" ? JSON.stringify(raw) : "Error Gemini");
    throw new Error(msg);
  }

  const parts = raw.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const mime = p.inlineData?.mimeType ?? "";
    const data = p.inlineData?.data;
    if (data && mime.startsWith("image/")) {
      return Buffer.from(data, "base64");
    }
  }

  const block = raw.promptFeedback?.blockReason;
  if (block) throw new Error(`Contenido bloqueado por políticas (${block}).`);
  throw new Error(
    "La IA no devolvió una imagen. Prueba otra foto o reformula el texto."
  );
}
