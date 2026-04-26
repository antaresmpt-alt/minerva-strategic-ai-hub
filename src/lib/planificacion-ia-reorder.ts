import {
  parseSlotKey,
  recomputeSlotOrden,
} from "@/lib/planificacion-mesa";
import type {
  MesaTrabajo,
  PlanificacionIaSettings,
  PlanificacionIaScope,
  SlotKey,
} from "@/types/planificacion-mesa";

export interface PlanificacionIaResult {
  nextBySlot: Record<SlotKey, MesaTrabajo[]>;
  movedCount: number;
  reasons: string[];
  warnings: string[];
}

type SlotGroup = SlotKey[];

function isLocked(it: MesaTrabajo): boolean {
  return it.estadoMesa === "en_ejecucion" || it.estadoMesa === "finalizada";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isCmyk(tintas: string): boolean {
  const t = normalize(tintas);
  return t.includes("cmyk") || t.includes("4+0") || t.includes("4+1");
}

function deliveryRank(fecha: string | null): number {
  if (!fecha) return Number.MAX_SAFE_INTEGER;
  const ts = new Date(fecha).getTime();
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

function itemScore(it: MesaTrabajo, settings: PlanificacionIaSettings): string {
  const tintas = normalize(it.tintasSnapshot);
  const barniz = normalize(it.barnizSnapshot || it.acabadoPralSnapshot);
  const papel = normalize(it.papelSnapshot);
  const cmykGroup = isCmyk(tintas) ? "0" : "1";
  const fecha = String(deliveryRank(it.fechaEntrega)).padStart(15, "0");

  // Orden lexicográfico ponderado: repetimos claves relevantes según pesos.
  const tintasKey = settings.pesoTintas > 0 ? tintas : "";
  const cmykKey = settings.pesoCmyk > 0 ? cmykGroup : "";
  const barnizKey = settings.pesoBarniz > 0 ? barniz : "";
  const papelKey = settings.pesoPapel > 0 ? papel : "";
  const fechaKey = settings.pesoFechaEntrega > 0 ? fecha : "";

  return [
    cmykKey,
    tintasKey,
    barnizKey,
    papelKey,
    fechaKey,
    it.ot,
  ].join("||");
}

export function reorderBoardWithIaRules(
  bySlot: Record<SlotKey, MesaTrabajo[]>,
  settings: PlanificacionIaSettings,
  scope: PlanificacionIaScope = "turno",
  capacityBySlot: Record<SlotKey, number> = {},
): PlanificacionIaResult {
  const nextBySlot: Record<SlotKey, MesaTrabajo[]> = Object.fromEntries(
    Object.keys(bySlot).map((sk) => [sk, []]),
  );
  const warnings: string[] = [];

  const validSlots = Object.keys(bySlot).filter((sk): sk is SlotKey => {
    const ok = parseSlotKey(sk) != null;
    if (!ok) warnings.push(`Slot inválido ignorado: ${sk}`);
    return ok;
  });

  for (const sk of validSlots) {
    nextBySlot[sk] = (bySlot[sk] ?? []).filter(isLocked);
  }

  const groups = buildScopeGroups(validSlots, scope);
  for (const group of groups) {
    distributeGroup(group, bySlot, nextBySlot, settings, capacityBySlot, scope);
  }

  for (const sk of validSlots) {
    nextBySlot[sk] = recomputeSlotOrden(nextBySlot[sk] ?? []);
  }

  const movedCount = countMoved(bySlot, nextBySlot);
  const reasons = [
    "Agrupación por tintas/Pantones y CMYK para reducir limpiezas.",
    "Agrupación por barniz/acabado y papel para minimizar cambios de preparación.",
    `Alcance aplicado: ${scopeLabel(scope)}.`,
    "Respeto de OTs en ejecución: permanecen bloqueadas.",
  ];

  return { nextBySlot, movedCount, reasons, warnings };
}

function scopeLabel(scope: PlanificacionIaScope): string {
  if (scope === "dia") return "día";
  if (scope === "dias_contiguos") return "días contiguos";
  if (scope === "semana") return "semana visible";
  return "turno";
}

function buildScopeGroups(slots: SlotKey[], scope: PlanificacionIaScope): SlotGroup[] {
  if (scope === "turno") return slots.map((sk) => [sk]);
  if (scope === "semana") return [slots];

  const byDay = new Map<string, SlotKey[]>();
  for (const sk of slots) {
    const parsed = parseSlotKey(sk);
    if (!parsed) continue;
    byDay.set(parsed.day, [...(byDay.get(parsed.day) ?? []), sk]);
  }

  const days = [...byDay.keys()].sort();
  if (scope === "dia") return days.map((day) => byDay.get(day) ?? []);

  return [days.flatMap((day) => byDay.get(day) ?? [])];
}

function distributeGroup(
  group: SlotGroup,
  source: Record<SlotKey, MesaTrabajo[]>,
  target: Record<SlotKey, MesaTrabajo[]>,
  settings: PlanificacionIaSettings,
  capacityBySlot: Record<SlotKey, number>,
  scope: PlanificacionIaScope,
) {
  const unlocked = group
    .flatMap((sk) => source[sk] ?? [])
    .filter((it) => !isLocked(it))
    .sort((a, b) => itemScore(a, settings).localeCompare(itemScore(b, settings)));

  for (const item of unlocked) {
    const targetSlot = chooseSlotForItem(item, group, target, source, capacityBySlot, scope);
    const parsed = parseSlotKey(targetSlot);
    target[targetSlot] = [
      ...(target[targetSlot] ?? []),
      {
        ...item,
        fechaPlanificada: parsed?.day ?? item.fechaPlanificada,
        turno: parsed?.turno ?? item.turno,
      },
    ];
  }
}

function chooseSlotForItem(
  item: MesaTrabajo,
  group: SlotGroup,
  target: Record<SlotKey, MesaTrabajo[]>,
  source: Record<SlotKey, MesaTrabajo[]>,
  capacityBySlot: Record<SlotKey, number>,
  scope: PlanificacionIaScope,
): SlotKey {
  const original = group.find((sk) => (source[sk] ?? []).some((it) => it.id === item.id));
  const scopedGroup =
    original && scope === "dias_contiguos"
      ? group.filter((sk) => areContiguousDays(original, sk))
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
  const fit = candidates.find((sk) => canAddToSlot(sk, item, target, source, capacityBySlot));
  return fit ?? original ?? group[0]!;
}

function slotLoadRatio(
  slot: SlotKey,
  target: Record<SlotKey, MesaTrabajo[]>,
  capacityBySlot: Record<SlotKey, number>,
): number {
  const cap = capacityBySlot[slot];
  const hours = (target[slot] ?? []).reduce((acc, it) => acc + it.horasPlanificadasSnapshot, 0);
  return Number.isFinite(cap) && cap > 0 ? hours / cap : hours;
}

function areContiguousDays(a: SlotKey, b: SlotKey): boolean {
  const pa = parseSlotKey(a);
  const pb = parseSlotKey(b);
  if (!pa || !pb) return false;
  const da = new Date(`${pa.day}T00:00:00`).getTime();
  const db = new Date(`${pb.day}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false;
  return Math.abs(da - db) <= 24 * 60 * 60 * 1000;
}

function canAddToSlot(
  slot: SlotKey,
  item: MesaTrabajo,
  target: Record<SlotKey, MesaTrabajo[]>,
  source: Record<SlotKey, MesaTrabajo[]>,
  capacityBySlot: Record<SlotKey, number>,
): boolean {
  const cap = capacityBySlot[slot];
  if (!Number.isFinite(cap) || cap <= 0) return true;
  const currentHours = (source[slot] ?? []).reduce((acc, it) => acc + it.horasPlanificadasSnapshot, 0);
  const targetHours = (target[slot] ?? []).reduce((acc, it) => acc + it.horasPlanificadasSnapshot, 0);
  const nextHours = targetHours + item.horasPlanificadasSnapshot;
  if (currentHours <= cap) return nextHours <= cap;
  return nextHours <= currentHours;
}

function countMoved(
  before: Record<SlotKey, MesaTrabajo[]>,
  after: Record<SlotKey, MesaTrabajo[]>,
): number {
  const pos = new Map<string, string>();
  for (const [sk, items] of Object.entries(before)) {
    for (const it of items) pos.set(it.id, `${sk}#${it.slotOrden}`);
  }
  let moved = 0;
  for (const [sk, items] of Object.entries(after)) {
    for (const it of items) {
      if (pos.get(it.id) !== `${sk}#${it.slotOrden}`) moved += 1;
    }
  }
  return moved;
}
