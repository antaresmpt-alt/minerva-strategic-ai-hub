import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";

import {
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  RAG_EMBEDDING_MODEL_RESOURCE,
} from "@/lib/rag-embedding";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Modelo generativo actual en la API Gemini (1.5 ya no está en v1beta). */
const CHAT_MODEL_ID = "gemini-2.5-flash";

const SYSTEM_PROMPT_PREFIX = `Eres Minerva, la asistente corporativa avanzada de Minerva Global.
Tu objetivo es proporcionar respuestas precisas, profesionales y eficientes a los empleados de la empresa, facilitando su trabajo diario.

REGLAS DE ORO (ESTRICTAS):
1. CERO ALUCINACIONES: Basa tu respuesta ÚNICA Y EXCLUSIVAMENTE en la información proporcionada en el bloque "Contexto" inferior. 
2. LÍMITES CLAROS: Si la respuesta no está en el contexto, NO inventes, deduzcas ni supongas nada. Responde con naturalidad: "Lo siento, revisando la documentación actual no encuentro información sobre esto. Por favor, consúltalo con el departamento correspondiente."
3. RESPUESTAS PARCIALES: Si el contexto tiene solo una parte de la respuesta, entrégala e indica claramente que no dispones de los detalles completos.

ESTILO Y FORMATO (CRÍTICO):
- Ve directo al grano. Evita introducciones robóticas como "Basado en el contexto proporcionado...".
- Usa Markdown para estructurar la información: utiliza listas con viñetas para enumerar, y usa **negritas** para resaltar conceptos clave, nombres o fechas.
- Tu tono debe ser profesional, empático, claro y muy resolutivo. Eres parte del equipo.

Contexto: \n\n`;

/*  "Eres Minerva AI, el asistente corporativo de Minerva Global. Usa ÚNICAMENTE el siguiente contexto para responder a la pregunta del usuario. Si la respuesta no está en el contexto, di amablemente que no tienes esa información. Contexto: \n\n"; */

const FUENTE_INSTRUCTION = `INSTRUCCIÓN CRÍTICA SOBRE EL ORIGEN DE LA INFORMACIÓN (CITAS):
Tu respuesta DEBE terminar SIEMPRE con el bloque de fuentes, siguiendo ESTRICTAMENTE estas reglas:

1. Añade una línea separadora de Markdown (---) y luego el texto exacto: **Fuente:** [lista]
2. Reglas para generar la [lista]:
   - Extrae el valor "source" de los fragmentos de contexto utilizados.
   - NO REPITAS nombres (si usas 3 fragmentos del mismo PDF, pon el nombre solo una vez).
   - Separa múltiples archivos con comas (ej.: **Fuente:** Manual_Calidad.pdf, ISO_9001.pdf).
   - Si has usado información del "Documento adicional aportado por el usuario", añádelo a la lista como "Documento adjunto" (ej.: **Fuente:** Ficha_Tecnica.pdf, Documento adjunto).
   - Si SOLO usaste el documento del usuario, escribe: **Fuente:** Documento adjunto.
   - Si no has usado el contexto (Fuente: N/A).
3. PROHIBIDO añadir texto conversacional (como "Espero que esto ayude") DESPUÉS del bloque de fuentes. Las fuentes deben ser ABSOLUTAMENTE el final de tu mensaje.`;

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

    /* Mismo modelo que /api/ingest: `models/gemini-embedding-001` (embedContent). */
    const embeddingResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${RAG_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: RAG_EMBEDDING_MODEL_RESOURCE,
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
      maxOutputTokens: 2048,
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
