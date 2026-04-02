import { NextRequest, NextResponse } from "next/server";

import { fetchSiteContext } from "@/lib/fetch-site-context";
import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import {
  STRATEGIC_ANALYSIS_INSTRUCTION,
  buildStrategicUserPrompt,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const body = await req.json();
    const modelId = parseModelFromBody(
      (body as { model?: unknown }).model
    );
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

    const result = await generateLlmText({
      modelId,
      system: STRATEGIC_ANALYSIS_INSTRUCTION,
      user: userText,
      maxOutputTokens: 8192,
      temperature: 0.4,
      signal,
    });
    return NextResponse.json({
      text: result.text,
      ...llmFieldsForApiResponse(result),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
