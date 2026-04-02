import type { CreativoCopy } from "@/lib/creativo-prompts";

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const OPENAI_MODEL = "gpt-4o";

/** Resultado del modo automático (visión profunda). */
export type CreativoDeepAnalysis = {
  exactColors: string;
  packText: string;
  shapeForm: string;
};

const VISION_SYSTEM = `You analyze product packaging photos for faithful ad image generation.
Reply with ONLY a JSON object (no markdown fences, no commentary) using exactly these keys:
- "exactColors": string — precise colors on the pack (e.g. "Cobalt blue, mustard yellow, red foil details")
- "packText": string — text on the packaging and typography (e.g. "Nag Champa in black serif on gold band"); if unreadable, describe placement and style
- "shapeForm": string — physical form (e.g. "Elongated rectangular incense stick carton")

Be faithful to the image; do not invent brands or claims not visible.`;

const VISION_USER = `Analyze the attached product photo for the three JSON fields. English values preferred.`;

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function normalizeMime(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/gif") return "image/gif";
  if (m === "image/webp") return "image/webp";
  return "image/png";
}

function isAnalysis(x: unknown): x is CreativoDeepAnalysis {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.exactColors === "string" &&
    typeof o.packText === "string" &&
    typeof o.shapeForm === "string"
  );
}

async function analyzeWithAnthropicVision(params: {
  imageBase64: string;
  imageMime: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const mediaType = normalizeMime(params.imageMime);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: VISION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_USER },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: params.imageBase64.replace(/\s/g, ""),
              },
            },
          ],
        },
      ],
    }),
    signal: params.signal,
  });

  const rawText = await res.text();
  if (!res.ok) {
    let msg = rawText.slice(0, 400);
    try {
      const j = JSON.parse(rawText) as { error?: { message?: string } };
      msg = j.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`Anthropic: ${res.status} ${msg}`);
  }

  const body = JSON.parse(rawText) as {
    content?: { type?: string; text?: string }[];
  };
  const block = body.content?.find((c) => c.type === "text");
  const text = block?.text?.trim();
  if (!text) throw new Error("Anthropic no devolvió texto.");
  return text;
}

async function analyzeWithOpenAIVision(params: {
  imageBase64: string;
  imageMime: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const mime = normalizeMime(params.imageMime);
  const dataUrl = `data:${mime};base64,${params.imageBase64.replace(/\s/g, "")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISION_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: VISION_USER },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    signal: params.signal,
  });

  const rawText = await res.text();
  if (!res.ok) {
    let msg = rawText.slice(0, 400);
    try {
      const j = JSON.parse(rawText) as { error?: { message?: string } };
      msg = j.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`OpenAI: ${res.status} ${msg}`);
  }

  const body = JSON.parse(rawText) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI no devolvió texto.");
  return text;
}

/**
 * Modo automático: visión profunda del pack (Claude primero, GPT-4o visión si falla).
 */
export async function analyzeProductImageDeep(params: {
  imageBase64: string;
  imageMime: string;
  signal?: AbortSignal;
}): Promise<CreativoDeepAnalysis> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Configura ANTHROPIC_API_KEY u OPENAI_API_KEY para analizar el producto."
    );
  }

  let raw: string;
  if (hasAnthropic) {
    try {
      raw = await analyzeWithAnthropicVision(params);
    } catch (e) {
      if (!hasOpenAI) throw e;
      raw = await analyzeWithOpenAIVision(params);
    }
  } else {
    raw = await analyzeWithOpenAIVision(params);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new Error(
      "La IA no devolvió un análisis JSON válido del producto. Reintenta."
    );
  }

  if (!isAnalysis(parsed)) {
    throw new Error("Análisis visual incompleto. Reintenta.");
  }

  return parsed;
}

const FLUX_COMPOSER_SYSTEM = `You write ONE English paragraph for FLUX.1 text-to-image: a Meta/Facebook static ad featuring the REAL product from the analysis.

Hard rules:
- Output ONLY the paragraph, no quotes, no markdown.
- The paragraph MUST follow this structure (same order, same opening/closing phrases):
  1) Start with exactly: Professional studio product photography of
  2) Immediately describe the product using ONLY the automatic analysis (colors, pack text/typography, shape). Do not substitute a different product category.
  3) Then exactly:  Context: 
  4) Merge: Meta ad layout for the given pixel size and format, advertiser copy (CTA, prices, product name), the creative brief, user extra instructions if any, and for edit actions the edit request. Spanish brief content should be reflected in English scene directions.
  5) Then exactly:  High resolution, commercial lighting, preserve branding integrity.
  6) Add one more sentence that forbids replacing the product with generic shopping bags, plain glass bottles, stock cardboard boxes, or unrelated packs unless the analysis explicitly describes them; the render must stay faithful to the analyzed silhouette, colors, and on-pack text.

