import "@/lib/pdf-node-globals";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDFs empaquetados en el deploy (p. ej. `public/data/knowledge-base`).
 * En Vercel el FS es efímero y de solo lectura: no uses carpetas tipo `uploads/` o
 * `contexto/` escritas en runtime; si el directorio no existe, `getKnowledgeBaseText`
 * devuelve cadena vacía (sin tirar la petición).
 */
const KNOWLEDGE_BASE_DIR = path.join(
  process.cwd(),
  "public",
  "data",
  "knowledge-base"
);

const MINERVA_AI_SYSTEM = `Eres el Asistente Inteligente de Minerva Global. Tu prioridad absoluta es responder utilizando la información de los DOCUMENTOS ADJUNTOS (PDF/TXT).

Tienes acceso a varios manuales: Seguridad, Formación y Horarios. Si el usuario pregunta por tiempos o jornadas, busca en 'Horarios'. Si pregunta por cursos, busca en 'Formación'.

- Si el usuario pregunta por 'formación', busca específicamente en el documento de formación.
- Si la información está en el contexto, úsala obligatoriamente citando el nombre del archivo si es posible.
- Si NO encuentras la información en los documentos, di exactamente: "No encuentro información específica sobre eso en los manuales de Minerva, pero basándome en mi conocimiento general..."
  Tras esa frase, solo completa con conocimiento general breve y profesional; no inventes datos corporativos.

Sé conciso. El contexto corporativo usa bloques "ARCHIVO: …" y "CONTENIDO: …"; cita el nombre de archivo que aparezca en ARCHIVO cuando respondas.`;

/** Delimita todo el texto extraído de PDFs que recibe el modelo en el system prompt. */
const CONTEXT_START = "--- INICIO DEL CONTEXTO DE MINERVA ---";
const CONTEXT_END = "--- FIN DEL CONTEXTO ---";

/** Límite aproximado para la memoria base (Gemini 2.5 Flash admite contexto amplio). */
const MAX_KNOWLEDGE_BASE_CHARS = 500_000;

/** Límite para el PDF adjunto por el usuario en cada petición. */
const MAX_DOCUMENT_CONTEXT_CHARS = 80_000;

/**
 * Caché global: texto concatenado de todos los .pdf y .txt de la carpeta.
 * `null` = aún no se ha cargado; tras el primer intento queda string (posiblemente vacío).
 */
let cachedKnowledgeBase: string | null = null;

function isKnowledgeBaseFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".txt");
}

async function loadSingleKnowledgeFile(
  name: string,
  PDFParse: typeof import("pdf-parse").PDFParse
): Promise<string | null> {
  const fullPath = path.join(KNOWLEDGE_BASE_DIR, name);
  if (name.toLowerCase().endsWith(".txt")) {
    const text = (await fs.readFile(fullPath, "utf8")).trim();
    if (!text) return null;
    return `ARCHIVO: ${name}\nCONTENIDO: ${text}`;
  }
  const buffer = await fs.readFile(fullPath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    if (!text) return null;
    return `ARCHIVO: ${name}\nCONTENIDO: ${text}`;
  } finally {
    await parser.destroy();
  }
}

async function getKnowledgeBaseText(): Promise<string> {
  if (cachedKnowledgeBase !== null) {
    return cachedKnowledgeBase;
  }

  try {
    const entries = await fs.readdir(KNOWLEDGE_BASE_DIR, { withFileTypes: true });
    const fileNamesArray = entries
      .filter((e) => e.isFile() && isKnowledgeBaseFile(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    console.log("Archivos leídos para el contexto:", fileNamesArray);

    if (fileNamesArray.length === 0) {
      cachedKnowledgeBase = "";
      return cachedKnowledgeBase;
    }

    const { PDFParse } = await import("pdf-parse");
    const chunks = await Promise.all(
      fileNamesArray.map((name) =>
        loadSingleKnowledgeFile(name, PDFParse).catch((err: unknown) => {
          console.error(`[api/chat] Error leyendo "${name}":`, err);
          return null;
        })
      )
    );

    cachedKnowledgeBase = chunks
      .filter((c): c is string => c != null && c.length > 0)
      .join("\n\n");
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
    if (code !== "ENOENT") {
      console.error("[api/chat] Error leyendo knowledge-base:", e);
    }
    cachedKnowledgeBase = "";
  }

  return cachedKnowledgeBase ?? "";
}

function buildSystemPrompt(
  knowledgeBaseText: string,
  documentContext: string | undefined
): string {
  const sections: string[] = [MINERVA_AI_SYSTEM];

  let kb = knowledgeBaseText.trim();
  if (kb.length > MAX_KNOWLEDGE_BASE_CHARS) {
    kb =
      kb.slice(0, MAX_KNOWLEDGE_BASE_CHARS) +
      "\n\n[... contexto corporativo truncado por límite ...]";
  }

  let userDoc = documentContext?.trim() ?? "";
  if (userDoc.length > MAX_DOCUMENT_CONTEXT_CHARS) {
    userDoc =
      userDoc.slice(0, MAX_DOCUMENT_CONTEXT_CHARS) +
      "\n\n[... documento adjunto truncado por límite ...]";
  }

  const contextPieces: string[] = [];
  if (kb) {
    contextPieces.push(
      "Base de conocimiento corporativa (cada manual: líneas ARCHIVO: nombre y CONTENIDO: texto):\n\n" +
        kb
    );
  }
  if (userDoc) {
    contextPieces.push(
      "Documento adicional aportado por el usuario en esta conversación:\n\n" + userDoc
    );
  }

  if (contextPieces.length > 0) {
    sections.push(
      [
        "Todo el texto entre las etiquetas siguientes es contexto documental de Minerva. Respétalo con prioridad absoluta.",
        "",
        CONTEXT_START,
        contextPieces.join("\n\n---\n\n"),
        CONTEXT_END,
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}

function getGoogleModel() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY (o GEMINI_API_KEY) no configurada"
    );
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
      temperature: 0.25,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        text: "Lo siento, el servidor tiene un problema: " + message,
      },
      { status: 200 }
    );
  }
}
