import { NextResponse } from "next/server";

import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";
import { parseSlotKey, recomputeSlotOrden } from "@/lib/planificacion-mesa";
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
  propuesta?: Array<{
    id?: unknown;
    ot?: unknown;
    ot_id?: unknown;
    ot_numero?: unknown;
    slotKey?: unknown;
    slot_key?: unknown;
    slotOrden?: unknown;
    slot_orden?: unknown;
  }>;
  order?: unknown[];
  orden?: unknown[] | Record<string, unknown>;
  slots?: Record<string, unknown>;
  reasons?: string[];
  razones?: string[];
  warnings?: string[];
  alertas?: string[];
};

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenced?.[1]?.trim() ?? trimmed;
  const start = source.indexOf("{");
  if (start < 0) return source;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;

    if (depth === 0) return source.slice(start, i + 1);
  }

  return source.slice(start);
}

function sanitizeJsonText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function parseModelJson(text: string): ModelJson {
  const extracted = sanitizeJsonText(extractJsonObject(text));
  try {
    return JSON.parse(extracted) as ModelJson;
  } catch (first) {
    const arrayMatch = extracted.match(/\[[\s\S]*\]/);
    if (arrayMatch?.[0]) {
      try {
        return { items: JSON.parse(sanitizeJsonText(arrayMatch[0])) as PlanificacionIaProposalItem[] };
      } catch {
        // fall through to original error
      }
    }
    throw first;
  }
}

function flattenSlots(slots: Record<SlotKey, MesaTrabajo[]>): MesaTrabajo[] {
  return Object.values(slots).flat();
}

function isLocked(item: MesaTrabajo): boolean {
  return item.estadoMesa === "en_ejecucion" || item.estadoMesa === "finalizada";
}

function buildScopeGroups(slots: SlotKey[], scope: PlanificacionIaScope): SlotKey[][] {
  if (scope === "turno") return slots.map((slot) => [slot]);
  if (scope === "semana") return [slots];

  const byDay = new Map<string, SlotKey[]>();
  for (const slot of slots) {
    const parsed = parseSlotKey(slot);
    if (!parsed) continue;
    byDay.set(parsed.day, [...(byDay.get(parsed.day) ?? []), slot]);
  }

  const days = [...byDay.keys()].sort();
  if (scope === "dia") return days.map((day) => byDay.get(day) ?? []);
  return [days.flatMap((day) => byDay.get(day) ?? [])];
}

