import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `Eres el Analista de Datos de Minerva Global. Te voy a pasar un JSON con los datos actuales de una tabla (pedidos o leads) y una pregunta del Director Comercial. Responde a la pregunta basándote ÚNICAMENTE en los datos del JSON adjunto. Sé directo, claro y profesional. No menciones que estás leyendo un JSON.`;

const MAX_TABLE_CHARS = 900_000;

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as {
      query?: unknown;
      tableData?: unknown;
    };

    const query =
      typeof json.query === "string" ? json.query.trim() : "";
    if (!query) {
      return NextResponse.json(
        { error: "La pregunta (query) es obligatoria." },
        { status: 400 }
      );
    }

    const tableData =
      typeof json.tableData === "string" ? json.tableData.trim() : "";
    if (!tableData) {
      return NextResponse.json(
        { error: "tableData debe ser un string JSON con los datos visibles." },
        { status: 400 }
      );
    }

    try {
      JSON.parse(tableData);
    } catch {
      return NextResponse.json(
        { error: "tableData no es un JSON válido." },
        { status: 400 }
      );
    }

    if (tableData.length > MAX_TABLE_CHARS) {
      return NextResponse.json(
        {
          error:
            "Los datos son demasiado extensos para un solo análisis. Filtra más la tabla o reduce el volumen.",
        },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_GENERATIVE_AI_API_KEY (o GEMINI_API_KEY) no configurada"
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const userMessage = `Pregunta del Director Comercial:\n${query}\n\nDatos disponibles (JSON):\n${tableData}`;

    const result = await model.generateContent(userMessage);
    const text = result.response.text();
    if (!text?.trim()) {
      throw new Error("El modelo no devolvió texto.");
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
