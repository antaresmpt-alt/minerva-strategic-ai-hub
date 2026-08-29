/**
 * Bloque 12 — tablero detalle del día (layout tipo mesa diaria, persiste detalle_dia).
 */
import { arrayMove } from "@dnd-kit/sortable";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import type { PlanificacionTipoMaquina } from "@/lib/planificacion-ambito";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import {
  dailyContainerId,
  dailySlotKey,
  flattenDailyBoard,
  getVisibleDailySlotKeys,
  groupMesaItemsByDailySlot,
  parseDailyContainerId,
  type DailySlotKey,
} from "@/lib/planificacion-mesa-diaria";
import { POOL_CONTAINER_ID } from "@/components/produccion/planificacion/mesa/turno-column";
import type {
  DetalleDiaDraftSlot,
} from "@/lib/calendario-detalle-dia";
import type { ProdCalendarioDetalleDiaRow } from "@/types/prod-calendario-detalle-dia";
import type {
  MaterialStatus,
  MesaTrabajo,
  PoolOT,
  TroquelStatus,
  TurnoKey,
} from "@/types/planificacion-mesa";

export type DetalleDiaDespachoMeta = {
  cliente: string;
  trabajo: string;
  papel: string;
  tintas: string;
  barniz: string | null;
  acabadoPral: string;
  numHojasBrutas: number;
  horasPlanificadas: number;
  cantidadOt: number | null;
  fechaEntrega: string | null;
  materialStatus: MaterialStatus;
  troquelStatus: TroquelStatus;
};

export type DetalleDiaMaquinaRow = {
  id: string;
  nombre: string;
  tipo_maquina: PlanificacionTipoMaquina;
  capacidad_horas_default_manana: number;
  capacidad_horas_default_tarde: number;
};

const EMPTY_MAT: MaterialStatus = "rojo";
const EMPTY_TROQ: TroquelStatus = "no_aplica";

export function lineaToPoolOt(
  linea: CalendarioProduccionLinea,
  meta?: DetalleDiaDespachoMeta | null,
): PoolOT {
  const m = meta ?? null;
  return {
    ot: linea.otNumero,
    poolId: linea.id,
    cliente: m?.cliente ?? "—",
    trabajo: (linea.trabajo ?? m?.trabajo ?? "").trim() || "—",
    papel: m?.papel ?? "—",
    tintas: m?.tintas ?? "—",
    acabadoPral: m?.acabadoPral ?? "—",
    barniz: m?.barniz ?? null,
    fechaEntrega: m?.fechaEntrega ?? null,
    numHojasBrutas: m?.numHojasBrutas ?? 0,
    horasPlanificadas: m?.horasPlanificadas ?? 1,
    cantidadOt: m?.cantidadOt ?? null,
    materialStatus: m?.materialStatus ?? EMPTY_MAT,
    troquelStatus: m?.troquelStatus ?? EMPTY_TROQ,
    planificacionTipoPaso: null,
  };
}

export function detalleRowToMesaTrabajo(
  row: ProdCalendarioDetalleDiaRow,
  dayYmd: string,
  meta?: DetalleDiaDespachoMeta | null,
): MesaTrabajo {
  const m = meta ?? null;
  const turno: TurnoKey = row.turno === "tarde" ? "tarde" : "manana";
  return {
    id: row.calendario_ot_id,
    maquinaId: row.maquina_id,
    ot: row.ot_numero,
    fechaPlanificada: dayYmd,
    turno,
    slotOrden: row.slot_orden,
    estadoMesa: "borrador",
    fechaEntrega: m?.fechaEntrega ?? null,
    materialStatus: m?.materialStatus ?? EMPTY_MAT,
    troquelStatus: m?.troquelStatus ?? EMPTY_TROQ,
    acabadoPralSnapshot: m?.acabadoPral ?? "—",
    clienteSnapshot: m?.cliente ?? "—",
    papelSnapshot: m?.papel ?? "—",
    tintasSnapshot: m?.tintas ?? "—",
    barnizSnapshot: m?.barniz ?? null,
    numHojasBrutasSnapshot: m?.numHojasBrutas ?? 0,
    horasPlanificadasSnapshot: row.horas_planificadas_snapshot ?? m?.horasPlanificadas ?? 1,
    trabajoTitulo: (m?.trabajo ?? "").trim() || undefined,
    cantidadOt: m?.cantidadOt ?? null,
  };
}

