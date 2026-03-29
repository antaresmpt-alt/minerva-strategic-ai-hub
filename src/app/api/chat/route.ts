import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MINERVA_AI_SYSTEM = `Eres Minerva AI, el asistente corporativo exclusivo de Minerva Global (empresa de packaging técnico para pharma y cosmética). Tus respuestas deben ser extremadamente concisas, directas y profesionales. No uses introducciones largas. Si te piden tareas muy largas, resume la idea principal para ahorrar tokens.`;

/** Límite de caracteres del documento en el system prompt (aprox. control de tokens). */
const MAX_DOCUMENT_CONTEXT_CHARS = 80_000;

function buildSystemPrompt(documentContext: string | undefined): string {
  if (!documentContext?.trim()) {
    return MINERVA_AI_SYSTEM;
  }
  let doc = documentContext.trim();
  if (doc.length > MAX_DOCUMENT_CONTEXT_CHARS) {
    doc =
      doc.slice(0, MAX_DOCUMENT_CONTEXT_CHARS) +
      "\n\n[... texto del documento truncado por límite de contexto ...]";
  }
  return `${MINERVA_AI_SYSTEM}

CONTEXTO ADICIONAL DEL DOCUMENTO PROPORCIONADO POR EL USUARIO:
${doc}

Responde basándote en este contexto cuando sea relevante para la pregunta. Si la consulta no guarda relación con el documento, responde con conocimiento general manteniendo las mismas reglas de brevedad y tono corporativo.`;
}

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
      documentContext?: string | null;
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

    const documentContext =
      typeof body.documentContext === "string"
        ? body.documentContext
        : undefined;

    const result = streamText({
      model: getGoogleModel(),
      system: buildSystemPrompt(documentContext),
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
