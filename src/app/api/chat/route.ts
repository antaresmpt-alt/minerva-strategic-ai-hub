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

const MINERVA_AI_SYSTEM = `Eres Minerva AI, el asistente corporativo exclusivo de Minerva Global (empresa de packaging técnico para pharma y cosmética). Tus respuestas deben ser extremadamente concisas, directas y profesionales. No uses introducciones largas. Si te piden tareas muy largas, resume la idea principal para ahorrar tokens.

REGLAS DE CITAS Y FIABILIDAD (OBLIGATORIAS):
- Cuando respondas basándote en la información proporcionada en la Base de Conocimiento, DEBES citar el nombre del documento original (el nombre aparece en cada bloque tras la etiqueta "DOCUMENTO:").
- Añade la cita al final de la frase o párrafo relevante usando este formato exacto en cursiva: *(Fuente: NombreDelDocumento.pdf)* (sustituye NombreDelDocumento.pdf por el nombre real del archivo indicado en el bloque).
- Si la respuesta combina información de varios documentos, cítalos todos (una o más citas *(Fuente: …)* según corresponda).
- Si te preguntan algo que NO está en los documentos de la base de conocimiento ni en el contexto adicional delimitado abajo, responde amablemente que no tienes esa información en tu base de conocimiento actual, en lugar de inventarla (evita alucinaciones).
- Si usas el contexto del documento adjunto por el usuario y puedes identificar un nombre de archivo en las instrucciones, cítalo con el mismo formato *(Fuente: …)*; si no hay nombre explícito, puedes usar *(Fuente: documento adjunto por el usuario)*.`;

const KB_START = "--- BASE DE CONOCIMIENTO ---";
const KB_END = "--- FIN BASE DE CONOCIMIENTO ---";

const USER_DOC_START = "--- DOCUMENTO ADJUNTO POR EL USUARIO ---";
const USER_DOC_END = "--- FIN DOCUMENTO ADJUNTO ---";

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
      [
        "La siguiente sección contiene solo texto extraído de PDFs corporativos. Úsala para responder cuando aplique y aplica siempre las reglas de citas anteriores.",
        "",
        KB_START,
        body,
        KB_END,
      ].join("\n")
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
      [
        "Contexto adicional subido por el usuario en el chat (no confundir con la base de conocimiento salvo que lo indiques). Respeta las mismas reglas de citas y de no inventar información.",
        "",
        USER_DOC_START,
        doc,
        USER_DOC_END,
        "",
        "Si la consulta no guarda relación con este documento, responde con conocimiento general (y con la base de empresa si aplica) manteniendo brevedad y tono corporativo.",
      ].join("\n")
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