function areContiguousSlots(a: SlotKey, b: SlotKey): boolean {
  const pa = parseSlotKey(a);
  const pb = parseSlotKey(b);
  if (!pa || !pb) return false;
  const da = new Date(`${pa.day}T00:00:00`).getTime();
  const db = new Date(`${pb.day}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) <= 24 * 60 * 60 * 1000;
}

function slotLoadRatio(
  slot: SlotKey,
  target: Record<SlotKey, MesaTrabajo[]>,
  capacityBySlot: Record<SlotKey, number>,
): number {
  const capacity = capacityBySlot[slot];
  const hours = (target[slot] ?? []).reduce((acc, item) => acc + item.horasPlanificadasSnapshot, 0);
  return Number.isFinite(capacity) && capacity > 0 ? hours / capacity : hours;
}

function canAddToSlot(
  slot: SlotKey,
  item: MesaTrabajo,
  target: Record<SlotKey, MesaTrabajo[]>,
  source: Record<SlotKey, MesaTrabajo[]>,
  capacityBySlot: Record<SlotKey, number>,
): boolean {
  const capacity = capacityBySlot[slot];
  if (!Number.isFinite(capacity) || capacity <= 0) return true;
  const currentHours = (source[slot] ?? []).reduce((acc, it) => acc + it.horasPlanificadasSnapshot, 0);
  const targetHours = (target[slot] ?? []).reduce((acc, it) => acc + it.horasPlanificadasSnapshot, 0);
  const nextHours = targetHours + item.horasPlanificadasSnapshot;
  if (currentHours <= capacity) return nextHours <= capacity;
  return nextHours <= currentHours;
}

function chooseSlotForOrderedItem(
  item: MesaTrabajo,
  group: SlotKey[],
  target: Record<SlotKey, MesaTrabajo[]>,
  source: Record<SlotKey, MesaTrabajo[]>,
  capacityBySlot: Record<SlotKey, number>,
  scope: PlanificacionIaScope,
): SlotKey {
  const original = group.find((slot) => (source[slot] ?? []).some((it) => it.id === item.id));
  const scopedGroup =
    original && scope === "dias_contiguos"
      ? group.filter((slot) => areContiguousSlots(original, slot))
      : group;
  const candidates =
    scope === "turno"
      ? original
        ? [original]
        : scopedGroup
      : [...scopedGroup].sort(
          (a, b) =>
            slotLoadRatio(a, target, capacityBySlot) -
              slotLoadRatio(b, target, capacityBySlot) ||
            a.localeCompare(b),
        );
  return candidates.find((slot) => canAddToSlot(slot, item, target, source, capacityBySlot)) ?? original ?? group[0]!;
}

function normalizeOrderValue(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number") return String(raw).trim();
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    return String(rec.ot ?? rec.ot_numero ?? rec.ot_id ?? rec.id ?? "").trim();
  }
  return "";
}

function proposalFromOrder(params: {
  order: unknown[];
  slots: Record<SlotKey, MesaTrabajo[]>;
  scope: PlanificacionIaScope;
  capacityBySlot: Record<SlotKey, number>;
}): PlanificacionIaProposalItem[] {
  const validSlots = Object.keys(params.slots).filter((slot): slot is SlotKey => parseSlotKey(slot) != null);
  const byOt = new Map<string, MesaTrabajo>();
  const byId = new Map<string, MesaTrabajo>();
  const originalSlotById = new Map<string, SlotKey>();
  const target: Record<SlotKey, MesaTrabajo[]> = Object.fromEntries(validSlots.map((slot) => [slot, []]));

  for (const slot of validSlots) {
    for (const item of params.slots[slot] ?? []) {
      byOt.set(item.ot, item);
      byId.set(item.id, item);
      originalSlotById.set(item.id, slot);
      if (isLocked(item)) target[slot] = [...(target[slot] ?? []), item];
    }
  }

  const orderedMovable: MesaTrabajo[] = [];
  const seen = new Set<string>();
  for (const raw of params.order) {
    const key = normalizeOrderValue(raw);
    const item = key ? byOt.get(key) ?? byId.get(key) : undefined;
    if (!item || isLocked(item) || seen.has(item.id)) continue;
    orderedMovable.push(item);
    seen.add(item.id);
  }

  const originalMovable = validSlots.flatMap((slot) => (params.slots[slot] ?? []).filter((item) => !isLocked(item)));
  for (const item of originalMovable) {
    if (!seen.has(item.id)) orderedMovable.push(item);
  }

  const groups = buildScopeGroups(validSlots, params.scope);
  for (const group of groups) {
    const groupIds = new Set(
      group.flatMap((slot) => (params.slots[slot] ?? []).map((item) => item.id)),
    );
    for (const item of orderedMovable.filter((it) => groupIds.has(it.id))) {
      const slot = chooseSlotForOrderedItem(
        item,
        group,
        target,
        params.slots,
        params.capacityBySlot,
        params.scope,
      );
      const parsed = parseSlotKey(slot);
      target[slot] = [
        ...(target[slot] ?? []),
        {
          ...item,
          fechaPlanificada: parsed?.day ?? item.fechaPlanificada,
          turno: parsed?.turno ?? item.turno,
        },
      ];
    }
  }

  return validSlots.flatMap((slot) =>
    recomputeSlotOrden(target[slot] ?? []).map((item) => ({
      id: item.id,
      ot: item.ot,
      slotKey: slot,
      slotOrden: item.slotOrden,
    })),
  );
}

function normalizeModelItems(
  parsed: ModelJson,
  slots: Record<SlotKey, MesaTrabajo[]>,
  scope: PlanificacionIaScope,
  capacityBySlot: Record<SlotKey, number>,
): PlanificacionIaProposalItem[] {
  const byId = new Map<string, { item: MesaTrabajo; slotKey: SlotKey }>();
  const byOt = new Map<string, { item: MesaTrabajo; slotKey: SlotKey }>();
  for (const [slotKey, items] of Object.entries(slots)) {
    for (const item of items) {
      byId.set(item.id, { item, slotKey });
      byOt.set(item.ot, { item, slotKey });
    }
  }

  const orderProposal = Array.isArray(parsed.order)
    ? parsed.order
    : Array.isArray(parsed.orden)
      ? parsed.orden
      : [];
  if (orderProposal.length > 0) {
    return proposalFromOrder({ order: orderProposal, slots, scope, capacityBySlot });
  }

  const rawItems = Array.isArray(parsed.items)
    ? parsed.items
    : Array.isArray(parsed.propuesta)
      ? parsed.propuesta
      : [];

  const slotProposal = parsed.slots ?? (!Array.isArray(parsed.orden) ? parsed.orden : undefined);
  if (!rawItems.length && slotProposal && typeof slotProposal === "object") {
    return Object.entries(slotProposal).flatMap(([slotKey, value]) => {
      const proposedItems = Array.isArray(value) ? value : [];
      return proposedItems.map((raw, index) => {
        const rec = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const rawOt = String(
          typeof raw === "string" || typeof raw === "number"
            ? raw
            : rec.ot ?? rec.ot_numero ?? rec.ot_id ?? rec.id ?? "",
        ).trim();
        const found = rawOt ? byOt.get(rawOt) ?? byId.get(rawOt) : undefined;
        return {
          id: found?.item.id ?? rawOt,
          ot: found?.item.ot ?? rawOt,
          slotKey: slotKey as SlotKey,
          slotOrden: Number(rec.slotOrden ?? rec.slot_orden ?? index + 1),
        };
      });
    });
  }

  return rawItems.map((raw) => {
    const rec = raw as Record<string, unknown>;
    const rawId = String(rec.id ?? rec.ot_id ?? "").trim();
    const rawOt = String(rec.ot ?? rec.ot_numero ?? rec.ot_id ?? "").trim();
    const found = rawId
      ? byId.get(rawId)
      : rawOt
        ? byOt.get(rawOt)
        : undefined;
    const item = found?.item;
    const fallbackSlot = found?.slotKey;
    return {
      id: item?.id ?? rawId,
      ot: item?.ot ?? rawOt,
      slotKey: String(rec.slotKey ?? rec.slot_key ?? fallbackSlot ?? "") as SlotKey,
      slotOrden: Number(rec.slotOrden ?? rec.slot_orden ?? 9999),
    };
  });
}

function normalizeMessages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
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
    "Contrato de salida preferente (compacto y robusto):",
    JSON.stringify({
      order: ["91001", "91002", "91003"],
      reasons: ["Razón breve 1", "Razón breve 2", "Razón breve 3"],
      warnings: [],
    }),
    "La lista order debe incluir solo OTs movibles, exactamente una vez cada una. Omite OTs en_ejecucion y finalizadas; el sistema las mantendrá bloqueadas.",
    "También se aceptan los contratos legacy slots/items, pero prioriza order para evitar JSON largo:",
    JSON.stringify({
      slots: {
        "2026-04-20::manana": ["91001", "91002"],
        "2026-04-20::tarde": ["91003"],
      },
      reasons: ["Razón breve 1", "Razón breve 2"],
      warnings: [],
    }),
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
    "Reglas duras: no pierdas OTs movibles, no dupliques OTs, no inventes OTs, no muevas OTs en_ejecucion ni finalizadas.",
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
      maxOutputTokens: 12000,
      jsonMode: true,
    });

    let parsed: ModelJson;
    try {
      parsed = parseModelJson(result.text);
    } catch (parseError) {
      const parseMsg =
        parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        {
          error: "No se pudo parsear JSON del modelo.",
          parseError: parseMsg,
          rawPreview: result.text.slice(0, 1500),
        },
        { status: 502 },
      );
    }
    const items = normalizeModelItems(parsed, slots, scope, capacityBySlot);
    if (!items.length) {
      return NextResponse.json(
        { error: "El modelo no devolvió items válidos.", raw: result.text },
        { status: 502 },
      );
    }

    return NextResponse.json({
      items,
      reasons: normalizeMessages(parsed.reasons ?? parsed.razones).slice(0, 5),
      warnings: normalizeMessages(parsed.warnings ?? parsed.alertas).slice(0, 8),
      ...llmFieldsForApiResponse(result),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo ordenar con IA avanzada.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
