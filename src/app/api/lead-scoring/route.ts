import { NextResponse } from "next/server";

import type { LeadScoringApiPayload } from "@/lib/lead-email-payload";
import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Eres un Director de Ventas B2B experto en la industria del packaging y estuches pharma. Analiza los datos de este prospecto y evalúa la probabilidad de cierre de venta (0% a 100%) basándote en su Estado, Prioridad y Último Contacto.
Devuelve ÚNICAMENTE un objeto JSON válido con este formato exacto, sin markdown extra:
{
  "score": 85,
  "advice": "Al ser del sector Pharma, menciónales nuestra tolerancia del +/- 3% y repetición gratis por fallos en Braille para cerrar el trato rápido."
}`;

function isScoringPayload(v: unknown): v is LeadScoringApiPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const keys: (keyof LeadScoringApiPayload)[] = [
    "Contacto",
    "Cargo",
    "Empresa",
    "Tema_Interes",
    "Origen",
    "Estado",
    "Proxima_Accion",
    "Ultimo_Contacto",
    "Prioridad",
  ];
  return keys.every((k) => typeof o[k] === "string");
}

function parseLeadScoringJson(raw: string): { score: number; advice: string } {
  let t = raw.trim();
  const fenceOpen = /^```(?:json)?\s*\n?/i;
  if (fenceOpen.test(t)) {
    t = t.replace(fenceOpen, "");
    t = t.replace(/\n?```\s*$/i, "").trim();
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    t = t.slice(start, end + 1);
  }
  const parsed = JSON.parse(t) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("La respuesta no es un objeto JSON válido.");
  }
  const o = parsed as Record<string, unknown>;
  const scoreRaw = o.score;
  const adviceRaw = o.advice;
  if (typeof scoreRaw !== "number" || Number.isNaN(scoreRaw)) {
    throw new Error("El campo score debe ser un número.");
  }
  if (typeof adviceRaw !== "string") {
    throw new Error("El campo advice debe ser texto.");
  }
  const score = Math.max(0, Math.min(100, Math.round(scoreRaw)));
  return { score, advice: adviceRaw.trim() };
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as { leadData?: unknown; model?: unknown };
    const leadData = json.leadData;
    const modelId = parseModelFromBody(json.model);

    if (!leadData || !isScoringPayload(leadData)) {
      return NextResponse.json(
        { error: "leadData inválido o incompleto." },
        { status: 400 }
      );
    }

    const userText = `Datos del prospecto (JSON):\n${JSON.stringify(leadData, null, 2)}`;
    const result = await generateLlmText({
      modelId,
      system: SYSTEM_PROMPT,
      user: userText,
      maxOutputTokens: 2048,
      temperature: 0.3,
    });

    const { score, advice } = parseLeadScoringJson(result.text);
    return NextResponse.json({
      score,
      advice,
      ...llmFieldsForApiResponse(result),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