export function buildMesaFromDetallePool(
  pool: PoolOT,
  lineaId: string,
  dayYmd: string,
  turno: TurnoKey,
  slotOrden: number,
  maquinaId: string,
): MesaTrabajo {
  return {
    id: lineaId,
    maquinaId,
    ot: pool.ot,
    fechaPlanificada: dayYmd,
    turno,
    slotOrden,
    estadoMesa: "borrador",
    fechaEntrega: pool.fechaEntrega,
    materialStatus: pool.materialStatus,
    troquelStatus: pool.troquelStatus,
    acabadoPralSnapshot: pool.acabadoPral,
    clienteSnapshot: pool.cliente,
    papelSnapshot: pool.papel,
    tintasSnapshot: pool.tintas,
    barnizSnapshot: pool.barniz,
    numHojasBrutasSnapshot: pool.numHojasBrutas,
    horasPlanificadasSnapshot: pool.horasPlanificadas,
    trabajoTitulo: pool.trabajo,
    cantidadOt: pool.cantidadOt,
  };
}

function recomputeSlotOrden(items: MesaTrabajo[]): MesaTrabajo[] {
  return items.map((it, i) => ({ ...it, slotOrden: i + 1 }));
}

export function boardFromDetalleRows(
  rows: readonly ProdCalendarioDetalleDiaRow[],
  dayYmd: string,
  maquinaIds: readonly string[],
  metaByOt: ReadonlyMap<string, DetalleDiaDespachoMeta>,
): MesaTrabajo[] {
  const items = rows.map((r) =>
    detalleRowToMesaTrabajo(r, dayYmd, metaByOt.get(r.ot_numero)),
  );
  return flattenDailyBoard(
    groupMesaItemsByDailySlot(items, dayYmd, maquinaIds),
  );
}

export function otsEnDetalleBoard(items: readonly MesaTrabajo[], dayYmd: string): Set<string> {
  const s = new Set<string>();
  for (const it of items) {
    if (it.fechaPlanificada !== dayYmd) continue;
    s.add(it.ot);
  }
  return s;
}

export type DetalleBoardTransition = {
  next: Record<DailySlotKey, MesaTrabajo[]>;
  affected: Set<DailySlotKey>;
};

