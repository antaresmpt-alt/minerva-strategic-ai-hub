import { JsonToSseTransformStream } from "ai";

/**
 * Cuando `/api/chat` devuelve JSON `{ text }` con status 200 (fallback de error),
 * el transport por defecto del AI SDK espera un stream SSE de UI chunks.
 * Convierte ese JSON en una Response equivalente al stream normal.
 */
export function jsonChatErrorBodyToUiStreamResponse(text: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      const chunks = [
        { type: "start" as const },
        { type: "start-step" as const },
        { type: "text-start" as const, id: "chat-err-1" },
        { type: "text-delta" as const, id: "chat-err-1", delta: text },
        { type: "text-end" as const, id: "chat-err-1" },
        { type: "finish-step" as const },
        { type: "finish" as const },
      ];
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  })
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream());

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
      "x-accel-buffering": "no",
    },
  });
}

/** Fetch para `DefaultChatTransport`: si el servidor responde 200 JSON con `text`, la adapta al stream UI. */
export async function chatApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  const ct = res.headers.get("content-type") ?? "";
  if (res.status !== 200 || !ct.includes("application/json")) {
    return res;
  }
  let text: string;
  try {
    const data = (await res.json()) as { text?: unknown };
    text =
      typeof data.text === "string"
        ? data.text
        : "Lo siento, el servidor tiene un problema (respuesta no válida).";
  } catch {
    text = "Lo siento, no se pudo leer la respuesta del servidor.";
  }
  return jsonChatErrorBodyToUiStreamResponse(text);
}