Anti-invention: Never invent a different pack shape or erase visible branding from the analysis.`;

async function composeWithAnthropic(params: {
  payload: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: FLUX_COMPOSER_SYSTEM,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: params.payload }],
        },
      ],
    }),
    signal: params.signal,
  });

  const rawText = await res.text();
  if (!res.ok) {
    let msg = rawText.slice(0, 300);
    try {
      const j = JSON.parse(rawText) as { error?: { message?: string } };
      msg = j.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`Anthropic: ${res.status} ${msg}`);
  }

  const body = JSON.parse(rawText) as {
    content?: { type?: string; text?: string }[];
  };
  const block = body.content?.find((c) => c.type === "text");
  const text = block?.text?.trim();
  if (!text) throw new Error("Anthropic no devolvió texto.");
  return text;
}

async function composeWithOpenAI(params: {
  payload: string;
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
      messages: [
        { role: "system", content: FLUX_COMPOSER_SYSTEM },
        { role: "user", content: params.payload },
      ],
    }),
    signal: params.signal,
  });

  const rawText = await res.text();
  if (!res.ok) {
    let msg = rawText.slice(0, 300);
    try {
      const j = JSON.parse(rawText) as { error?: { message?: string } };
      msg = j.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`OpenAI: ${res.status} ${msg}`);
  }

  const body = JSON.parse(rawText) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI no devolvió texto.");
  return text;
}

function buildComposerPayload(params: {
  analysis: CreativoDeepAnalysis;
  copy: CreativoCopy;
  w: number;
  h: number;
  variantHint: string;
  extraInstructions?: string;
  action: "generate" | "regenerate" | "edit";
  editInstruction?: string;
  creativeBriefText: string;
}): string {
  const extra = params.extraInstructions?.trim() || "";
  const edit =
    params.action === "edit" ? (params.editInstruction ?? "").trim() : "";

  return `AUTOMATIC ANALYSIS (use verbatim for the product description in the opening phrase):
- Exact colors: ${params.analysis.exactColors}
- Pack text / typography: ${params.analysis.packText}
- Shape / form: ${params.analysis.shapeForm}

ADVERTISER (must appear legibly in the ad where relevant):
- Product name: ${params.copy.productName}
- CTA: ${params.copy.cta}
- Description: ${params.copy.description?.trim() || "(none)"}
- Prices if any: original ${params.copy.originalPrice ?? "—"}, offer ${params.copy.offerPrice ?? "—"}, discount ${params.copy.discountPct ?? "—"}

CANVAS: ${params.w}×${params.h} px, format: ${params.variantHint}

CREATIVE BRIEF (Spanish; translate intent into the Context section in English):
${params.creativeBriefText}

USER EXTRA INSTRUCTIONS (optional; merge into Context): ${extra || "(none)"}

ACTION: ${params.action}
${params.action === "edit" ? `USER EDIT REQUEST (apply in Context): ${edit}` : ""}

Write the single FLUX paragraph now.`;
}

/**
 * Prompt final para Hugging Face: plantilla solicitada + brief + instrucciones extra + anti-invención.
 */
export async function composeCreativoFluxPrompt(params: {
  analysis: CreativoDeepAnalysis;
  copy: CreativoCopy;
  w: number;
  h: number;
  variantHint: string;
  extraInstructions?: string;
  action: "generate" | "regenerate" | "edit";
  editInstruction?: string;
  creativeBriefText: string;
  signal?: AbortSignal;
}): Promise<string> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Configura ANTHROPIC_API_KEY u OPENAI_API_KEY para componer el creativo."
    );
  }

  const payload = buildComposerPayload(params);

  if (hasAnthropic) {
    try {
      return await composeWithAnthropic({ payload, signal: params.signal });
    } catch (e) {
      if (!hasOpenAI) throw e;
    }
  }

  return composeWithOpenAI({ payload, signal: params.signal });
}
