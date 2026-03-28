import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { resolveGeminiModel } from "@/lib/gemini-model";
import { SLIDES_INSTRUCTION } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const gen = new GoogleGenerativeAI(key);
  const name = resolveGeminiModel();
  return gen.getGenerativeModel({
    model: name,
    systemInstruction: SLIDES_INSTRUCTION,
  });
}

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const strategicAnalysis = String(body.strategicAnalysis ?? "").trim();

    if (!strategicAnalysis) {
      return NextResponse.json(
        { error: "Se requiere un análisis estratégico previo" },
        { status: 400 }
      );
    }

    const model = getModel();
    const result = await model.generateContent(
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Análisis estratégico previo (base):\n\n${strategicAnalysis}\n\n---\nGenera la estructura de 12 diapositivas solicitada.`,
              },
            ],
          },
        ],
      },
      { signal }
    );

    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
