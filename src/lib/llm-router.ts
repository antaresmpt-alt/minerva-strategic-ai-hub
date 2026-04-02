import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

import {
  DEFAULT_GLOBAL_MODEL,
  type GlobalModelId,
  parseModelFromBody,
  resolveGoogleApiModel,
} from "@/lib/global-model";

export { parseModelFromBody };

export type LlmGenerateResult = {
  text: string;
  /** Modelo lógico usado (id del selector o fallback). */
  modelUsed: GlobalModelId;
  /** Se usó Gemini Flash porque el modelo pedido falló o no estaba disponible. */
  didFallback: boolean;
  /** Si hubo fallback: mensaje del error del modelo solicitado (p. ej. Anthropic). */
  fallbackReason?: string;
};

/** Campos opcionales para adjuntar a respuestas JSON de API y depurar en Red. */
export function llmFieldsForApiResponse(
  r: LlmGenerateResult
): {
  modelUsed: GlobalModelId;
  didFallback: boolean;
  fallbackReason?: string;
} {
  return {
    modelUsed: r.modelUsed,
    didFallback: r.didFallback,
    ...(r.fallbackReason ? { fallbackReason: r.fallbackReason } : {}),
  };
}

type GenerateOpts = {
  modelId: GlobalModelId;
  system?: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

function getGoogleApiKey(): string {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY (o GEMINI_API_KEY) no configurada"
    );
  }
  return key;
}

async function generateGoogle(
  logicalId: GlobalModelId,
  opts: GenerateOpts
): Promise<string> {
  const apiModel = resolveGoogleApiModel(logicalId);
  const genAI = new GoogleGenerativeAI(getGoogleApiKey());
  const model = genAI.getGenerativeModel({
    model: apiModel,
    systemInstruction: opts.system,
  });
  const result = await model.generateContent(
    {
      contents: [{ role: "user", parts: [{ text: opts.user }] }],
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens ?? 8192,
        temperature: opts.temperature ?? 0.4,
      },
    },
    { signal: opts.signal }
  );
  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error("El modelo no devolvió texto.");
  }
  return text.trim();
}

async function generateAnthropic(opts: GenerateOpts): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY no configurada");
  }
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create(
    {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: opts.maxOutputTokens ?? 8192,
      temperature: opts.temperature ?? 0.4,
      ...(opts.system?.trim()
        ? { system: opts.system }
        : {}),
      messages: [{ role: "user", content: opts.user }],
    },
    { signal: opts.signal }
  );
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");
  if (!text.trim()) {
    throw new Error("El modelo no devolvió texto.");
  }
  return text.trim();
}

async function generateOpenAI(opts: GenerateOpts): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY no configurada");
  }
  const openai = new OpenAI({ apiKey: key });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (opts.system?.trim()) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: opts.user });
  const r = await openai.chat.completions.create(
    {
      model: "gpt-4o",
      messages,
      max_tokens: opts.maxOutputTokens ?? 8192,
      temperature: opts.temperature ?? 0.4,
    },
    { signal: opts.signal }
  );
  const text = r.choices[0]?.message?.content;
  if (!text?.trim()) {
    throw new Error("El modelo no devolvió texto.");
  }
  return text.trim();
}

async function dispatch(
  modelId: GlobalModelId,
  opts: GenerateOpts
): Promise<string> {
  switch (modelId) {
    case "gemini-1.5-flash":
    case "gemini-1.5-pro":
      return generateGoogle(modelId, opts);
    case "claude-3-5-sonnet":
      return generateAnthropic(opts);
    case "gpt-4o":
      return generateOpenAI(opts);
    default: {
      const _exhaustive: never = modelId;
      return _exhaustive;
    }
  }
}

/**
 * Genera texto con el modelo indicado. Si falla (red, claves, cuota, etc.),
 * reintenta una sola vez con Gemini Flash (`gemini-1.5-flash` → API `gemini-2.5-flash`).
 */
export async function generateLlmText(
  opts: GenerateOpts
): Promise<LlmGenerateResult> {
  const requested = opts.modelId;
  try {
    const text = await dispatch(requested, opts);
    return { text, modelUsed: requested, didFallback: false };
  } catch (first) {
    const reason =
      first instanceof Error ? first.message : String(first);
    console.warn(
      `[llm-router] primary failed: requested=${requested}`,
      reason
    );
    if (requested === DEFAULT_GLOBAL_MODEL) {
      throw first;
    }
    try {
      const text = await dispatch(DEFAULT_GLOBAL_MODEL, {
        ...opts,
        modelId: DEFAULT_GLOBAL_MODEL,
      });
      console.warn(
        `[llm-router] fallback ok: used=${DEFAULT_GLOBAL_MODEL} (after ${requested})`
      );
      return {
        text,
        modelUsed: DEFAULT_GLOBAL_MODEL,
        didFallback: true,
        fallbackReason: reason,
      };
    } catch (fallbackErr) {
      const fb =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr);
      console.error(
        `[llm-router] fallback failed: requested=${requested} → ${DEFAULT_GLOBAL_MODEL}`,
        fb
      );
      throw fallbackErr;
    }
  }
}
