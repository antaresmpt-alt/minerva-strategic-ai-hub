import {
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  RAG_EMBEDDING_MODEL_RESOURCE,
} from "@/lib/rag-embedding";

const V1BETA = "https://generativelanguage.googleapis.com/v1beta";

function extractGenerateContentText(data: unknown): string {
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const parts = d.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
}

/**
 * `generateContent` REST v1beta — un solo turno user, texto completo (sin `system` separado).
 */
export async function fetchGeminiGenerateText(
  apiKey: string,
  modelId: string,
  promptText: string,
  opts?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  const url = `${V1BETA}/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        maxOutputTokens: opts?.maxOutputTokens ?? 8192,
        temperature: opts?.temperature ?? 0.2,
      },
    }),
  });
  const raw = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Gemini generateContent: ${res.status} ${raw.slice(0, 240)}`);
  }
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gemini generateContent HTTP ${res.status}`);
  }
  return extractGenerateContentText(data).trim();
}

export async function fetchGeminiEmbedContent(
  apiKey: string,
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const url = `${V1BETA}/models/${RAG_EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: RAG_EMBEDDING_MODEL_RESOURCE,
      content: { role: "user", parts: [{ text }] },
      taskType,
      outputDimensionality: RAG_EMBEDDING_DIMENSIONS,
    }),
  });
  const raw = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Gemini embedContent: ${res.status} ${raw.slice(0, 240)}`);
  }
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gemini embedContent HTTP ${res.status}`);
  }
  const values = (data as { embedding?: { values?: number[] } }).embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Respuesta de embedding inválida");
  }
  return values;
}
