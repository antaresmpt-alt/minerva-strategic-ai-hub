import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const KNOWLEDGE_BASE_DIR = path.join(
  process.cwd(),
  "public",
  "data",
  "knowledge-base"
);

const MINERVA_AI_SYSTEM = `Eres Minerva AI, el asistente corporativo exclusivo de Minerva Global (empresa de packaging técnico para pharma y cosmética). Tus respuestas deben ser extremadamente concisas, directas y profesionales. No uses introducciones largas. Si te piden tareas muy largas, resume la idea principal para ahorrar tokens.`;

/** Límite aproximado para la memoria base (Gemini 2.5 Flash admite contexto amplio). */
const MAX_KNOWLEDGE_BASE_CHARS = 500_000;

/** Límite para el PDF adjunto por el usuario en cada petición. */
const MAX_DOCUMENT_CONTEXT_CHARS = 80_000;

/**
 * Caché global: el texto parseado de todos los PDF de la carpeta.
 * `null` = aún no se ha cargado; tras el primer intento queda string (posiblemente vacío).
 */
let cachedKnowledgeBase: string | null = null;

async function getKnowledgeBaseText(): Promise<string> {
  if (cachedKnowledgeBase !== null) {
    return cachedKnowledgeBase;
  }

  const chunks: string[] = [];

  try {
    const entries = await fs.readdir(KNOWLEDGE_BASE_DIR, { withFileTypes: true });
    const pdfNames = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    for (const name of pdfNames) {
      const fullPath = path.join(KNOWLEDGE_BASE_DIR, name);
      const buffer = await fs.readFile(fullPath);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const text = (result.text ?? "").trim();
        if (text) {
          chunks.push(`DOCUMENTO: ${name}\n${text}`);
        }
      } finally {
        await parser.destroy();
      }
    }
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
    if (code !== "ENOENT") {
      console.error("[api/chat] Error leyendo knowledge-base:", e);
    }
  }

  cachedKnowledgeBase = chunks.join("\n\n");
  return cachedKnowledgeBase;
}

function buildSystemPrompt(
  knowledgeBaseText: string,
  documentContext: string | undefined
): string {
  const sections: string[] = [MINERVA_AI_SYSTEM];

  const kb = knowledgeBaseText.trim();
  if (kb) {
    let body = kb;
    if (body.length > MAX_KNOWLEDGE_BASE_CHARS) {
      body =
        body.slice(0, MAX_KNOWLEDGE_BASE_CHARS) +
        "\n\n[... base de conocimiento truncada por límite de contexto ...]";
    }
    sections.push(
      "A CONTINUACIÓN SE TE PROPORCIONA LA BASE DE CONOCIMIENTO DE LA EMPRESA. USA ESTA INFORMACIÓN PARA RESPONDER CUANDO APLIQUE:\n\n" +
        body
    );
  }

  if (documentContext?.trim()) {
    let doc = documentContext.trim();
    if (doc.length > MAX_DOCUMENT_CONTEXT_CHARS) {
      doc =
        doc.slice(0, MAX_DOCUMENT_CONTEXT_CHARS) +
        "\n\n[... texto del documento truncado por límite de contexto ...]";
    }
    sections.push(
      `CONTEXTO ADICIONAL DEL DOCUMENTO PROPORCIONADO POR EL USUARIO:\n${doc}\n\nResponde basándote en este contexto cuando sea relevante para la pregunta. Si la consulta no guarda relación con el documento, responde con conocimiento general (y con la base de empresa si aplica) manteniendo las mismas reglas de brevedad y tono corporativo.`
    );
  }

  return sections.join("\n\n");
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

    const knowledgeBaseText = await getKnowledgeBaseText();

    const result = streamText({
      model: getGoogleModel(),
      system: buildSystemPrompt(knowledgeBaseText, documentContext),
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
