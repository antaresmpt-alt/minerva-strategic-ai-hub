import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchSiteContext } from "@/lib/fetch-site-context";
import { resolveGeminiModel } from "@/lib/gemini-model";
import {
  STRATEGIC_ANALYSIS_INSTRUCTION,
  buildStrategicUserPrompt,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  const gen = new GoogleGenerativeAI(key);
  const name = resolveGeminiModel();
  return gen.getGenerativeModel({
    model: name,
    systemInstruction: STRATEGIC_ANALYSIS_INSTRUCTION,
  });
}

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const url = String(body.url ?? "").trim();
    const country = body.country ? String(body.country).trim() : "";
    const targetClient = body.targetClient
      ? String(body.targetClient).trim()
      : "";

    if (!url) {
      return NextResponse.json({ error: "URL requerida" }, { status: 400 });
    }

    new URL(url);

    const siteText = await fetchSiteContext(url);
    const userText = buildStrategicUserPrompt({
      url,
      country: country || undefined,
      targetClient: targetClient || undefined,
      siteText: siteText || undefined,
    });

    const model = getModel();
    const result = await model.generateContent(
      { contents: [{ role: "user", parts: [{ text: userText }] }] },
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
