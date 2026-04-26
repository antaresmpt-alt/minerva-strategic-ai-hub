import { NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import type { PlanificacionIaProposalItem } from "@/lib/planificacion-ia-validate";
import type {
  MesaTrabajo,
  PlanificacionIaSettings,
  PlanificacionIaScope,
  SlotKey,
} from "@/types/planificacion-mesa";
import { getCurrentProfileRole } from "@/utils/supabase/server";

type ReorderMode = "advanced" | "mixed";

type RequestBody = {
  model?: unknown;
  mode?: ReorderMode;
  settings?: PlanificacionIaSettings;
  slots?: Record<SlotKey, MesaTrabajo[]>;
  capacityBySlot?: Record<SlotKey, number>;
  promptBase?: string;
  scope?: PlanificacionIaScope;
};

type ModelJson = {
  items?: PlanificacionIaProposalItem[];
  reasons?: string[];
  warnings?: string[];
};

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function flattenSlots(slots: Record<SlotKey, MesaTrabajo[]>): MesaTrabajo[] {
  return Object.values(slots).flat();
}

function buildUserPrompt(params: Required<Pick<RequestBody, "mode" | "settings" | "slots" | "capacityBySlot" | "promptBase" | "scope">>) {
  const payload = {
    mode: params.mode,
    scope: params.scope,
    promptBase: params.promptBase,
    weights: params.settings,
    capacityBySlot: params.capacityBySlot,
    slots: Object.fromEntries(
      Object.entries(params.slots).map(([slotKey, items]) => [
        slotKey,
        items.map((it) => ({
          id: it.id,
          ot: it.ot,
          estadoMesa: it.estadoMesa,
          slotKey,
          slotOrden: it.slotOrden,
          barnizSnapshot: it.barnizSnapshot,
          acabadoPralSnapshot: it.acabadoPralSnapshot,
          papelSnapshot: it.papelSnapshot,
          tintasSnapshot: it.tintasSnapshot,
          fechaEntrega: it.fechaEntrega,
          horasPlanificadasSnapshot: it.horasPlanificadasSnapshot,
          numHojasBrutasSnapshot: it.numHojasBrutasSnapshot,
        })),
      ]),
    ),
  };

  return [
    "Devuelve exclusivamente JSON válido, sin markdown ni texto adicional.",
    "Contrato de salida:",
    JSON.stringify({
      items: [
        {
          id: "mesa-id",
          ot: "91001",
          slotKey: "2026-04-20::manana",
          slotOrden: 1,
        },
      ],
      reasons: ["Razón breve 1", "Razón breve 2", "Razón breve 3"],
      warnings: [],
    }),
    "Reglas duras: no pierdas OTs, no dupliques OTs, no inventes OTs, no muevas OTs en_ejecucion ni finalizadas, usa solo slotKey existentes.",
    "Respeta el alcance: turno = conservar slotKey; dia = conservar fecha; dias_contiguos = mover como máximo al día anterior/siguiente visible; semana = puede usar cualquier slot visible.",
    "Datos de planificación:",
    JSON.stringify(payload),
  ].join("\n\n");
}

export async function POST(request: Request) {
  const role = await getCurrentProfileRole();
  if (!role || !["admin", "gerencia", "produccion"].includes(role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const mode: ReorderMode = body.mode === "mixed" ? "mixed" : "advanced";
  const scope: PlanificacionIaScope =
    body.scope === "dia" ||
    body.scope === "dias_contiguos" ||
    body.scope === "semana"
      ? body.scope
      : "turno";
  const slots = body.slots;
  const settings = body.settings;
  const capacityBySlot = body.capacityBySlot ?? {};
  const promptBase = String(body.promptBase ?? settings?.promptBase ?? "").trim();

  if (!slots || typeof slots !== "object" || flattenSlots(slots).length === 0) {
    return NextResponse.json({ error: "slots requerido" }, { status: 400 });
  }
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings requerido" }, { status: 400 });
  }

  const modelId = parseModelFromBody(body.model);
  const system = [
    "Actúa como un Jefe de Planificación experto en impresión offset para una Heidelberg Speedmaster CD 102.",
    "Tu objetivo es minimizar make-ready, lavados, cambios de barniz, ajustes de presión, cambios de formato y cambios de tintas.",
    "Respeta siempre restricciones duras de ejecución y capacidad.",
  ].join(" ");

  try {
    const result = await generateLlmText({
      modelId,
      system,
      user: buildUserPrompt({
        mode,
        settings,
        slots,
        capacityBySlot,
        promptBase,
        scope,
      }),
      temperature: 0.15,
      maxOutputTokens: 6000,
    });

    const parsed = JSON.parse(extractJsonObject(result.text)) as ModelJson;
    if (!Array.isArray(parsed.items)) {
      return NextResponse.json(
        { error: "El modelo no devolvió items válidos.", raw: result.text },
        { status: 502 },
      );
    }

    return NextResponse.json({
      items: parsed.items,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 8) : [],
      ...llmFieldsForApiResponse(result),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo ordenar con IA avanzada.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