export function applyDetalleBoardTransition(args: {
  activeContainer: string;
  activeId: string;
  overContainer: string;
  overId: string | null;
  currentBySlot: Record<DailySlotKey, MesaTrabajo[]>;
  visibleSlotKeys: readonly DailySlotKey[];
  dayYmd: string;
  poolByOt: ReadonlyMap<string, PoolOT>;
  lineaIdByOt: ReadonlyMap<string, string>;
  otsPlaced: ReadonlySet<string>;
}): DetalleBoardTransition | null {
  const {
    activeContainer,
    activeId,
    overContainer,
    overId,
    currentBySlot,
    visibleSlotKeys,
    dayYmd,
    poolByOt,
    lineaIdByOt,
    otsPlaced,
  } = args;

  const affected = new Set<DailySlotKey>();
  const next: Record<DailySlotKey, MesaTrabajo[]> = {};
  for (const k of Object.keys(currentBySlot)) {
    next[k] = [...(currentBySlot[k] ?? [])];
  }
  for (const sk of visibleSlotKeys) {
    if (!next[sk]) next[sk] = [];
  }

  if (
    activeContainer === POOL_CONTAINER_ID &&
    overContainer.startsWith("dailyslot::")
  ) {
    const parts = parseDailyContainerId(overContainer);
    if (!parts) return null;
    const ot = activeId.startsWith("pool::")
      ? activeId.slice("pool::".length)
      : "";
    const poolItem = poolByOt.get(ot);
    const lineaId = lineaIdByOt.get(ot);
    if (!poolItem || !lineaId) return null;
    if (otsPlaced.has(ot)) return null;

    const sk = dailySlotKey(parts.maquinaId, parts.turno);
    const targetList = next[sk] ?? [];
    const newItem = buildMesaFromDetallePool(
      poolItem,
      lineaId,
      dayYmd,
      parts.turno,
      targetList.length + 1,
      parts.maquinaId,
    );
    let insertAt = targetList.length;
    if (overId?.startsWith("mesa::")) {
      const overItemId = overId.slice("mesa::".length);
      const idx = targetList.findIndex((x) => x.id === overItemId);
      if (idx >= 0) insertAt = idx;
    }
    const newList = [...targetList];
    newList.splice(insertAt, 0, newItem);
    next[sk] = recomputeSlotOrden(newList);
    affected.add(sk);
    return { next, affected };
  }

  if (
    activeContainer.startsWith("dailyslot::") &&
    overContainer === POOL_CONTAINER_ID
  ) {
    const fromParts = parseDailyContainerId(activeContainer);
    if (!fromParts) return null;
    const fromSk = dailySlotKey(fromParts.maquinaId, fromParts.turno);
    const itemId = activeId.startsWith("mesa::")
      ? activeId.slice("mesa::".length)
      : "";
    const list = next[fromSk] ?? [];
    const idx = list.findIndex((x) => x.id === itemId);
    if (idx < 0) return null;
    list.splice(idx, 1);
    next[fromSk] = recomputeSlotOrden(list);
    affected.add(fromSk);
    return { next, affected };
  }

  if (
    activeContainer.startsWith("dailyslot::") &&
    overContainer.startsWith("dailyslot::")
  ) {
    const fromParts = parseDailyContainerId(activeContainer);
    const toParts = parseDailyContainerId(overContainer);
    if (!fromParts || !toParts) return null;
    const fromSk = dailySlotKey(fromParts.maquinaId, fromParts.turno);
    const toSk = dailySlotKey(toParts.maquinaId, toParts.turno);
    const itemId = activeId.startsWith("mesa::")
      ? activeId.slice("mesa::".length)
      : "";
    const fromList = next[fromSk] ?? [];
    const fromIdx = fromList.findIndex((x) => x.id === itemId);
    if (fromIdx < 0) return null;
    const moving = fromList[fromIdx];
    if (!moving) return null;

    if (fromSk === toSk) {
      if (overId?.startsWith("mesa::")) {
        const overItemId = overId.slice("mesa::".length);
        const overIdx = fromList.findIndex((x) => x.id === overItemId);
        if (overIdx < 0 || overIdx === fromIdx) return { next, affected };
        next[fromSk] = recomputeSlotOrden(arrayMove(fromList, fromIdx, overIdx));
        affected.add(fromSk);
      }
      return { next, affected };
    }

    fromList.splice(fromIdx, 1);
    next[fromSk] = recomputeSlotOrden(fromList);
    affected.add(fromSk);

    const updatedMoving: MesaTrabajo = {
      ...moving,
      maquinaId: toParts.maquinaId,
      turno: toParts.turno,
      fechaPlanificada: dayYmd,
    };
    const toList = next[toSk] ?? [];
    let insertAt = toList.length;
    if (overId?.startsWith("mesa::")) {
      const overItemId = overId.slice("mesa::".length);
      const idx = toList.findIndex((x) => x.id === overItemId);
      if (idx >= 0) insertAt = idx;
    }
    const newList = [...toList];
    newList.splice(insertAt, 0, updatedMoving);
    next[toSk] = recomputeSlotOrden(newList);
    affected.add(toSk);
    return { next, affected };
  }

  return null;
}

export function findDetalleBoardContainer(args: {
  id: string;
  bySlot: Record<DailySlotKey, MesaTrabajo[]>;
  visibleSlotKeys: readonly DailySlotKey[];
  poolOtSet: ReadonlySet<string>;
}): string | null {
  const { id, bySlot, visibleSlotKeys, poolOtSet } = args;
  if (id === POOL_CONTAINER_ID) return POOL_CONTAINER_ID;
  if (id.startsWith("dailyslot::")) return id;
  if (id.startsWith("pool::")) {
    const ot = id.slice("pool::".length);
    return poolOtSet.has(ot) ? POOL_CONTAINER_ID : null;
  }
  if (id.startsWith("mesa::")) {
    const itemId = id.slice("mesa::".length);
    for (const sk of visibleSlotKeys) {
      const list = bySlot[sk] ?? [];
      if (list.some((x) => x.id === itemId)) {
        const parsed = sk.split("::");
        const mid = parsed[0];
        const turno = parsed[1] as TurnoKey;
        return dailyContainerId(mid ?? "", turno);
      }
    }
  }
  return null;
}

/** Draft por máquina para persistir en detalle_dia. */
export function draftByMaquinaFromBoard(
  bySlot: Record<DailySlotKey, MesaTrabajo[]>,
  maquinaIds: readonly string[],
): Map<string, DetalleDiaDraftSlot[]> {
  const out = new Map<string, DetalleDiaDraftSlot[]>();
  for (const maquinaId of maquinaIds) {
    const draft: DetalleDiaDraftSlot[] = [];
    for (const turno of ["manana", "tarde"] as const) {
      const list = bySlot[dailySlotKey(maquinaId, turno)] ?? [];
      for (const it of list) {
        draft.push({
          calendarioOtId: it.id,
          otNumero: it.ot,
          turno,
          slotOrden: it.slotOrden,
        });
      }
    }
    out.set(maquinaId, draft);
  }
  return out;
}

