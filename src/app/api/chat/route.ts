import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";

import { RAG_EMBEDDING_DIMENSIONS, RAG_EMBEDDING_MODEL } from "@/lib/rag-embedding";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Modelo generativo actual en la API Gemini (1.5 ya no está en v1beta). */
const CHAT_MODEL_ID = "gemini-2.5-flash";

const SYSTEM_PROMPT_PREFIX =
  "Eres Minerva AI, el asistente corporativo de Minerva Global. Usa ÚNICAMENTE el siguiente contexto para responder a la pregunta del usuario. Si la respuesta no está en el contexto, di amablemente que no tienes esa información. Contexto: \n\n";

const FUENTE_INSTRUCTION = `Instrucción obligatoria sobre el origen de la información:
- Al terminar tu respuesta, añade SIEMPRE una última línea nueva con este formato exacto: Fuente: [lista]
- En [lista] pon el valor "source" del documento del contexto que hayas utilizado (nombre de archivo u origen). Si has usado varios fragmentos con distinto origen, incluye TODOS los nombres separados por comas y un espacio (ej.: Fuente: Manual_Tolerancias.txt, Politica_Vacaciones.txt).
- Si solo has usado el bloque "Documento adicional aportado por el usuario", escribe: Fuente: Documento adjunto por el usuario
- Si no has podido basarte en ningún texto del contexto para responder, escribe: Fuente: N/A`;

function extractMetadataSource(row: Record<string, unknown>): string | null {
  let meta: unknown = row.metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta) as unknown;
    } catch {
      meta = null;
    }
  }
  if (meta && typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    if (typeof m.source === "string" && m.source.trim()) {
      return m.source.trim();
    }
  }
  if (typeof row.source === "string" && row.source.trim()) {
    return row.source.trim();
  }
  return null;
}

function textFromUIMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof (p as { text?: string }).text === "string"
    )
    .map((p) => p.text)
    .join("");
}

function getLastUserQuestion(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return textFromUIMessage(messages[i]).trim();
    }
  }
  return "";
}

function buildContextFromRpcRows(documents: unknown): {
  contexto: string;
  chunks: string[];
  sources: string[];
} {
  if (!Array.isArray(documents) || documents.length === 0) {
    return { contexto: "", chunks: [], sources: [] };
  }
  const chunks: string[] = [];
  const sources: string[] = [];
  const seenSources = new Set<string>();
  for (const row of documents) {
    if (row && typeof row === "object") {
      const r = row as Record<string, unknown>;
      const src = extractMetadataSource(r);
      if (src && !seenSources.has(src)) {
        seenSources.add(src);
        sources.push(src);
      }
      const text =
        typeof r.content === "string"
          ? r.content
          : typeof r.text === "string"
            ? r.text
            : typeof r.chunk === "string"
              ? r.chunk
              : "";
      if (text.trim()) chunks.push(text.trim());
    }
  }
  return { contexto: chunks.join("\n\n"), chunks, sources };
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY no configurada" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    const ultimaPregunta = getLastUserQuestion(raw);
    if (!ultimaPregunta) {
      return new Response(
        JSON.stringify({ error: "Se requiere un mensaje de usuario con texto" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    /* Mismo modelo y dimensión que en /api/ingest (text-embedding-004 no existe en v1beta para embedContent). */
    const embeddingResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${RAG_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${RAG_EMBEDDING_MODEL}`,
          content: { role: "user", parts: [{ text: ultimaPregunta }] },
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: RAG_EMBEDDING_DIMENSIONS,
        }),
      }
    );

    if (!embeddingResp.ok) {
      const errText = await embeddingResp.text();
      return new Response(
        JSON.stringify({
          error: `Embedding API: ${embeddingResp.status} ${errText}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const embeddingJson = (await embeddingResp.json()) as {
      embedding?: { values?: number[] };
    };
    const embeddingVector = embeddingJson.embedding?.values;
    if (!Array.isArray(embeddingVector) || embeddingVector.length === 0) {
      return new Response(JSON.stringify({ error: "Respuesta de embedding inválida" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: documents, error: rpcError } = await supabase.rpc("match_documents", {
      query_embedding: embeddingVector,
      match_threshold: 0.5,
      match_count: 3,
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let { contexto, sources: ragSources } = buildContextFromRpcRows(documents);

    const documentContext =
      typeof body.documentContext === "string" ? body.documentContext.trim() : "";
    const hasUserAttachment = documentContext.length > 0;
    if (documentContext) {
      contexto =
        contexto +
        (contexto ? "\n\n---\n\n" : "") +
        "Documento adicional aportado por el usuario:\n\n" +
        documentContext;
    }

    const sourcesHint =
      ragSources.length > 0
        ? `Orígenes (metadata.source) de los fragmentos recuperados: ${ragSources.join(", ")}.`
        : "No se recuperaron fragmentos desde la base vectorial para esta consulta.";

    const attachmentHint = hasUserAttachment
      ? "Hay además un documento adjunto por el usuario en el contexto (bloque indicado arriba)."
      : "";

    const systemPrompt = [
      SYSTEM_PROMPT_PREFIX + contexto,
      sourcesHint,
      attachmentHint,
      FUENTE_INSTRUCTION,
    ]
      .filter((s) => s.length > 0)
      .join("\n\n");

    const forModel = raw.map((m) => {
      const copy = { ...m };
      delete (copy as { id?: string }).id;
      return copy;
    });
    const modelMessages = await convertToModelMessages(forModel);

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiChat = genAI.getGenerativeModel({ model: CHAT_MODEL_ID });
    const google = createGoogleGenerativeAI({ apiKey });
    const languageModel = google(
      geminiChat.model.startsWith("models/")
        ? geminiChat.model.slice("models/".length)
        : geminiChat.model
    );

    const result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 1024,
      temperature: 0.25,
    });
    
    console.log("--- 🧠 Consulta RAG procesada con éxito ---");

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error("[Error en Chat RAG]:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        text: "Lo siento, el servidor tiene un problema: " + message,
      },
      { status: 200 }
    );
  }
}
