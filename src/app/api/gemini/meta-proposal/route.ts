import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { resolveGeminiModel } from "@/lib/gemini-model";
import {
  META_PROPOSAL_SYSTEM,
  buildMetaProposalUserPrompt,
  isMetaProposalPayload,
} from "@/lib/meta-proposal-prompt";
import { META_OBJECTIVE_OPTIONS } from "@/lib/meta-proposal-types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const signal = req.signal;
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const websiteText = String(body.websiteText ?? "").trim();
    const businessType = String(body.businessType ?? "").trim();
    const budgetMonthly = String(body.budgetMonthly ?? "").trim();
    const geo = String(body.geo ?? "").trim();
    const objectiveIdsRaw = body.objectiveIds;
    const objectiveIds = Array.isArray(objectiveIdsRaw)
      ? objectiveIdsRaw.map((x) => String(x)).filter(Boolean)
      : [];

    if (!websiteText && !businessType) {
      return NextResponse.json(
        {
          error:
            "Añade información de la web o describe el tipo de negocio para generar la propuesta.",
        },
        { status: 400 }
      );
    }

    const allowed = new Set(META_OBJECTIVE_OPTIONS.map((o) => o.id));
    const filteredIds = objectiveIds.filter((id) => allowed.has(id));
    const labels = filteredIds.map(
      (id) => META_OBJECTIVE_OPTIONS.find((o) => o.id === id)?.label ?? id
    );

    const userText = buildMetaProposalUserPrompt({
      websiteText,
      businessType,
      budgetMonthly,
      geo,
      objectiveIds: filteredIds,
      objectiveLabels: labels,
    });

    const gen = new GoogleGenerativeAI(key);
    const model = gen.getGenerativeModel({
      model: resolveGeminiModel(),
      systemInstruction: META_PROPOSAL_SYSTEM,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.35,
      },
    });

    const result = await model.generateContent(
      { contents: [{ role: "user", parts: [{ text: userText }] }] },
      { signal }
    );

    const raw = result.response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json(
        { error: "La IA no devolvió JSON válido. Vuelve a intentarlo." },
        { status: 502 }
      );
    }

    if (!isMetaProposalPayload(parsed)) {
      return NextResponse.json(
        { error: "Respuesta incompleta del modelo. Reintenta la generación." },
        { status: 502 }
      );
    }

    return NextResponse.json({ proposal: parsed });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