export function allDraftCalendarioOtIds(
  draftByMaquina: ReadonlyMap<string, readonly DetalleDiaDraftSlot[]>,
): Set<string> {
  const s = new Set<string>();
  for (const draft of draftByMaquina.values()) {
    for (const d of draft) s.add(d.calendarioOtId);
  }
  return s;
}

export function getVisibleDailySlotKeysForMaquinas(
  maquinaIds: readonly string[],
): DailySlotKey[] {
  return getVisibleDailySlotKeys(maquinaIds);
}

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function horasFromDespRow(
  d: Record<string, unknown>,
  tipo: PlanificacionTipoMaquina,
): number {
  const hEntrada = parseNum(d.horas_entrada);
  const hTiraje = parseNum(d.horas_tiraje);
  const hTroquelado = parseNum(d.horas_estimadas_troquelado);
  const hEngomado = parseNum(d.horas_estimadas_engomado);
  if (tipo === "impresion" || tipo === "digital") return hEntrada + hTiraje || 1;
  if (tipo === "troquelado") return hTroquelado || 1;
  if (tipo === "engomado") return hEngomado || 1;
  return hEntrada + hTiraje || 1;
}

/** Ancho objetivo del modal según columnas visibles (pool + máquinas). */
export function detalleDiaDialogMaxWidth(visibleMaquinaCount: number): string {
  const n = Math.max(visibleMaquinaCount, 1);
  if (n >= 3) return "min(98vw, 120rem)";
  if (n === 2) return "min(96vw, 72rem)";
  return "min(96vw, 56rem)";
}

export async function fetchDetalleDiaDespachoMetaByOts(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
  tipoMaquina: PlanificacionTipoMaquina,
): Promise<Map<string, DetalleDiaDespachoMeta>> {
  const ots = [...new Set(otNumeros.map((o) => String(o).trim()).filter(Boolean))];
  const out = new Map<string, DetalleDiaDespachoMeta>();
  if (ots.length === 0) return out;

  const genRows = await fetchAllInChunks(ots, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ots_general")
      .select("num_pedido, cliente, titulo, fecha_entrega")
      .in("num_pedido", chunk);
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  });

  const despRows = await fetchAllInChunks(ots, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("produccion_ot_despachadas")
      .select(
        "ot_numero, material, tintas, acabado_pral, num_hojas_brutas, horas_entrada, horas_tiraje, horas_estimadas_troquelado, horas_estimadas_engomado, troquel",
      )
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  });

  const genByOt = new Map<string, Record<string, unknown>>();
  for (const g of genRows) {
    const ot = String(g.num_pedido ?? "").trim();
    if (ot) genByOt.set(ot, g);
  }
  const despByOt = new Map<string, Record<string, unknown>>();
  for (const d of despRows) {
    const ot = String(d.ot_numero ?? "").trim();
    if (ot) despByOt.set(ot, d);
  }

  for (const ot of ots) {
    const g = genByOt.get(ot);
    const r = despByOt.get(ot) ?? {};
    const troquel = String(r.troquel ?? "").trim();
    out.set(ot, {
      cliente: String(g?.cliente ?? "—").trim() || "—",
      trabajo: String(g?.titulo ?? "—").trim() || "—",
      papel: String(r.material ?? "—").trim() || "—",
      tintas: String(r.tintas ?? "—").trim() || "—",
      barniz: null,
      acabadoPral: String(r.acabado_pral ?? "—").trim() || "—",
      numHojasBrutas: parseNum(r.num_hojas_brutas),
      horasPlanificadas: horasFromDespRow(r, tipoMaquina),
      cantidadOt: null,
      fechaEntrega:
        g?.fecha_entrega != null ? String(g.fecha_entrega).slice(0, 10) : null,
      materialStatus: EMPTY_MAT,
      troquelStatus: troquel ? "ok" : EMPTY_TROQ,
    });
  }
  return out;
}

export function lineasToPoolList(
  lineas: readonly CalendarioProduccionLinea[],
  metaByOt: ReadonlyMap<string, DetalleDiaDespachoMeta>,
  isHecha: (l: CalendarioProduccionLinea) => boolean,
): PoolOT[] {
  return lineas
    .filter((l) => !isHecha(l))
    .map((l) => lineaToPoolOt(l, metaByOt.get(l.otNumero)));
}

export type { CalendarioAmbito };
