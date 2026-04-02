import type { CreativoCopy } from "@/lib/creativo-prompts";

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const OPENAI_MODEL = "gpt-4o";

const SYSTEM = `You write a single detailed English prompt for FLUX.1 (text-to-image) to produce one Meta/Facebook feed ad image.
Rules:
- Output ONLY the image prompt text in English, no quotes, no markdown, no preamble.
- Include layout, lighting, typography intent, and product category vibe from the advertiser data.
- Reflect the user's edit request precisely while staying brand-safe for social ads.`;

function userBlock(
  copy: CreativoCopy,
  w: number,
  h: number,
  variantHint: string,
  editInstruction: string
): string {
  const desc = copy.description?.trim() || "(none)";
  return `Advertiser data:
- Product name: ${copy.productName.trim()}
- CTA (must appear legibly): ${copy.cta.trim()}
- Product description / notes: ${desc}
- Canvas: ${w}×${h} px, format: ${variantHint}

User edit instruction (apply this):
${editInstruction.trim()}

Write one cohesive FLUX prompt that merges the product context with the edit instruction.`;
}

async function withAnthropic(params: {
  copy: CreativoCopy;
  w: number;
  h: number;
  variantHint: string;
  editInstruction: string;
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
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userBlock(
                params.copy,
                params.w,
                params.h,
                params.variantHint,
                params.editInstruction
              ),
            },
          ],
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

async function withOpenAI(params: {
  copy: CreativoCopy;
  w: number;
  h: number;
  variantHint: string;
  editInstruction: string;
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
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: userBlock(
            params.copy,
            params.w,
            params.h,
            params.variantHint,
            params.editInstruction
          ),
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
 * Combina descripción del producto + instrucción de edición en un único prompt para FLUX (vía texto).
 */
export async function generateCreativoEditImagePrompt(params: {
  copy: CreativoCopy;
  w: number;
  h: number;
  variantHint: string;
  editInstruction: string;
  signal?: AbortSignal;
}): Promise<string> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Configura ANTHROPIC_API_KEY u OPENAI_API_KEY para editar creatividades."
    );
  }

  if (hasAnthropic) {
    try {
      return await withAnthropic(params);
    } catch (e) {
      if (!hasOpenAI) throw e;
    }
  }

  return withOpenAI(params);
}
