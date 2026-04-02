import { META_PROPOSAL_SYSTEM } from "@/lib/meta-proposal-prompt";

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const OPENAI_MODEL = "gpt-4o";

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

async function generateWithAnthropic(params: {
  userText: string;
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
      max_tokens: 8192,
      system: META_PROPOSAL_SYSTEM,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: params.userText }],
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

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    throw new Error("Anthropic devolvió una respuesta no JSON.");
  }
  const content = (body as { content?: { type?: string; text?: string }[] })
    .content;
  const block = content?.find((c) => c.type === "text");
  const text = block?.text?.trim();
  if (!text) throw new Error("Anthropic no devolvió texto.");
  return text;
}

async function generateWithOpenAI(params: {
  userText: string;
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
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: META_PROPOSAL_SYSTEM },
        { role: "user", content: params.userText },
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

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI devolvió una respuesta no JSON.");
  }
  const choice = (body as { choices?: { message?: { content?: string } }[] })
    .choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error("OpenAI no devolvió texto.");
  return text;
}

/**
 * JSON de propuesta Meta Ads: Claude 3.5 Sonnet primario, GPT-4o si falla o no hay Anthropic.
 */
export async function generateMetaProposalModelText(params: {
  userText: string;
  signal?: AbortSignal;
}): Promise<string> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Configura ANTHROPIC_API_KEY u OPENAI_API_KEY para generar la propuesta."
    );
  }

  if (hasAnthropic) {
    try {
      return await generateWithAnthropic(params);
    } catch (e) {
      if (!hasOpenAI) throw e;
    }
  }

  return generateWithOpenAI(params);
}

export function parseMetaProposalJson(raw: string): unknown {
  const extracted = extractJsonObject(raw);
  return JSON.parse(extracted) as unknown;
}
