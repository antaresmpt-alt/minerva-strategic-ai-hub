import {
  GoogleGenerativeAI,
  TaskType,
  type EmbedContentRequest,
} from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

import { RAG_EMBEDDING_DIMENSIONS, RAG_EMBEDDING_MODEL } from "@/lib/rag-embedding";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function getEmbeddingModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const genAI = new GoogleGenerativeAI(key);
  /* Recurso REST: `models/gemini-embedding-001`. */
  return genAI.getGenerativeModel({ model: RAG_EMBEDDING_MODEL });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";
    const source = typeof body.source === "string" ? body.source.trim() : "";

    if (!source) {
      return NextResponse.json(
        { error: "El campo source (nombre del documento) es obligatorio" },
        { status: 400 }
      );
    }

    const chunks = text
      .split(/\n\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No hay párrafos válidos en el texto (vacío o solo saltos de línea)" },
        { status: 400 }
      );
    }

    const model = getEmbeddingModel();
    let saved = 0;

    for (const chunk of chunks) {
      const result = await model.embedContent({
        content: { role: "user", parts: [{ text: chunk }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        outputDimensionality: RAG_EMBEDDING_DIMENSIONS,
      } as EmbedContentRequest);
      const embeddingVector = result.embedding.values;
      const { error } = await supabase.from("minerva_documents").insert({
        content: chunk,
        metadata: { source },
        embedding: embeddingVector,
      });
      if (error) {
        return NextResponse.json(
          { error: error.message, chunksSaved: saved },
          { status: 500 }
        );
      }
      saved += 1;
    }

    return NextResponse.json({ chunksProcessed: saved });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
