import {
  VIDEO_SCRIPT_SYSTEM,
  buildVideoScriptUserPrompt,
} from "@/lib/creativo-video-prompt";

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const OPENAI_MODEL = "gpt-4o";

function normalizeMime(mime: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/gif") return "image/gif";
  if (m === "image/webp") return "image/webp";
  return "image/png";
}

async function generateWithAnthropic(params: {
  userText: string;
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
      max_tokens: 8192,
      system: VIDEO_SCRIPT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.userText },
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

async function generateWithOpenAI(params: {
  userText: string;
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
      messages: [
        { role: "system", content: VIDEO_SCRIPT_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: params.userText },
            {
              type: "image_url",
              image_url: { url: dataUrl },
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
    throw new Error(`OpenAI: ${res.status} ${msg}`);
  }

  const body = JSON.parse(rawText) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI no devolvió texto.");
  return text;
}

export async function generateVideoScriptText(params: {
  productName: string;
  cta: string;
  description?: string;
  originalPrice: string;
  offerPrice: string;
  discountPct?: string;
  imageBase64: string;
  imageMime: string;
  signal?: AbortSignal;
}): Promise<string> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Configura ANTHROPIC_API_KEY u OPENAI_API_KEY para el guion de vídeo."
    );
  }

  const userText = buildVideoScriptUserPrompt({
    productName: params.productName,
    cta: params.cta,
    description: params.description,
    originalPrice: params.originalPrice,
    offerPrice: params.offerPrice,
    discountPct: params.discountPct,
  });

  const base = {
    userText,
    imageBase64: params.imageBase64,
    imageMime: params.imageMime,
    signal: params.signal,
  };

  if (hasAnthropic) {
    try {
      return await generateWithAnthropic(base);
    } catch (e) {
      if (!hasOpenAI) throw e;
    }
  }

  return generateWithOpenAI(base);
}
