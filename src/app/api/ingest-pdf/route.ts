import "@/lib/pdf-node-globals";
import { ensurePdfParseWorker } from "@/lib/pdf-parse-server";

import {
  GoogleGenerativeAI,
  TaskType,
  type EmbedContentRequest,
} from "@google/generative-ai";
import { NextRequest } from "next/server";
import { PDFParse } from "pdf-parse";

import { RAG_EMBEDDING_DIMENSIONS, RAG_EMBEDDING_MODEL } from "@/lib/rag-embedding";
import { RAG_DOCUMENTS_TABLE } from "@/lib/rag-table";
import { sanitizeExtractedDocumentText } from "@/lib/sanitize-text";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
/** PDF + Gemini + embeddings pueden superar el límite por defecto en despliegues. */
export const maxDuration = 300;

/** Gemini para estructurar Markdown (1.5-flash suele no estar en v1beta; 2.5-flash es estable). */
const MARKDOWN_MODEL = "gemini-1.5-flash";

const MAX_RAW_CHARS_FOR_GEMINI = 450_000;
const CHUNK_TARGET_CHARS = 2200;

function chunkMarkdownForRag(markdown: string, maxChunk = CHUNK_TARGET_CHARS): string[] {
  const blocks = markdown
    .trim()
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) out.push(t);
    buf = "";
  };

  for (const block of blocks) {
    if (block.length > maxChunk) {
      flush();
      const lines = block.split("\n");
      let lineAcc = "";
      for (const line of lines) {
        const candidate = lineAcc ? `${lineAcc}\n${line}` : line;
        if (candidate.length > maxChunk && lineAcc) {
          out.push(lineAcc.trim());
          lineAcc = line;
        } else {
          lineAcc = candidate;
        }
      }
      if (lineAcc.trim()) {
        buf = lineAcc;
        flush();
      }
      continue;
    }

    const merged = buf ? `${buf}\n\n${block}` : block;
    if (merged.length <= maxChunk) {
      buf = merged;
    } else {
      flush();
      buf = block;
    }
  }
  flush();
  return out;
}

function getEmbeddingModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: RAG_EMBEDDING_MODEL });
}

async function rawPdfToMarkdown(rawText: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MARKDOWN_MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  const prompt = `Eres un asistente técnico. Convierte el siguiente texto extraído de un PDF (ficha técnica, materiales, gramajes, rigidez, etc.) en Markdown bien estructurado.

Requisitos:
- Usa encabezados ## y ### donde encaje la jerarquía del documento.
- Las tablas de datos (gramajes, rigidez, especificaciones) deben quedar como tablas Markdown con columnas alineadas y cabeceras claras; no inventes celdas que no aparezcan en el texto.
- Listas con viñetas o numeración cuando el original lo sugiera.
- No añadas información que no esté en el texto. No inventes valores.
- Responde ÚNICAMENTE con el Markdown, sin texto previo ni bloques de código alrededor.

Texto bruto:

${rawText}`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return result.response.text().trim();
}

type NdjsonLine =
  | { type: "progress"; percent: number; step: string }
  | { type: "complete"; chunksProcessed: number; source: string }
  | { type: "error"; message: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY no configurada" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Formulario inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Archivo PDF requerido (campo file)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return new Response(JSON.stringify({ error: "Solo se admiten archivos PDF" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sourceRaw = formData.get("source");
  const source =
    typeof sourceRaw === "string" && sourceRaw.trim().length > 0
      ? sourceRaw.trim()
      : file.name;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (line: NdjsonLine) => {
        controller.enqueue(enc.encode(`${JSON.stringify(line)}\n`));
      };

      try {
        ensurePdfParseWorker();
        send({ type: "progress", percent: 8, step: "Leyendo PDF (servidor)" });

        const buffer = Buffer.from(await file.arrayBuffer());
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        let rawText: string;
        try {
          const textResult = await parser.getText();
          rawText = textResult.text ?? "";
        } finally {
          await parser.destroy();
        }

        rawText = sanitizeExtractedDocumentText(rawText);
        if (!rawText.trim()) {
          send({ type: "error", message: "No se extrajo texto del PDF (¿escaneado o protegido?)" });
          controller.close();
          return;
        }

        let forGemini = rawText;
        if (forGemini.length > MAX_RAW_CHARS_FOR_GEMINI) {
          forGemini = forGemini.slice(0, MAX_RAW_CHARS_FOR_GEMINI);
          send({
            type: "progress",
            percent: 18,
            step: "Texto truncado para estructuración (límite de modelo)",
          });
        } else {
          send({ type: "progress", percent: 22, step: "Texto extraído" });
        }

        send({ type: "progress", percent: 35, step: "Estructurando Markdown con Gemini" });
        const markdown = await rawPdfToMarkdown(forGemini, apiKey);
        if (!markdown.trim()) {
          send({ type: "error", message: "Gemini devolvió Markdown vacío" });
          controller.close();
          return;
        }

        send({ type: "progress", percent: 55, step: "Troceando contenido" });
        const chunks = chunkMarkdownForRag(markdown);
        if (chunks.length === 0) {
          send({ type: "error", message: "No se generaron chunks válidos" });
          controller.close();
          return;
        }

        const embedModel = getEmbeddingModel();
        let saved = 0;
        const total = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const result = await embedModel.embedContent({
            content: { role: "user", parts: [{ text: chunk }] },
            taskType: TaskType.RETRIEVAL_DOCUMENT,
            outputDimensionality: RAG_EMBEDDING_DIMENSIONS,
          } as EmbedContentRequest);
          const embeddingVector = result.embedding.values;

          const { error } = await supabase.from(RAG_DOCUMENTS_TABLE).insert({
            content: chunk,
            metadata: { source },
            embedding: embeddingVector,
          });

          if (error) {
            send({
              type: "error",
              message: `${error.message} (chunks guardados antes del fallo: ${saved})`,
            });
            controller.close();
            return;
          }
          saved += 1;
          const pct = 55 + Math.floor((45 * (i + 1)) / total);
          send({
            type: "progress",
            percent: Math.min(99, pct),
            step: `Vectorizando (${saved}/${total})`,
          });
        }

        send({ type: "complete", chunksProcessed: saved, source });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
