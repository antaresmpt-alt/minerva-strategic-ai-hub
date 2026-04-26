import { parseSlotKey, recomputeSlotOrden } from "@/lib/planificacion-mesa";
import type {
  MesaTrabajo,
  PlanificacionIaScope,
  SlotKey,
} from "@/types/planificacion-mesa";

export type PlanificacionIaProposalItem = {
  id: string;
  ot: string;
  slotKey: SlotKey;
  slotOrden: number;
};

export type PlanificacionIaValidatedProposal = {
  nextBySlot: Record<SlotKey, MesaTrabajo[]>;
  movedCount: number;
  warnings: string[];
};

function flattenBySlot(bySlot: Record<SlotKey, MesaTrabajo[]>): Array<{
  slotKey: SlotKey;
  item: MesaTrabajo;
}> {
  return Object.entries(bySlot).flatMap(([slotKey, items]) =>
    items.map((item) => ({ slotKey, item })),
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

export function validateAndApplyIaProposal(params: {
  currentBySlot: Record<SlotKey, MesaTrabajo[]>;
  proposalItems: PlanificacionIaProposalItem[];
  capacityBySlot?: Record<SlotKey, number>;
  scope?: PlanificacionIaScope;
}): PlanificacionIaValidatedProposal {
  const currentFlat = flattenBySlot(params.currentBySlot);
  const currentIds = currentFlat.map(({ item }) => item.id);
  const proposalIds = params.proposalItems.map((it) => it.id);
  const warnings: string[] = [];

  if (!sameSet(currentIds, proposalIds)) {
    throw new Error("La propuesta IA no contiene exactamente las mismas OTs del draft.");
  }
  if (new Set(proposalIds).size !== proposalIds.length) {
    throw new Error("La propuesta IA contiene OTs duplicadas.");
  }

  const itemById = new Map(currentFlat.map(({ item }) => [item.id, item]));
  const originalSlotById = new Map(currentFlat.map(({ slotKey, item }) => [item.id, slotKey]));
  const originalOrdenById = new Map(currentFlat.map(({ item }) => [item.id, item.slotOrden]));
  const nextBySlot: Record<SlotKey, MesaTrabajo[]> = {};

  for (const key of Object.keys(params.currentBySlot)) {
    nextBySlot[key] = [];
  }

  for (const proposal of params.proposalItems) {
    if (!parseSlotKey(proposal.slotKey)) {
      throw new Error(`La propuesta IA usa un slot inválido: ${proposal.slotKey}`);
    }
    if (!Object.prototype.hasOwnProperty.call(nextBySlot, proposal.slotKey)) {
      throw new Error(`La propuesta IA intenta usar un slot no visible: ${proposal.slotKey}`);
    }
    const item = itemById.get(proposal.id);
    if (!item) throw new Error(`La propuesta IA referencia una OT desconocida: ${proposal.ot}`);
    const originalSlot = originalSlotById.get(item.id);
    if (!originalSlot) throw new Error(`No se pudo localizar el slot original de la OT ${item.ot}.`);

    assertScopeAllowsMove(params.scope ?? "turno", originalSlot, proposal.slotKey, item.ot);

    if (item.estadoMesa === "en_ejecucion" || item.estadoMesa === "finalizada") {
      const originalOrden = originalOrdenById.get(item.id);
      if (proposal.slotKey !== originalSlot || proposal.slotOrden !== originalOrden) {
        throw new Error(`La propuesta IA intenta mover la OT bloqueada ${item.ot}.`);
      }
    }

    const parsedSlot = parseSlotKey(proposal.slotKey)!;
    nextBySlot[proposal.slotKey].push({
      ...item,
      fechaPlanificada: parsedSlot.day,
      turno: parsedSlot.turno,
      slotOrden: Number.isFinite(proposal.slotOrden) ? proposal.slotOrden : 9999,
    });
  }

  for (const [slotKey, items] of Object.entries(nextBySlot)) {
    nextBySlot[slotKey] = recomputeSlotOrden(
      [...items].sort((a, b) => a.slotOrden - b.slotOrden || a.ot.localeCompare(b.ot)),
    );
  }

  if (params.capacityBySlot) {
    for (const [slotKey, items] of Object.entries(nextBySlot)) {
      const capacity = params.capacityBySlot[slotKey];
      if (!Number.isFinite(capacity) || capacity <= 0) continue;
      const currentHours = (params.currentBySlot[slotKey] ?? []).reduce(
        (acc, it) => acc + it.horasPlanificadasSnapshot,
        0,
      );
      const nextHours = items.reduce((acc, it) => acc + it.horasPlanificadasSnapshot, 0);
      if (currentHours <= capacity && nextHours > capacity) {
        throw new Error(`La propuesta IA sobrecarga el slot ${slotKey}.`);
      }
      if (currentHours > capacity && nextHours > currentHours) {
        throw new Error(`La propuesta IA empeora la sobrecarga del slot ${slotKey}.`);
      }
    }
  }

  let movedCount = 0;
  for (const { slotKey, item } of currentFlat) {
    const nextSlot = Object.entries(nextBySlot).find(([, items]) =>
      items.some((it) => it.id === item.id),
    )?.[0];
    const nextOrden = nextSlot
      ? nextBySlot[nextSlot]?.find((it) => it.id === item.id)?.slotOrden
      : null;
    if (nextSlot !== slotKey || nextOrden !== item.slotOrden) movedCount += 1;
  }

  if (movedCount === 0) warnings.push("La propuesta IA no cambia el orden actual.");
  return { nextBySlot, movedCount, warnings };
}

function assertScopeAllowsMove(
  scope: PlanificacionIaScope,
  fromSlot: SlotKey,
  toSlot: SlotKey,
  ot: string,
) {
  if (scope === "semana") return;
  const from = parseSlotKey(fromSlot);
  const to = parseSlotKey(toSlot);
  if (!from || !to) throw new Error(`Slot inválido en propuesta IA para OT ${ot}.`);
  if (scope === "turno" && fromSlot !== toSlot) {
    throw new Error(`La propuesta IA mueve la OT ${ot} fuera de su turno.`);
  }
  if (scope === "dia" && from.day !== to.day) {
    throw new Error(`La propuesta IA mueve la OT ${ot} fuera de su día.`);
  }
  if (scope === "dias_contiguos" && !areContiguousDays(from.day, to.day)) {
    throw new Error(`La propuesta IA mueve la OT ${ot} fuera de días contiguos.`);
  }
}

function areContiguousDays(a: string, b: string): boolean {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) <= 24 * 60 * 60 * 1000;
}
