import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MINERVA_AI_SYSTEM = `Eres Minerva AI, el asistente corporativo exclusivo de Minerva Global (empresa de packaging técnico para pharma y cosmética). Tus respuestas deben ser extremadamente concisas, directas y profesionales. No uses introducciones largas. Si te piden tareas muy largas, resume la idea principal para ahorrar tokens.`;

function getGoogleModel() {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY no configurada");
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google("gemini-2.5-flash");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages?: UIMessage[];
    };

    const raw = body.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      return new Response(JSON.stringify({ error: "messages requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const forModel = raw.map((m) => {
      const copy = { ...m };
      delete (copy as { id?: string }).id;
      return copy;
    });
    const modelMessages = await convertToModelMessages(forModel);

    const result = streamText({
      model: getGoogleModel(),
      system: MINERVA_AI_SYSTEM,
      messages: modelMessages,
      maxOutputTokens: 1024,
    });

    return result.toUIMessageStreamResponse();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error del servidor";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
