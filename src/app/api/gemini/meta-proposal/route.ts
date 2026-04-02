import { NextRequest, NextResponse } from "next/server";
import {
  buildMetaProposalUserPrompt,
  isMetaProposalPayload,
} from "@/lib/meta-proposal-prompt";
import {
  generateMetaProposalModelText,
  parseMetaProposalJson,
} from "@/lib/meta-proposal-llm";
import { META_OBJECTIVE_OPTIONS } from "@/lib/meta-proposal-types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const signal = req.signal;
  try {
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

    const raw = await generateMetaProposalModelText({
      userText,
      signal,
    });
    let parsed: unknown;
    try {
      parsed = parseMetaProposalJson(raw);
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
