"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { addDays, format, isSameDay } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Printer,
  RefreshCcw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";

import {
  EditCapacidadDialog,
} from "@/components/produccion/planificacion/mesa/edit-capacidad-dialog";
import {
  ExportDialog,
} from "@/components/produccion/planificacion/mesa/export-dialog";
import {
  PlanificacionCard,
  type PlanificacionCardData,
} from "@/components/produccion/planificacion/mesa/planificacion-card";
import {
  SidebarPool,
} from "@/components/produccion/planificacion/mesa/sidebar-pool";
import {
  POOL_CONTAINER_ID,
} from "@/components/produccion/planificacion/mesa/turno-column";
import {
  MaquinaColumn,
  type MaquinaColumnData,
} from "@/components/produccion/planificacion/mesa-diaria/maquina-column";
import { MesaDiariaPrintTemplate } from "@/components/produccion/planificacion/mesa-diaria/mesa-diaria-print-template";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildMesaFromPool,
  cantidadOtFromMasterRow,
  toDayKey,
} from "@/lib/planificacion-mesa";
import {
  dailyContainerId,
  dailySlotKey,
  flattenDailyBoard,
  getDailyHiddenMaquinasStorageKey,
  getVisibleDailySlotKeys,
  groupMesaItemsByDailySlot,
  parseDailyContainerId,
  type DailySlotKey,
} from "@/lib/planificacion-mesa-diaria";
import {
  etiquetaAmbitoPlanificacion,
  fetchProximoPasoDisponiblePorOt,
  getPlanificacionTipoMaquinaFilter,
  planificacionTipoFiltroEfectivo,
  PLANIFICACION_TIPOS_MAQUINA,
  sortMaquinasPlanificacionUiOrder,
  type PlanificacionTipoMaquina,
} from "@/lib/planificacion-ambito";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
import { cn } from "@/lib/utils";
import type {
  CapacidadTurno,
  DayKey,
  EstadoEjecucionMesa,
  MaterialStatus,
  MesaTrabajo,
  MotivoPausaCategoria,
  PoolOT,
  SlotKey,
  TroquelStatus,
  TurnoKey,
} from "@/types/planificacion-mesa";

// ---------------------------------------------------------------------------
// Constantes BD (alineadas con la mesa semanal)
// ---------------------------------------------------------------------------
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_OTS_GENERAL = "prod_ots_general";
const TABLE_OT_PASOS = "prod_ot_pasos";
const TABLE_POOL = "prod_planificacion_pool";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_CAPACIDAD = "prod_mesa_capacidad_turnos";
const TABLE_MAQUINAS = "prod_maquinas";
const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";

const ACTIVE_MESA_ESTADOS = [
  "borrador",
  "confirmado",
  "en_ejecucion",
  "finalizada",
] as const;
const POOL_BLOCKING_MESA_ESTADOS = ["borrador", "confirmado", "en_ejecucion"] as const;
const EDITABLE_PLAN_ESTADOS = ["borrador", "confirmado"] as const;

// ---------------------------------------------------------------------------
// Helpers locales (versión recortada de los del semanal)
// ---------------------------------------------------------------------------
function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Misma regla que la mesa semanal: horas live desde despachadas según ámbito efectivo. */
function horasPlanificadasFromDespRow(
  d: Record<string, unknown>,
  tipoEfectivo: PlanificacionTipoMaquina | null,
): number {
  const hEntrada = parseNum(d.horas_entrada);
  const hTiraje = parseNum(d.horas_tiraje);
  const hTroquelado = parseNum(d.horas_estimadas_troquelado);
  const hEngomado = parseNum(d.horas_estimadas_engomado);
  if (tipoEfectivo === "impresion" || tipoEfectivo === "digital") {
    return hEntrada + hTiraje;
  }
  if (tipoEfectivo === "troquelado") return hTroquelado;
  if (tipoEfectivo === "engomado") return hEngomado;
  return hEntrada + hTiraje + hTroquelado + hEngomado;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const c = error as Record<string, unknown>;
    const candidates = ["message", "details", "hint", "error", "description", "code", "statusText"];
    for (const k of candidates) {
      const v = c[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    try {
      const raw = JSON.stringify(error);
      if (raw && raw !== "{}") return raw;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

function isMissingColumnError(error: unknown): boolean {
  const msg = getErrorMessage(error, "").toLowerCase();
  return (
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("schema cache") ||
    msg.includes("could not find the") ||
    msg.includes("unknown column")
  );
}

function troquelStatusToDb(value: TroquelStatus): string {
  if (value === "sin_informar") return "desconocido";
  return value;
}

function isMesaTrabajoLocked(it: MesaTrabajo): boolean {
  return it.estadoMesa === "en_ejecucion" || it.estadoMesa === "finalizada";
}

function getLockedSlotOrdens(items: MesaTrabajo[]): Set<number> {
  const out = new Set<number>();
  for (const it of items) {
    if (!isMesaTrabajoLocked(it)) continue;
    const slot = Math.trunc(Number(it.slotOrden));
    if (Number.isFinite(slot) && slot > 0) out.add(slot);
  }
  return out;
}

function recomputeSlotOrdenPreservingLocked(
  items: MesaTrabajo[],
  reservedSlots = getLockedSlotOrdens(items),
): MesaTrabajo[] {
  let nextEditableSlot = 1;
  const normalized = items.map((it) => {
    if (isMesaTrabajoLocked(it)) return it;
    while (reservedSlots.has(nextEditableSlot)) nextEditableSlot += 1;
    const slotOrden = nextEditableSlot;
    nextEditableSlot += 1;
    return { ...it, slotOrden };
  });
  return [...normalized].sort((a, b) => a.slotOrden - b.slotOrden);
}

function dedupeMesaByOt(items: MesaTrabajo[]): MesaTrabajo[] {
  const stateRank = (s: string) =>
    s === "en_ejecucion" ? 4 : s === "finalizada" ? 3 : s === "confirmado" ? 2 : s === "borrador" ? 1 : 0;
  const byOt = new Map<string, MesaTrabajo>();
  for (const it of items) {
    const ot = String(it.ot ?? "").trim();
    if (!ot) continue;
    const prev = byOt.get(ot);
    if (!prev) {
      byOt.set(ot, it);
      continue;
    }
    const prevRank = stateRank(prev.estadoMesa);
    const nextRank = stateRank(it.estadoMesa);
    if (nextRank > prevRank) byOt.set(ot, it);
    else if (nextRank === prevRank && it.slotOrden < prev.slotOrden) byOt.set(ot, it);
  }
  return Array.from(byOt.values());
}

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------
type MaquinaOption = MaquinaColumnData & {
  activa: boolean;
  orden_visual: number;
};

/**
 * Capacidad por (máquina, día, turno). En la mesa diaria la dimensión
 * variable es la máquina, así que extendemos el shape estándar con
 * `maquina_id` para agrupar correctamente sin colisiones.
 */
type CapacidadDailyTurno = {
  maquina_id: string;
  fecha: DayKey;
  turno: TurnoKey;
  capacidadHoras: number;
  motivoAjuste: string | null;
};

/**
 * Re-mapea los items de Mesa diaria al formato `Record<SlotKey, MesaTrabajo[]>`
 * que espera `ExportDialog` / `buildPrintPayload` (clave `${dayKey}::${turno}`,
 * filtrado por una sola máquina).
 */
function buildRealBySlotForMaquina(
  maquinaId: string | null,
  items: MesaTrabajo[],
  dayKey: DayKey,
): Record<SlotKey, MesaTrabajo[]> {
  const mananaKey = `${dayKey}::manana` as SlotKey;
  const tardeKey = `${dayKey}::tarde` as SlotKey;
  const out: Record<SlotKey, MesaTrabajo[]> = {
    [mananaKey]: [],
    [tardeKey]: [],
  };
  if (!maquinaId) return out;
  for (const it of items) {
    if (it.maquinaId !== maquinaId) continue;
    if (it.fechaPlanificada !== dayKey) continue;
    if (it.turno === "manana") out[mananaKey]!.push(it);
    else if (it.turno === "tarde") out[tardeKey]!.push(it);
  }
  for (const k of Object.keys(out) as SlotKey[]) {
    out[k] = out[k]!.slice().sort((a, b) => a.slotOrden - b.slotOrden);
  }
  return out;
}

/** Filtra las capacidades por máquina y normaliza al shape `CapacidadTurno`. */
function buildCapacidadesForMaquina(
  maquinaId: string | null,
  caps: CapacidadDailyTurno[],
): CapacidadTurno[] {
  if (!maquinaId) return [];
  return caps
    .filter((c) => c.maquina_id === maquinaId)
    .map((c) => ({
      fecha: c.fecha,
      turno: c.turno,
      capacidadHoras: c.capacidadHoras,
      motivoAjuste: c.motivoAjuste,
    }));
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function PlanificacionMesaDiariaTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ---- Identidad
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [planificacionRole, setPlanificacionRole] = useState<string | null>(null);

  const ambitoLabel = useMemo(
    () => etiquetaAmbitoPlanificacion(getPlanificacionTipoMaquinaFilter(planificacionRole)),
    [planificacionRole],
  );

  // ---- Día visible
  const [currentDay, setCurrentDay] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  });
  const dayKey = useMemo(() => toDayKey(currentDay), [currentDay]);
  const isToday = useMemo(() => isSameDay(currentDay, new Date()), [currentDay]);

  // ---- Datos
  const [maquinas, setMaquinas] = useState<MaquinaOption[]>([]);
  const [pool, setPool] = useState<PoolOT[]>([]);
  const [mesaItems, setMesaItems] = useState<MesaTrabajo[]>([]);
  const [capacidades, setCapacidades] = useState<CapacidadDailyTurno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingChanges, setSavingChanges] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmingMaquinaId, setConfirmingMaquinaId] = useState<string | null>(null);

  // ---- Búsqueda en pool sidebar
  const [poolSearch, setPoolSearch] = useState("");

  // ---- Columnas ocultas (chips)
  const [hiddenMaquinaIds, setHiddenMaquinaIds] = useState<Set<string>>(new Set());

  // ---- DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
  );
  const collisionDetectionStrategy = useCallback(
    (...args: Parameters<typeof closestCorners>) => {
      const pointerCollisions = pointerWithin(...args);
      if (pointerCollisions.length > 0) return pointerCollisions;
      return closestCorners(...args);
    },
    [],
  );

  // ---- Edición de capacidad
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [capDialogDay, setCapDialogDay] = useState<DayKey | null>(null);
  const [capDialogTurno, setCapDialogTurno] = useState<TurnoKey | null>(null);
  const [capDialogMaquinaId, setCapDialogMaquinaId] = useState<string | null>(null);
  const [savingCap, setSavingCap] = useState(false);

  // ---- Export PDF (hoja operario por máquina)
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMaquinaId, setExportMaquinaId] = useState<string | null>(null);

  const openExportDialogFor = useCallback((maquinaId: string) => {
    setExportMaquinaId(maquinaId);
    setExportDialogOpen(true);
  }, []);

  // ---- Impresión visual del plan del día (PDF #2 — para reuniones).
  // Patrón react-to-print: template offscreen + handler aislado, igual que
  // el botón "PDF" de Gestión Externos. No usa `window.print()` sobre la UI viva.
  const printDiariaRef = useRef<HTMLDivElement>(null);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();
  const handlePrintPlanDiario = useReactToPrint({
    contentRef: printDiariaRef,
    documentTitle: `Minerva-Plan-Diario-${dayKey}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 10mm 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

  // ---- Loaders ============================================================

  const loadMaquinas = useCallback(
    async (roleForFilter: string | null): Promise<MaquinaOption[]> => {
      const tipo = getPlanificacionTipoMaquinaFilter(roleForFilter);
      let query = supabase
        .from(TABLE_MAQUINAS)
        .select(
          "id, codigo, nombre, tipo_maquina, activa, orden_visual, capacidad_horas_default_manana, capacidad_horas_default_tarde",
        )
        .eq("activa", true)
        .order("orden_visual")
        .order("nombre");
      if (tipo) {
        query = query.eq("tipo_maquina", tipo);
      } else {
        query = query.in("tipo_maquina", PLANIFICACION_TIPOS_MAQUINA);
      }
      const { data, error: mqErr } = await query;
      if (mqErr) throw mqErr;
      return ((data ?? []) as MaquinaOption[]).filter((m) =>
        PLANIFICACION_TIPOS_MAQUINA.includes(
          m.tipo_maquina as (typeof PLANIFICACION_TIPOS_MAQUINA)[number],
        ),
      );
    },
    [supabase],
  );

  const loadCapacidades = useCallback(
    async (day: DayKey, maquinaIds: string[]): Promise<CapacidadDailyTurno[]> => {
      if (maquinaIds.length === 0) return [];
      const { data, error: capErr } = await supabase
        .from(TABLE_CAPACIDAD)
        .select("fecha, turno, capacidad_horas, motivo_ajuste, maquina_id")
        .eq("fecha", day)
        .in("maquina_id", maquinaIds);
      if (capErr) throw capErr;
      const rows = (data ?? []) as Array<{
        fecha: string;
        turno: string;
        capacidad_horas: number | string | null;
        motivo_ajuste: string | null;
        maquina_id: string | null;
      }>;
      const out: CapacidadDailyTurno[] = [];
      for (const r of rows) {
        const turno = r.turno === "manana" || r.turno === "tarde" ? r.turno : null;
        const mid = String(r.maquina_id ?? "").trim();
        if (!turno || !mid) continue;
        out.push({
          maquina_id: mid,
          fecha: String(r.fecha),
          turno,
          capacidadHoras: parseNum(r.capacidad_horas),
          motivoAjuste: r.motivo_ajuste ?? null,
        });
      }
      return out;
    },
    [supabase],
  );

  const loadMesa = useCallback(
    async (
      day: DayKey,
      maquinaIds: string[],
      roleForMesa: string | null,
    ): Promise<MesaTrabajo[]> => {
      if (maquinaIds.length === 0) return [];
      const { data, error: mesaErr } = await supabase
        .from(TABLE_MESA)
        .select(
          "id, maquina_id, ot_numero, fecha_planificada, turno, slot_orden, estado_mesa, fecha_entrega_snapshot, material_status, troquel_status, acabado_pral_snapshot, cliente_snapshot, papel_snapshot, tintas_snapshot, barniz_snapshot, num_hojas_brutas_snapshot, horas_planificadas_snapshot",
        )
        .eq("fecha_planificada", day)
        .in("maquina_id", maquinaIds)
        .in("estado_mesa", ACTIVE_MESA_ESTADOS as unknown as string[]);
      if (mesaErr) throw mesaErr;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const otsList = rows
        .map((r) => String(r.ot_numero ?? "").trim())
        .filter((ot) => ot.length > 0);

      const { data: mqTipoRows, error: mqTipoErr } = await supabase
        .from(TABLE_MAQUINAS)
        .select("id, tipo_maquina")
        .in("id", maquinaIds);
      if (mqTipoErr) throw mqTipoErr;
      const tipoByMaquinaId = new Map<string, string>();
      for (const m of (mqTipoRows ?? []) as Array<{
        id?: unknown;
        tipo_maquina?: unknown;
      }>) {
        const id = String(m.id ?? "").trim();
        const t = String(m.tipo_maquina ?? "").trim();
        if (id) tipoByMaquinaId.set(id, t);
      }

      // Cargamos ejecuciones activas por máquina/OT (para badges En marcha/Pausada)
      const ejecByMesaId = new Map<
        string,
        { id: string; estado: EstadoEjecucionMesa; minutosAcum: number }
      >();
      const ejecByOt = new Map<
        string,
        { id: string; estado: EstadoEjecucionMesa; minutosAcum: number }
      >();
      if (rows.length > 0) {
        const { data: ejecData, error: ejecErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .select(
            "id, mesa_trabajo_id, ot_numero, estado_ejecucion, minutos_pausada_acum, updated_at",
          )
          .in("estado_ejecucion", ["pendiente_inicio", "en_curso", "pausada"])
          .in("maquina_id", maquinaIds)
          .order("updated_at", { ascending: false });
        if (ejecErr) throw ejecErr;
        for (const e of (ejecData ?? []) as Array<Record<string, unknown>>) {
          const mesaTrabajoId = String(e.mesa_trabajo_id ?? "").trim();
          const otNumero = String(e.ot_numero ?? "").trim();
          const estadoRaw = String(e.estado_ejecucion ?? "").trim();
          const estado: EstadoEjecucionMesa =
            estadoRaw === "pendiente_inicio" ||
            estadoRaw === "en_curso" ||
            estadoRaw === "pausada"
              ? estadoRaw
              : "en_curso";
          const entry = {
            id: String(e.id ?? ""),
            estado,
            minutosAcum: Math.max(0, Math.trunc(parseNum(e.minutos_pausada_acum))),
          };
          if (mesaTrabajoId && !ejecByMesaId.has(mesaTrabajoId)) ejecByMesaId.set(mesaTrabajoId, entry);
          if (otNumero && !ejecByOt.has(otNumero)) ejecByOt.set(otNumero, entry);
        }
      }

      // Pausa abierta por ejecución (motivo, observaciones)
      const activeExecutionIds = Array.from(
        new Set(
          [...ejecByMesaId.values(), ...ejecByOt.values()]
            .map((x) => x.id)
            .filter((x) => x.length > 0),
        ),
      );
      const openPauseByExecutionId = new Map<
        string,
        {
          pausedAt: string;
          motivoLabel: string | null;
          motivoCategoria: MotivoPausaCategoria | null;
          motivoColorHex: string | null;
          observaciones: string | null;
        }
      >();
      if (activeExecutionIds.length > 0) {
        const { data: pauseData, error: pauseErr } = await supabase
          .from("prod_mesa_ejecuciones_pausas")
          .select(
            "ejecucion_id, paused_at, observaciones_pausa, sys_motivos_pausa(label,categoria,color_hex)",
          )
          .in("ejecucion_id", activeExecutionIds)
          .is("resumed_at", null)
          .order("paused_at", { ascending: false });
        if (pauseErr) throw pauseErr;
        for (const p of (pauseData ?? []) as Array<Record<string, unknown>>) {
          const executionId = String(p.ejecucion_id ?? "").trim();
          if (!executionId || openPauseByExecutionId.has(executionId)) continue;
          const motivoJoin = Array.isArray(p.sys_motivos_pausa)
            ? p.sys_motivos_pausa[0]
            : p.sys_motivos_pausa;
          const motivo =
            motivoJoin && typeof motivoJoin === "object"
              ? (motivoJoin as Record<string, unknown>)
              : null;
          const categoria = String(motivo?.categoria ?? "").trim();
          openPauseByExecutionId.set(executionId, {
            pausedAt: String(p.paused_at ?? ""),
            motivoLabel: String(motivo?.label ?? "").trim() || null,
            motivoCategoria:
              categoria === "operativos" ||
              categoria === "suministros" ||
              categoria === "calidad" ||
              categoria === "tecnicos"
                ? (categoria as MotivoPausaCategoria)
                : null,
            motivoColorHex: String(motivo?.color_hex ?? "").trim() || null,
            observaciones: String(p.observaciones_pausa ?? "").trim() || null,
          });
        }
      }

      // Datos de despachadas (horas por OT+máquina según tipo_maquina, alineado a mesa semanal)
      const numHojasByOt = new Map<string, number>();
      const horasByOtMaquina = new Map<string, number>();
      const resumenHorasPreviasByOt = new Map<
        string,
        { entrada: number; tiraje: number; troquelado: number; engomado: number }
      >();
      if (otsList.length > 0) {
        const { data: despData, error: despErr } = await supabase
          .from(TABLE_DESPACHADAS)
          .select(
            "ot_numero, horas_entrada, horas_tiraje, horas_estimadas_troquelado, horas_estimadas_engomado, num_hojas_brutas",
          )
          .in("ot_numero", otsList);
        if (despErr) throw despErr;
        const despRows = (despData ?? []) as Array<Record<string, unknown>>;
        for (const d of despRows) {
          const ot = String(d.ot_numero ?? "").trim();
          if (!ot) continue;
          const hojas = Math.max(0, Math.trunc(parseNum(d.num_hojas_brutas)));
          numHojasByOt.set(ot, Math.max(numHojasByOt.get(ot) ?? 0, hojas));
        }

        const pairKeys = new Map<string, { ot: string; maquinaId: string }>();
        for (const r of rows) {
          const ot = String(r.ot_numero ?? "").trim();
          const mid = String(r.maquina_id ?? "").trim();
          if (!ot || !mid) continue;
          const key = `${ot}::${mid}`;
          if (!pairKeys.has(key)) pairKeys.set(key, { ot, maquinaId: mid });
        }
        for (const { ot, maquinaId } of pairKeys.values()) {
          const tipoM = tipoByMaquinaId.get(maquinaId) ?? null;
          const tipoEfectivo = planificacionTipoFiltroEfectivo(
            getPlanificacionTipoMaquinaFilter(roleForMesa),
            tipoM,
          );
          let sumHoras = 0;
          for (const d of despRows) {
            if (String(d.ot_numero ?? "").trim() !== ot) continue;
            sumHoras += horasPlanificadasFromDespRow(d, tipoEfectivo);
          }
          horasByOtMaquina.set(`${ot}::${maquinaId}`, sumHoras);
        }

        const { data: resumenEjecData, error: resumenEjecErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .select(
            "ot_numero, horas_reales_entrada, horas_reales_tiraje, horas_reales_troquelado, horas_reales_engomado",
          )
          .in("ot_numero", otsList)
          .eq("estado_ejecucion", "finalizada");
        if (resumenEjecErr && !isMissingColumnError(resumenEjecErr)) throw resumenEjecErr;
        for (const row of (resumenEjecData ?? []) as Array<Record<string, unknown>>) {
          const ot = String(row.ot_numero ?? "").trim();
          if (!ot) continue;
          const prev = resumenHorasPreviasByOt.get(ot) ?? {
            entrada: 0,
            tiraje: 0,
            troquelado: 0,
            engomado: 0,
          };
          prev.entrada += Math.max(0, parseNum(row.horas_reales_entrada));
          prev.tiraje += Math.max(0, parseNum(row.horas_reales_tiraje));
          prev.troquelado += Math.max(0, parseNum(row.horas_reales_troquelado));
          prev.engomado += Math.max(0, parseNum(row.horas_reales_engomado));
          resumenHorasPreviasByOt.set(ot, prev);
        }
      }

      const otTituloCantidadByNum = new Map<
        string,
        { trabajo: string; cantidadOt: number | null }
      >();
      if (otsList.length > 0) {
        const { data: ogData, error: ogErr } = await supabase
          .from(TABLE_OTS_GENERAL)
          .select("num_pedido, titulo, cantidad")
          .in("num_pedido", otsList);
        if (ogErr) throw ogErr;
        for (const o of (ogData ?? []) as Array<Record<string, unknown>>) {
          const k = String(o.num_pedido ?? "").trim();
          if (!k) continue;
          otTituloCantidadByNum.set(k, {
            trabajo: String(o.titulo ?? "").trim() || "—",
            cantidadOt: cantidadOtFromMasterRow(o.cantidad),
          });
        }
      }

      const out: MesaTrabajo[] = [];
      for (const r of rows) {
        const ot = String(r.ot_numero ?? "").trim();
        const maquinaRowId = String(r.maquina_id ?? "").trim();
        const horasLiveKey = ot && maquinaRowId ? `${ot}::${maquinaRowId}` : "";
        const horasLive = Math.max(0, horasLiveKey ? horasByOtMaquina.get(horasLiveKey) ?? 0 : 0);
        const numHojasLive = Math.max(0, Math.trunc(numHojasByOt.get(ot) ?? 0));
        const resumenPrevio = resumenHorasPreviasByOt.get(ot);
        const numHojasSnapshot = Math.trunc(parseNum(r.num_hojas_brutas_snapshot));
        const horasSnapshot = parseNum(r.horas_planificadas_snapshot);
        const estadoMesa = String(r.estado_mesa ?? "borrador");
        const mesaId = String(r.id ?? "");
        const ejec = ejecByMesaId.get(mesaId) ?? (ot ? ejecByOt.get(ot) : undefined);
        const openPause = ejec ? openPauseByExecutionId.get(ejec.id) : undefined;
        const pausadaAtMs = openPause?.pausedAt ? new Date(openPause.pausedAt).getTime() : Number.NaN;
        const deltaMin =
          ejec?.estado === "pausada" && Number.isFinite(pausadaAtMs)
            ? Math.max(0, Math.round((Date.now() - pausadaAtMs) / 60000))
            : 0;
        const minutosPausadaActual = Math.max(0, (ejec?.minutosAcum ?? 0) + deltaMin);
        const isLockedState = estadoMesa === "en_ejecucion" || estadoMesa === "finalizada";
        const numHojasMerged = isLockedState
          ? numHojasSnapshot > 0
            ? numHojasSnapshot
            : numHojasLive
          : numHojasLive > 0
            ? numHojasLive
            : numHojasSnapshot;
        const horasMerged = isLockedState
          ? horasSnapshot > 0
            ? horasSnapshot
            : horasLive
          : horasLive > 0
            ? horasLive
            : horasSnapshot;
        const turnoRaw = String(r.turno ?? "").trim();
        const turno: TurnoKey = turnoRaw === "manana" || turnoRaw === "tarde" ? turnoRaw : "manana";
        const matRaw = String(r.material_status ?? "").trim().toLowerCase();
        const matStatus: MaterialStatus =
          matRaw === "verde" || matRaw === "amarillo" || matRaw === "rojo"
            ? (matRaw as MaterialStatus)
            : "rojo";
        const troqRaw = String(r.troquel_status ?? "").trim().toLowerCase();
        const troqStatus: TroquelStatus =
          troqRaw === "ok" || troqRaw === "falta" || troqRaw === "no_aplica" || troqRaw === "sin_informar"
            ? (troqRaw as TroquelStatus)
            : "sin_informar";
        const ogMeta = ot ? otTituloCantidadByNum.get(ot) : undefined;
        out.push({
          id: String(r.id),
          maquinaId: (r.maquina_id as string | null) ?? null,
          ot,
          fechaPlanificada: String(r.fecha_planificada ?? ""),
          turno,
          slotOrden: Math.trunc(parseNum(r.slot_orden)),
          estadoMesa,
          fechaEntrega: (r.fecha_entrega_snapshot as string | null) ?? null,
          materialStatus: matStatus,
          troquelStatus: troqStatus,
          acabadoPralSnapshot: String(r.acabado_pral_snapshot ?? ""),
          clienteSnapshot: String(r.cliente_snapshot ?? ""),
          papelSnapshot: String(r.papel_snapshot ?? ""),
          tintasSnapshot: String(r.tintas_snapshot ?? ""),
          barnizSnapshot: (r.barniz_snapshot as string | null) ?? null,
          numHojasBrutasSnapshot: numHojasMerged,
          horasPlanificadasSnapshot: horasMerged,
          trabajoTitulo: ogMeta?.trabajo,
          cantidadOt: ogMeta?.cantidadOt ?? null,
          estadoEjecucionActual:
            ejec?.estado === "pendiente_inicio" || ejec?.estado === "en_curso" || ejec?.estado === "pausada"
              ? ejec.estado
              : null,
          minutosPausadaAcumActual: minutosPausadaActual,
          pausaActivaDesdeActual: openPause?.pausedAt ?? null,
          motivoPausaActivaActual: openPause?.motivoLabel ?? null,
          motivoPausaColorHexActual: openPause?.motivoColorHex ?? null,
          motivoPausaCategoriaActual: openPause?.motivoCategoria ?? null,
          observacionesPausaActivaActual: openPause?.observaciones ?? null,
          ejecucionIdActual: ejec?.id ?? null,
          horasPreviasEntrada: resumenPrevio?.entrada ?? 0,
          horasPreviasTiraje: resumenPrevio?.tiraje ?? 0,
          horasPreviasTroquelado: resumenPrevio?.troquelado ?? 0,
          horasPreviasEngomado: resumenPrevio?.engomado ?? 0,
        });
      }
      return dedupeMesaByOt(out);
    },
    [supabase],
  );

  const loadPool = useCallback(
    async (
      roleForFilter: string | null,
      visibleMaquinaIds: string[],
    ): Promise<PoolOT[]> => {
      const tipoEfectivo = planificacionTipoFiltroEfectivo(
        getPlanificacionTipoMaquinaFilter(roleForFilter),
        null,
      );
      const { data: poolData, error: poolErr } = await supabase
        .from(TABLE_POOL)
        .select(
          "id, ot_numero, fecha_entrega_snapshot, material_status, troquel_status, acabado_pral_snapshot",
        )
        .eq("estado_pool", "enviada_mesa");
      if (poolErr) throw poolErr;
      type PoolRow = {
        id: string;
        ot_numero: string;
        fecha_entrega_snapshot: string | null;
        material_status: string | null;
        troquel_status: string | null;
        acabado_pral_snapshot: string | null;
      };
      const rows = (poolData ?? []) as PoolRow[];
      const poolOts = rows.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean);
      if (poolOts.length === 0) return [];

      // Ocultar OTs ya planificadas en CUALQUIER máquina del ámbito visible.
      const otsPlacedAnywhere = new Set<string>();
      const { data: mesaPlacedRows, error: mpErr } = await supabase
        .from(TABLE_MESA)
        .select("ot_numero, maquina_id")
        .in("estado_mesa", POOL_BLOCKING_MESA_ESTADOS as unknown as string[])
        .in("ot_numero", poolOts);
      if (mpErr) throw mpErr;
      const placedRows = (mesaPlacedRows ?? []) as Array<{
        ot_numero?: string | null;
        maquina_id?: string | null;
      }>;
      if (tipoEfectivo) {
        // Ocultamos solo si está en una máquina del mismo tipo.
        const mids = new Set<string>();
        for (const row of placedRows) {
          const mid = String(row.maquina_id ?? "").trim();
          if (mid) mids.add(mid);
        }
        const tipoByMaquinaId = new Map<string, PlanificacionTipoMaquina>();
        if (mids.size > 0) {
          const { data: maqs, error: maqPlErr } = await supabase
            .from(TABLE_MAQUINAS)
            .select("id, tipo_maquina")
            .in("id", [...mids]);
          if (maqPlErr) throw maqPlErr;
          for (const m of maqs ?? []) {
            const id = String((m as { id?: string | null }).id ?? "").trim();
            const rawT = String((m as { tipo_maquina?: string | null }).tipo_maquina ?? "").trim();
            if (!id) continue;
            if ((PLANIFICACION_TIPOS_MAQUINA as readonly string[]).includes(rawT)) {
              tipoByMaquinaId.set(id, rawT as PlanificacionTipoMaquina);
            }
          }
        }
        for (const row of placedRows) {
          const ot = String(row.ot_numero ?? "").trim();
          if (!ot) continue;
          const mid = String(row.maquina_id ?? "").trim();
          if (!mid) {
            otsPlacedAnywhere.add(ot);
            continue;
          }
          if (tipoByMaquinaId.get(mid) === tipoEfectivo) otsPlacedAnywhere.add(ot);
        }
      } else {
        // Sin filtro de tipo: ocultamos si está en cualquier máquina visible.
        const visibles = new Set(visibleMaquinaIds);
        for (const row of placedRows) {
          const ot = String(row.ot_numero ?? "").trim();
          const mid = String(row.maquina_id ?? "").trim();
          if (!ot) continue;
          if (!mid || visibles.has(mid)) otsPlacedAnywhere.add(ot);
        }
      }
      const visibleRows = rows.filter(
        (r) => !otsPlacedAnywhere.has(String(r.ot_numero ?? "").trim()),
      );
      const otsList = visibleRows.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean);
      if (otsList.length === 0) return [];

      // Despachadas (horas, hojas, tintas, material, acabado)
      const { data: despData, error: despErr } = await supabase
        .from(TABLE_DESPACHADAS)
        .select(
          "ot_numero, tintas, material, num_hojas_brutas, horas_entrada, horas_tiraje, horas_estimadas_troquelado, horas_estimadas_engomado, acabado_pral",
        )
        .in("ot_numero", otsList);
      if (despErr) throw despErr;
      const despAgg = new Map<
        string,
        { tintas: string; material: string; numHojas: number; horas: number; acabadoPral: string }
      >();
      const horasByTipoFn = (d: Record<string, unknown>): number => {
        const hEntrada = parseNum(d.horas_entrada);
        const hTiraje = parseNum(d.horas_tiraje);
        const hTroquelado = parseNum(d.horas_estimadas_troquelado);
        const hEngomado = parseNum(d.horas_estimadas_engomado);
        if (tipoEfectivo === "impresion" || tipoEfectivo === "digital") return hEntrada + hTiraje;
        if (tipoEfectivo === "troquelado") return hTroquelado;
        if (tipoEfectivo === "engomado") return hEngomado;
        return hEntrada + hTiraje + hTroquelado + hEngomado;
      };
      for (const d of (despData ?? []) as Array<Record<string, unknown>>) {
        const ot = String(d.ot_numero ?? "").trim();
        if (!ot) continue;
        const horas = horasByTipoFn(d);
        const hojas = Math.max(0, Math.trunc(parseNum(d.num_hojas_brutas)));
        const tintas = String(d.tintas ?? "").trim();
        const material = String(d.material ?? "").trim();
        const acabado = String(d.acabado_pral ?? "").trim();
        const prev = despAgg.get(ot);
        if (!prev) {
          despAgg.set(ot, {
            tintas: tintas || "—",
            material: material || "—",
            numHojas: hojas,
            horas,
            acabadoPral: acabado,
          });
        } else {
          prev.horas += horas;
          if (hojas > prev.numHojas) prev.numHojas = hojas;
          if (prev.tintas === "—" && tintas) prev.tintas = tintas;
          if (prev.material === "—" && material) prev.material = material;
          if (!prev.acabadoPral && acabado) prev.acabadoPral = acabado;
        }
      }

      // Comerciales (cliente, fecha entrega, título)
      const { data: otsData, error: otsErr } = await supabase
        .from(TABLE_OTS_GENERAL)
        .select("num_pedido, cliente, fecha_entrega, titulo, cantidad")
        .in("num_pedido", otsList);
      if (otsErr) throw otsErr;
      const otsByNum = new Map<
        string,
        {
          cliente: string;
          fechaEntrega: string | null;
          trabajo: string;
          cantidadOt: number | null;
        }
      >();
      for (const o of (otsData ?? []) as Array<Record<string, unknown>>) {
        const ot = String(o.num_pedido ?? "").trim();
        if (!ot) continue;
        otsByNum.set(ot, {
          cliente: String(o.cliente ?? "").trim() || "—",
          fechaEntrega:
            typeof o.fecha_entrega === "string" && o.fecha_entrega
              ? (o.fecha_entrega as string)
              : null,
          trabajo: String(o.titulo ?? "").trim() || "—",
          cantidadOt: cantidadOtFromMasterRow(o.cantidad),
        });
      }

      const out: PoolOT[] = [];
      for (const r of visibleRows) {
        const ot = String(r.ot_numero ?? "").trim();
        if (!ot) continue;
        const desp = despAgg.get(ot) ?? {
          tintas: "—",
          material: "—",
          numHojas: 0,
          horas: 0,
          acabadoPral: "",
        };
        const meta = otsByNum.get(ot) ?? {
          cliente: "—",
          fechaEntrega: null,
          trabajo: "—",
          cantidadOt: null,
        };
        const matRaw = String(r.material_status ?? "").trim().toLowerCase();
        const matStatus: MaterialStatus =
          matRaw === "verde" || matRaw === "amarillo" || matRaw === "rojo"
            ? (matRaw as MaterialStatus)
            : "rojo";
        const troqRaw = String(r.troquel_status ?? "").trim().toLowerCase();
        const troqStatus: TroquelStatus =
          troqRaw === "ok" || troqRaw === "falta" || troqRaw === "no_aplica" || troqRaw === "sin_informar"
            ? (troqRaw as TroquelStatus)
            : "sin_informar";
        out.push({
          ot,
          poolId: String(r.id ?? "") || null,
          cliente: meta.cliente,
          trabajo: meta.trabajo,
          papel: desp.material || "",
          tintas: desp.tintas || "—",
          acabadoPral: (r.acabado_pral_snapshot ?? "").toString().trim() || desp.acabadoPral,
          barniz: null,
          fechaEntrega: r.fecha_entrega_snapshot ?? meta.fechaEntrega,
          numHojasBrutas: desp.numHojas,
          horasPlanificadas: desp.horas,
          cantidadOt: meta.cantidadOt,
          materialStatus: matStatus,
          troquelStatus: troqStatus,
          proximoPasoNombre: null,
          proximoPasoSlug: null,
          planificacionTipoPaso: null,
        });
      }
      let poolOut = out;
      try {
        const pasoMap = await fetchProximoPasoDisponiblePorOt(
          supabase,
          poolOut.map((p) => p.ot),
        );
        poolOut = poolOut.map((p) => {
          const info = pasoMap.get(p.ot);
          if (!info) {
            return {
              ...p,
              proximoPasoNombre: "Sin ruta (OT antigua)",
              proximoPasoSlug: null,
              planificacionTipoPaso: null,
            };
          }
          return {
            ...p,
            proximoPasoNombre: info.nombre,
            proximoPasoSlug: info.seccionSlug,
            planificacionTipoPaso: info.tipoMaquina,
          };
        });
      } catch (e) {
        console.warn("[Mesa diaria] pool itinerario", e);
        poolOut = poolOut.map((p) => ({
          ...p,
          proximoPasoNombre: p.proximoPasoNombre ?? "Sin ruta (OT antigua)",
          proximoPasoSlug: p.proximoPasoSlug ?? null,
          planificacionTipoPaso: p.planificacionTipoPaso ?? null,
        }));
      }
      if (tipoEfectivo) {
        poolOut = poolOut.filter(
          (p) => p.planificacionTipoPaso === tipoEfectivo || p.planificacionTipoPaso == null,
        );
      }
      return poolOut;
    },
    [supabase],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const uid =
        typeof authUser?.id === "string" && authUser.id.trim().length > 0
          ? authUser.id.trim()
          : null;
      let roleRead: string | null = null;
      if (uid) {
        setUserId(uid);
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        roleRead =
          prof && typeof (prof as { role?: unknown }).role === "string"
            ? String((prof as { role: string }).role).trim() || null
            : null;
      } else {
        setUserId(null);
      }
      const emailRaw = typeof authUser?.email === "string" ? authUser.email.trim() : "";
      setUserEmail(emailRaw.length > 0 ? emailRaw : null);
      setPlanificacionRole(roleRead);

      const maqList = await loadMaquinas(roleRead);
      const sortedMaqs = sortMaquinasPlanificacionUiOrder(maqList);
      setMaquinas(sortedMaqs);
      const maquinaIds = sortedMaqs.map((m) => m.id);

      const [poolList, mesaList, capList] = await Promise.all([
        loadPool(roleRead, maquinaIds),
        loadMesa(dayKey, maquinaIds, roleRead),
        loadCapacidades(dayKey, maquinaIds),
      ]);
      setPool(poolList);
      setMesaItems(mesaList);
      setCapacidades(capList);
    } catch (e) {
      const msg = getErrorMessage(e, "No se pudo cargar la mesa diaria.");
      console.error("[Mesa diaria] reload", e);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase, dayKey, loadMaquinas, loadPool, loadMesa, loadCapacidades]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ---- Derivados ===========================================================

  /** Máquinas que se renderizarán como columnas (no ocultas). */
  const visibleMaquinas = useMemo(
    () => maquinas.filter((m) => !hiddenMaquinaIds.has(m.id)),
    [maquinas, hiddenMaquinaIds],
  );
  const visibleMaquinaIds = useMemo(
    () => visibleMaquinas.map((m) => m.id),
    [visibleMaquinas],
  );
  const maquinaById = useMemo(() => {
    const m = new Map<string, MaquinaOption>();
    for (const x of maquinas) m.set(x.id, x);
    return m;
  }, [maquinas]);

  /** `bySlot` agrupado por (maquinaId, turno) usando solo los items del día. */
  const bySlot = useMemo(
    () => groupMesaItemsByDailySlot(mesaItems, dayKey, visibleMaquinaIds),
    [mesaItems, dayKey, visibleMaquinaIds],
  );

  const visibleSlotKeys = useMemo(
    () => getVisibleDailySlotKeys(visibleMaquinaIds),
    [visibleMaquinaIds],
  );

  /** Map de pool por OT para inserciones desde el sidebar. */
  const poolByOt = useMemo(() => {
    const m = new Map<string, PoolOT>();
    for (const p of pool) m.set(p.ot, p);
    return m;
  }, [pool]);

  /** OT → título de trabajo, para la hoja operario (PDF #1). */
  const trabajoByOt = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of pool) {
      const t = (p.trabajo ?? "").trim();
      if (t) out[p.ot] = t;
    }
    return out;
  }, [pool]);

  const poolOtsSet = useMemo(() => new Set(pool.map((p) => p.ot)), [pool]);

  /** OTs ya colocadas en el día visible (para que el sidebar no las muestre). */
  const otsEnMesa = useMemo(() => {
    const s = new Set<string>();
    for (const it of mesaItems) {
      if (it.fechaPlanificada !== dayKey) continue;
      const mid = (it.maquinaId ?? "").trim();
      if (mid && visibleMaquinaIds.includes(mid)) s.add(it.ot);
    }
    return s;
  }, [mesaItems, dayKey, visibleMaquinaIds]);

  /**
   * Capacidad efectiva para una (máquina, turno). Si no hay override en BD
   * usa el default de la máquina (mañana/tarde).
   */
  const capacityFor = useCallback(
    (maquinaId: string, turno: TurnoKey): number => {
      const override = capacidades.find(
        (c) => c.maquina_id === maquinaId && c.turno === turno && c.fecha === dayKey,
      );
      if (override && override.capacidadHoras >= 0) return override.capacidadHoras;
      const m = maquinaById.get(maquinaId);
      if (!m) return 8;
      return turno === "manana"
        ? m.capacidad_horas_default_manana ?? 8
        : m.capacidad_horas_default_tarde ?? 8;
    },
    [capacidades, dayKey, maquinaById],
  );

  // ---- DnD: helpers de búsqueda de container ===============================

  const findContainerOf = useCallback(
    (id: string): string | null => {
      if (id === POOL_CONTAINER_ID) return POOL_CONTAINER_ID;
      if (id.startsWith("dailyslot::")) return id;
      if (id.startsWith("pool::")) {
        const ot = id.slice("pool::".length);
        return poolOtsSet.has(ot) ? POOL_CONTAINER_ID : null;
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
    },
    [bySlot, visibleSlotKeys, poolOtsSet],
  );

  // ---- DnD: applyTransitionDaily ===========================================

  type Transition = {
    next: Record<DailySlotKey, MesaTrabajo[]>;
    affected: Set<DailySlotKey>;
  };

  const applyTransitionDaily = useCallback(
    (
      activeContainer: string,
      activeId: string,
      overContainer: string,
      overId: string | null,
      currentBySlot: Record<DailySlotKey, MesaTrabajo[]>,
    ): Transition | null => {
      const affected = new Set<DailySlotKey>();
      const next: Record<DailySlotKey, MesaTrabajo[]> = {};
      for (const k of Object.keys(currentBySlot)) {
        next[k] = [...(currentBySlot[k] ?? [])];
      }
      for (const sk of visibleSlotKeys) if (!next[sk]) next[sk] = [];

      // CASE A: del Pool a un slot diario
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
        if (!poolItem) return null;
        if (otsEnMesa.has(ot)) return null;
        const sk = dailySlotKey(parts.maquinaId, parts.turno);
        const targetList = next[sk] ?? [];
        const newItem: MesaTrabajo = {
          id: `tmp-${ot}-${Date.now()}`,
          ...buildMesaFromPool(
            poolItem,
            dayKey,
            parts.turno,
            targetList.length + 1,
            parts.maquinaId,
          ),
        };
        let insertAt = targetList.length;
        if (overId && overId.startsWith("mesa::")) {
          const overItemId = overId.slice("mesa::".length);
          const idx = targetList.findIndex((x) => x.id === overItemId);
          if (idx >= 0) insertAt = idx;
        }
        const newList = [...targetList];
        newList.splice(insertAt, 0, newItem);
        next[sk] = recomputeSlotOrdenPreservingLocked(newList);
        affected.add(sk);
        return { next, affected };
      }

      // CASE B: de un slot al Pool (devolver al pool)
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
        if (list[idx] && isMesaTrabajoLocked(list[idx]!)) return null;
        list.splice(idx, 1);
        next[fromSk] = recomputeSlotOrdenPreservingLocked(list);
        affected.add(fromSk);
        return { next, affected };
      }

      // CASE C: entre slots diarios (reorder o cross-machine/cross-turno)
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
        if (isMesaTrabajoLocked(moving)) return null;

        if (fromSk === toSk) {
          // Reorder
          if (overId && overId.startsWith("mesa::")) {
            const overItemId = overId.slice("mesa::".length);
            const overIdx = fromList.findIndex((x) => x.id === overItemId);
            if (overIdx < 0 || overIdx === fromIdx) return { next, affected };
            const newList = arrayMove(fromList, fromIdx, overIdx);
            next[fromSk] = recomputeSlotOrdenPreservingLocked(newList);
            affected.add(fromSk);
            return { next, affected };
          }
          return { next, affected };
        }

        // Cross-slot move: actualizamos máquina + turno del item.
        fromList.splice(fromIdx, 1);
        next[fromSk] = recomputeSlotOrdenPreservingLocked(fromList);
        affected.add(fromSk);
        const updatedMoving: MesaTrabajo = {
          ...moving,
          maquinaId: toParts.maquinaId,
          turno: toParts.turno,
          fechaPlanificada: dayKey,
        };
        const toList = next[toSk] ?? [];
        let insertAt = toList.length;
        if (overId && overId.startsWith("mesa::")) {
          const overItemId = overId.slice("mesa::".length);
          const idx = toList.findIndex((x) => x.id === overItemId);
          if (idx >= 0) insertAt = idx;
        }
        const newList = [...toList];
        newList.splice(insertAt, 0, updatedMoving);
        next[toSk] = recomputeSlotOrdenPreservingLocked(newList);
        affected.add(toSk);
        return { next, affected };
      }

      return null;
    },
    [visibleSlotKeys, poolByOt, otsEnMesa, dayKey],
  );

  // ---- Persistencia BD por slot diario =====================================

  const persistDailySlot = useCallback(
    async (sk: DailySlotKey, items: MesaTrabajo[]) => {
      const parts = sk.split("::");
      const maquinaId = parts[0];
      const turno = parts[1] as TurnoKey;
      if (!maquinaId || (turno !== "manana" && turno !== "tarde")) return;

      // Delete existentes del slot (solo de esta máquina y día/turno editables)
      const { error: delErr } = await supabase
        .from(TABLE_MESA)
        .delete()
        .eq("fecha_planificada", dayKey)
        .eq("turno", turno)
        .eq("maquina_id", maquinaId)
        .in("estado_mesa", EDITABLE_PLAN_ESTADOS as unknown as string[]);
      if (delErr) throw delErr;

      const editableItems = dedupeMesaByOt(
        recomputeSlotOrdenPreservingLocked(items).filter(
          (it) => !isMesaTrabajoLocked(it),
        ),
      );
      if (editableItems.length === 0) return;

      const fullInserts = editableItems.map((it) => ({
        ot_numero: it.ot,
        fecha_planificada: dayKey,
        turno,
        maquina_id: maquinaId,
        slot_orden: it.slotOrden,
        maquina: null,
        estado_mesa: "borrador",
        prioridad_snapshot: null,
        fecha_entrega_snapshot: it.fechaEntrega,
        material_status: it.materialStatus,
        troquel_status: troquelStatusToDb(it.troquelStatus),
        acabado_pral_snapshot: it.acabadoPralSnapshot || null,
        cliente_snapshot: it.clienteSnapshot || null,
        papel_snapshot: it.papelSnapshot || null,
        tintas_snapshot: it.tintasSnapshot || null,
        barniz_snapshot: it.barnizSnapshot,
        num_hojas_brutas_snapshot: it.numHojasBrutasSnapshot,
        horas_planificadas_snapshot: it.horasPlanificadasSnapshot,
        created_by: userId,
        created_by_email: userEmail,
      }));
      const { error: insErrFull } = await supabase
        .from(TABLE_MESA)
        .insert(fullInserts);
      if (!insErrFull) return;

      // Fallback para esquemas legacy sin todos los snapshots.
      if (!isMissingColumnError(insErrFull)) throw insErrFull;
      const legacyInserts = editableItems.map((it) => ({
        ot_numero: it.ot,
        fecha_planificada: dayKey,
        turno,
        maquina_id: maquinaId,
        slot_orden: it.slotOrden,
        maquina: null,
        estado_mesa: "borrador",
        prioridad_snapshot: null,
        fecha_entrega_snapshot: it.fechaEntrega,
        material_status: it.materialStatus,
        troquel_status: troquelStatusToDb(it.troquelStatus),
        acabado_pral_snapshot: it.acabadoPralSnapshot || null,
        created_by: userId,
        created_by_email: userEmail,
      }));
      const { error: insErrLegacy } = await supabase
        .from(TABLE_MESA)
        .insert(legacyInserts);
      if (insErrLegacy) throw insErrLegacy;
    },
    [supabase, dayKey, userId, userEmail],
  );

  const persistDailyAffectedSlots = useCallback(
    async (
      newBySlot: Record<DailySlotKey, MesaTrabajo[]>,
      affected: Set<DailySlotKey>,
    ) => {
      setSavingChanges(true);
      try {
        for (const sk of affected) {
          await persistDailySlot(sk, newBySlot[sk] ?? []);
        }
      } catch (e) {
        const msg = getErrorMessage(e, "No se pudo guardar el cambio.");
        console.error("[Mesa diaria] persist", { msg, affected: [...affected] });
        toast.error(msg);
        await reload();
      } finally {
        setSavingChanges(false);
      }
    },
    [persistDailySlot, reload],
  );

  /** Al devolver una OT al pool, garantizamos que sigue visible en mesa. */
  const ensurePoolStateForOt = useCallback(
    async (otNumero: string) => {
      const ot = otNumero.trim();
      if (!ot) return;
      const { error: poolErr } = await supabase
        .from(TABLE_POOL)
        .update({ estado_pool: "enviada_mesa" })
        .eq("ot_numero", ot);
      if (poolErr) throw poolErr;
    },
    [supabase],
  );

  // ---- DnD handlers ========================================================

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id));
    },
    [],
  );

  /**
   * En la mesa diaria no aplicamos pre-visualización entre containers en
   * `onDragOver` para evitar guardados parciales o flickers; el destino se
   * resuelve íntegramente en `onDragEnd`.
   */
  const onDragOver = useCallback(() => {
    /* noop */
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;
      const aId = String(active.id);
      const oId = String(over.id);
      if (aId === oId) return;

      const fromContainer = aId.startsWith("pool::")
        ? POOL_CONTAINER_ID
        : findContainerOf(aId);
      const toContainer = findContainerOf(oId);
      if (!fromContainer || !toContainer) return;

      const movingMesaId = aId.startsWith("mesa::") ? aId.slice("mesa::".length) : "";
      const movingItem =
        movingMesaId && fromContainer.startsWith("dailyslot::")
          ? (() => {
              const parts = parseDailyContainerId(fromContainer);
              if (!parts) return null;
              const list = bySlot[dailySlotKey(parts.maquinaId, parts.turno)] ?? [];
              return list.find((it) => it.id === movingMesaId) ?? null;
            })()
          : null;

      const t = applyTransitionDaily(
        fromContainer,
        aId,
        toContainer,
        oId.startsWith("dailyslot::") || oId === POOL_CONTAINER_ID ? null : oId,
        bySlot,
      );
      if (!t) {
        if (
          fromContainer.startsWith("dailyslot::") &&
          toContainer === POOL_CONTAINER_ID &&
          movingItem &&
          isMesaTrabajoLocked(movingItem)
        ) {
          toast.error("No puedes devolver al pool una OT en ejecución o finalizada.");
        }
        return;
      }

      // Aplicamos el resultado al estado plano: aplanamos el next y reemplazamos
      // los items del día/máquinas visibles, conservando los demás.
      const updatedFlat = flattenDailyBoard(t.next);
      setMesaItems((prev) => {
        const keep = prev.filter((it) => {
          if (it.fechaPlanificada !== dayKey) return true;
          const mid = (it.maquinaId ?? "").trim();
          if (!mid) return true;
          return !visibleMaquinaIds.includes(mid);
        });
        return [...keep, ...updatedFlat];
      });

      if (
        fromContainer.startsWith("dailyslot::") &&
        toContainer === POOL_CONTAINER_ID &&
        movingItem?.ot
      ) {
        try {
          await ensurePoolStateForOt(movingItem.ot);
        } catch (e) {
          console.error("[Mesa diaria] ensurePoolStateForOt", e);
        }
      }
      void persistDailyAffectedSlots(t.next, t.affected).then(() => {
        void reload();
      });
    },
    [
      bySlot,
      dayKey,
      visibleMaquinaIds,
      findContainerOf,
      applyTransitionDaily,
      ensurePoolStateForOt,
      persistDailyAffectedSlots,
      reload,
    ],
  );

  // ---- Acciones por tarjeta (lanzar / iniciar / pausar / etc.) =============

  const launchExecution = useCallback(
    async (trabajo: MesaTrabajo, options?: { startImmediately?: boolean }) => {
      const maquinaId = trabajo.maquinaId?.trim() || null;
      if (!maquinaId) {
        toast.error("La OT no tiene máquina asignada.");
        return;
      }
      if (trabajo.estadoMesa !== "confirmado") {
        toast.error(
          "Solo se pueden liberar OTs confirmadas. Pulsa primero «Confirmar planificación» o «Confirmar día» en la máquina.",
        );
        return;
      }
      setActionLoadingId(trabajo.id);
      try {
        const nowIso = new Date().toISOString();
        const otKey = String(trabajo.ot ?? "").trim();
        let otPasoId: string | null = null;
        if (otKey) {
          const { data: ogRow, error: ogErr } = await supabase
            .from(TABLE_OTS_GENERAL)
            .select("id")
            .eq("num_pedido", otKey)
            .maybeSingle();
          if (ogErr) throw ogErr;
          const ogId =
            ogRow && typeof (ogRow as { id?: unknown }).id === "string"
              ? (ogRow as { id: string }).id
              : null;
          if (ogId) {
            const { data: pasoRows, error: pasoErr } = await supabase
              .from(TABLE_OT_PASOS)
              .select("id")
              .eq("ot_id", ogId)
              .eq("estado", "disponible")
              .order("orden", { ascending: true })
              .limit(1);
            if (pasoErr) throw pasoErr;
            const first = pasoRows?.[0] as { id?: string } | undefined;
            if (first?.id) otPasoId = first.id;
          }
        }
        const { data: insRow, error: insErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .insert({
            mesa_trabajo_id: trabajo.id,
            ot_numero: trabajo.ot,
            maquina_id: maquinaId,
            fecha_planificada: trabajo.fechaPlanificada,
            turno: trabajo.turno,
            slot_orden: trabajo.slotOrden,
            liberada_at: nowIso,
            inicio_real_at: null,
            estado_ejecucion: "pendiente_inicio",
            horas_planificadas_snapshot: trabajo.horasPlanificadasSnapshot,
            ot_paso_id: otPasoId,
            created_by: userId,
            created_by_email: userEmail,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        const insertedId = String((insRow as { id?: unknown })?.id ?? "").trim();
        const { error: updErr } = await supabase
          .from(TABLE_MESA)
          .update({ estado_mesa: "en_ejecucion" })
          .eq("id", trabajo.id);
        if (updErr) throw updErr;
        if (options?.startImmediately) {
          if (!insertedId) throw new Error("No se obtuvo el id de la ejecución creada.");
          const { error: startErr } = await supabase
            .from(TABLE_EJECUCIONES)
            .update({
              estado_ejecucion: "en_curso",
              inicio_real_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", insertedId);
          if (startErr) throw startErr;
          toast.success(`OT ${trabajo.ot} liberada e iniciada en máquina.`);
        } else {
          toast.success(`OT ${trabajo.ot} liberada a máquina.`);
        }
        await reload();
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo liberar la OT."));
        await reload();
      } finally {
        setActionLoadingId(null);
      }
    },
    [supabase, userId, userEmail, reload],
  );

  const runMesaAction = useCallback(
    async (
      trabajo: MesaTrabajo,
      action: "lanzar" | "iniciar" | "pausar" | "reanudar" | "cancelar" | "finalizar",
      payload?: {
        horasEntrada: number | null;
        horasTiraje: number | null;
        horasTroquelado: number | null;
        horasEngomado: number | null;
        numHojas: number | null;
        cantidadUnidades: number | null;
        notas: string | null;
      },
    ) => {
      if (action === "lanzar") {
        await launchExecution(trabajo);
        return;
      }
      if (action === "iniciar" && !trabajo.ejecucionIdActual?.trim()) {
        await launchExecution(trabajo, { startImmediately: true });
        return;
      }
      const ejecucionId = trabajo.ejecucionIdActual?.trim() || null;
      if (!ejecucionId) {
        toast.error("No se encontró ejecución activa para esta OT.");
        return;
      }
      setActionLoadingId(trabajo.id);
      try {
        const nowIso = new Date().toISOString();
        if (action === "iniciar") {
          const { error } = await supabase
            .from(TABLE_EJECUCIONES)
            .update({ estado_ejecucion: "en_curso", inicio_real_at: nowIso, updated_at: nowIso })
            .eq("id", ejecucionId);
          if (error) throw error;
        } else if (action === "pausar") {
          const { error } = await supabase
            .from(TABLE_EJECUCIONES)
            .update({ estado_ejecucion: "pausada", updated_at: nowIso })
            .eq("id", ejecucionId);
          if (error) throw error;
        } else if (action === "reanudar") {
          const { error } = await supabase
            .from(TABLE_EJECUCIONES)
            .update({ estado_ejecucion: "en_curso", updated_at: nowIso })
            .eq("id", ejecucionId);
          if (error) throw error;
        } else if (action === "cancelar") {
          const { error: execErr } = await supabase
            .from(TABLE_EJECUCIONES)
            .update({ estado_ejecucion: "cancelada", fin_real_at: nowIso, updated_at: nowIso })
            .eq("id", ejecucionId);
          if (execErr) throw execErr;
          const { error: mesaErr } = await supabase
            .from(TABLE_MESA)
            .update({ estado_mesa: "finalizada" })
            .eq("id", trabajo.id);
          if (mesaErr) throw mesaErr;
        } else if (action === "finalizar") {
          const horasEntrada = payload?.horasEntrada ?? null;
          const horasTiraje = payload?.horasTiraje ?? null;
          const horasTroquelado = payload?.horasTroquelado ?? null;
          const horasEngomado = payload?.horasEngomado ?? null;
          const horasTotal =
            (horasEntrada ?? 0) +
            (horasTiraje ?? 0) +
            (horasTroquelado ?? 0) +
            (horasEngomado ?? 0);
          const { error: execErr } = await supabase
            .from(TABLE_EJECUCIONES)
            .update({
              estado_ejecucion: "finalizada",
              fin_real_at: nowIso,
              updated_at: nowIso,
              horas_reales: horasTotal > 0 ? horasTotal : null,
              horas_reales_entrada: horasEntrada,
              horas_reales_tiraje: horasTiraje,
              horas_reales_troquelado: horasTroquelado,
              horas_reales_engomado: horasEngomado,
              num_hojas_producidas: payload?.numHojas ?? null,
              cantidad_unidades: payload?.cantidadUnidades ?? null,
              observaciones: payload?.notas ?? null,
            })
            .eq("id", ejecucionId);
          if (execErr) throw execErr;
          const { error: mesaErr } = await supabase
            .from(TABLE_MESA)
            .update({ estado_mesa: "finalizada" })
            .eq("id", trabajo.id);
          if (mesaErr) throw mesaErr;
        }
        toast.success("Acción aplicada.");
        await reload();
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo aplicar la acción."));
        await reload();
      } finally {
        setActionLoadingId(null);
      }
    },
    [launchExecution, reload, supabase],
  );

  // ---- Confirmar columna (borrador → confirmado para esa máquina/día) ======

  const confirmColumn = useCallback(
    async (maquinaId: string) => {
      setConfirmingMaquinaId(maquinaId);
      try {
        const { error: updErr } = await supabase
          .from(TABLE_MESA)
          .update({ estado_mesa: "confirmado" })
          .eq("fecha_planificada", dayKey)
          .eq("maquina_id", maquinaId)
          .eq("estado_mesa", "borrador");
        if (updErr) throw updErr;
        toast.success("Borradores confirmados para el día.");
        await reload();
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo confirmar."));
      } finally {
        setConfirmingMaquinaId(null);
      }
    },
    [supabase, dayKey, reload],
  );

  /** Confirma borradores del día en todas las máquinas del ámbito (misma operación que semanal, varias columnas). */
  const confirmPlanificacionDiaria = useCallback(async () => {
    if (maquinas.length === 0) {
      toast.error("No hay máquinas para confirmar la planificación.");
      return;
    }
    if (mesaItems.length === 0) {
      toast.error("No hay trabajos en el día actual para confirmar.");
      return;
    }
    const ids = maquinas.map((m) => m.id);
    setSavingChanges(true);
    try {
      const { error: updErr } = await supabase
        .from(TABLE_MESA)
        .update({ estado_mesa: "confirmado" })
        .eq("fecha_planificada", dayKey)
        .in("maquina_id", ids)
        .eq("estado_mesa", "borrador");
      if (updErr) throw updErr;
      toast.success("Planificación confirmada.");
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo confirmar la planificación."));
    } finally {
      setSavingChanges(false);
    }
  }, [supabase, dayKey, maquinas, mesaItems.length, reload]);

  // ---- Capacidad: abrir y guardar ==========================================

  const openCapacityDialog = useCallback(
    (maquinaId: string, day: DayKey, turno: TurnoKey) => {
      setCapDialogMaquinaId(maquinaId);
      setCapDialogDay(day);
      setCapDialogTurno(turno);
      setCapDialogOpen(true);
    },
    [],
  );

  const saveCapacity = useCallback(
    async (horas: number, motivo: string | null) => {
      if (!capDialogDay || !capDialogTurno || !capDialogMaquinaId) return;
      setSavingCap(true);
      try {
        const { error: capErr } = await supabase
          .from(TABLE_CAPACIDAD)
          .upsert(
            [
              {
                fecha: capDialogDay,
                turno: capDialogTurno,
                maquina_id: capDialogMaquinaId,
                capacidad_horas: horas,
                motivo_ajuste: motivo,
              },
            ],
            { onConflict: "fecha,turno,maquina_id" },
          );
        if (capErr) throw capErr;
        toast.success("Capacidad actualizada.");
        setCapDialogOpen(false);
        await reload();
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo actualizar la capacidad."));
      } finally {
        setSavingCap(false);
      }
    },
    [supabase, capDialogDay, capDialogTurno, capDialogMaquinaId, reload],
  );

  // ---- Carga inicial: usuario y rol
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid = typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;
      const email = typeof user?.email === "string" && user.email.trim() ? user.email.trim() : null;
      if (!mounted) return;
      setUserId(uid);
      setUserEmail(email);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (!mounted) return;
        const role =
          prof && typeof (prof as { role?: unknown }).role === "string"
            ? String((prof as { role: string }).role).trim() || null
            : null;
        setPlanificacionRole(role);
      } else {
        setPlanificacionRole(null);
      }
    })().catch(() => {
      if (mounted) {
        setUserId(null);
        setUserEmail(null);
        setPlanificacionRole(null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // ---- Hidratar columnas ocultas desde localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getDailyHiddenMaquinasStorageKey(userId);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setHiddenMaquinaIds(new Set());
        return;
      }
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setHiddenMaquinaIds(new Set(arr.filter((x): x is string => typeof x === "string")));
      } else {
        setHiddenMaquinaIds(new Set());
      }
    } catch {
      setHiddenMaquinaIds(new Set());
    }
  }, [userId]);

  // ---- Persistir columnas ocultas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getDailyHiddenMaquinasStorageKey(userId);
    try {
      window.localStorage.setItem(key, JSON.stringify([...hiddenMaquinaIds]));
    } catch {
      /* ignore */
    }
  }, [hiddenMaquinaIds, userId]);

  // ---- Atajos de teclado (←/→/T) ==========================================

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isEditableTarget = (el: EventTarget | null): boolean => {
      if (!el || typeof (el as HTMLElement).tagName !== "string") return false;
      const tag = (el as HTMLElement).tagName.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      const ce = (el as HTMLElement).isContentEditable;
      return Boolean(ce);
    };
    const handler = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (isEditableTarget(ev.target)) return;
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        setCurrentDay((d) => addDays(d, -1));
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        setCurrentDay((d) => addDays(d, 1));
      } else if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        const now = new Date();
        setCurrentDay(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---- Datos derivados para el render ======================================

  const draggingMesaItem = useMemo(() => {
    if (!activeId || !activeId.startsWith("mesa::")) return null;
    const id = activeId.slice("mesa::".length);
    return mesaItems.find((it) => it.id === id) ?? null;
  }, [activeId, mesaItems]);

  const draggingPoolItem = useMemo(() => {
    if (!activeId || !activeId.startsWith("pool::")) return null;
    const ot = activeId.slice("pool::".length);
    return poolByOt.get(ot) ?? null;
  }, [activeId, poolByOt]);

  const overlayCard = useMemo<PlanificacionCardData | null>(() => {
    if (draggingMesaItem) {
      return {
        ot: draggingMesaItem.ot,
        cliente: draggingMesaItem.clienteSnapshot,
        tintas: draggingMesaItem.tintasSnapshot,
        barniz: draggingMesaItem.barnizSnapshot,
        acabadoPral: draggingMesaItem.acabadoPralSnapshot,
        papel: draggingMesaItem.papelSnapshot,
        numHojas: draggingMesaItem.numHojasBrutasSnapshot,
        horas: draggingMesaItem.horasPlanificadasSnapshot,
        materialStatus: draggingMesaItem.materialStatus,
        trabajoTitulo: draggingMesaItem.trabajoTitulo,
        cantidadOt: draggingMesaItem.cantidadOt ?? null,
      };
    }
    if (draggingPoolItem) {
      return {
        ot: draggingPoolItem.ot,
        cliente: draggingPoolItem.cliente,
        tintas: draggingPoolItem.tintas,
        barniz: draggingPoolItem.barniz,
        acabadoPral: draggingPoolItem.acabadoPral,
        papel: draggingPoolItem.papel,
        numHojas: draggingPoolItem.numHojasBrutas,
        horas: draggingPoolItem.horasPlanificadas,
        materialStatus: draggingPoolItem.materialStatus,
        trabajoTitulo: draggingPoolItem.trabajo,
        cantidadOt: draggingPoolItem.cantidadOt,
      };
    }
    return null;
  }, [draggingMesaItem, draggingPoolItem]);

  const initialCapDialogValues = useMemo(() => {
    if (!capDialogDay || !capDialogTurno || !capDialogMaquinaId) {
      return { horas: 8, motivo: null as string | null };
    }
    const cur = capacidades.find(
      (c) =>
        c.fecha === capDialogDay &&
        c.turno === capDialogTurno &&
        c.maquina_id === capDialogMaquinaId,
    );
    if (cur) return { horas: cur.capacidadHoras, motivo: cur.motivoAjuste };
    const m = maquinaById.get(capDialogMaquinaId);
    const def =
      m && capDialogTurno === "manana"
        ? m.capacidad_horas_default_manana
        : m && capDialogTurno === "tarde"
          ? m.capacidad_horas_default_tarde
          : 8;
    return { horas: def ?? 8, motivo: null };
  }, [capDialogDay, capDialogTurno, capDialogMaquinaId, capacidades, maquinaById]);

  // ---- Render ==============================================================

  const noMaquinas = !loading && maquinas.length === 0;
  const todasOcultas = !loading && maquinas.length > 0 && visibleMaquinas.length === 0;

  const confirmPlanificacionDisabled =
    loading || savingChanges || maquinas.length === 0 || mesaItems.length === 0;

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader className="gap-2 space-y-0 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-lg text-[#002147]">
              Mesa diaria — {ambitoLabel}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Visión del día con todas las máquinas del ámbito. Arrastra entre
              máquinas y turnos · Atajos: ← / → · T (Hoy).
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              type="button"
              size="sm"
              className="h-8 bg-[#002147] text-white hover:bg-[#001735]"
              disabled={confirmPlanificacionDisabled}
              onClick={() => void confirmPlanificacionDiaria()}
              title="Confirmar todos los borradores del día en todas las máquinas del ámbito"
            >
              {savingChanges ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="mr-1 size-4" aria-hidden />
              )}
              Confirmar planificación
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handlePrintPlanDiario()}
              disabled={loading || visibleMaquinas.length === 0}
              title="Imprimir / Guardar como PDF el plan visual del día (todas las máquinas)"
            >
              <Printer className="mr-1 size-4" aria-hidden />
              Imprimir plan del día
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => void reload()}
              disabled={loading}
              title="Recargar"
            >
              <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white p-1 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCurrentDay((d) => addDays(d, -1))}
              title="Día anterior (←)"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant={isToday ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-7 px-2 text-xs",
                isToday && "bg-[#002147] text-white hover:bg-[#001735]",
              )}
              onClick={() => {
                const now = new Date();
                setCurrentDay(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
              }}
              title="Hoy (T)"
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCurrentDay((d) => addDays(d, 1))}
              title="Día siguiente (→)"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
            <CalendarDays className="ml-1 size-3.5 text-slate-400" aria-hidden />
            <Input
              type="date"
              value={dayKey}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, mo, d] = v.split("-").map(Number);
                if (!y || !mo || !d) return;
                setCurrentDay(new Date(y, mo - 1, d, 0, 0, 0, 0));
              }}
              className="h-7 w-[10rem] border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1"
              title="Selector de día"
            />
          </div>
          <span
            className="inline-flex items-center rounded-md border border-slate-200 bg-white/70 px-2 py-1 text-[11px] font-medium capitalize text-slate-700 shadow-xs"
            aria-live="polite"
          >
            {format(currentDay, "EEEE, d 'de' LLLL yyyy", { locale: esLocale })}
          </span>
          {savingChanges ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Guardando…
            </span>
          ) : null}
        </div>

        {maquinas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-slate-500">Máquinas:</span>
            {maquinas.map((m) => {
              const hidden = hiddenMaquinaIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setHiddenMaquinaIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.id)) next.delete(m.id);
                      else next.add(m.id);
                      return next;
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    hidden
                      ? "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                  )}
                  title={hidden ? `Mostrar ${m.nombre}` : `Ocultar ${m.nombre}`}
                >
                  {hidden ? (
                    <Eye className="size-3" aria-hidden />
                  ) : (
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                  )}
                  {m.nombre}
                </button>
              );
            })}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        {noMaquinas ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-600">
            No hay máquinas activas en tu ámbito. Ve a Settings → Recursos
            Producción y activa al menos una.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={(e) => void onDragEnd(e)}
          >
            <div
              className={cn(
                "grid gap-3",
                "grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]",
              )}
            >
              <SidebarPool
                pool={pool}
                loading={loading}
                search={poolSearch}
                onSearchChange={setPoolSearch}
                otsEnMesa={otsEnMesa}
                disabled={loading}
              />

              <div className="min-w-0">
                {loading ? (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-[28rem] w-[18rem] shrink-0 rounded-md" />
                    ))}
                  </div>
                ) : todasOcultas ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-600">
                    Tienes todas las máquinas ocultas. Activa al menos una con
                    los chips de arriba.
                  </div>
                ) : (
                  <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
                    {visibleMaquinas.map((m) => {
                      const itemsManana = bySlot[dailySlotKey(m.id, "manana")] ?? [];
                      const itemsTarde = bySlot[dailySlotKey(m.id, "tarde")] ?? [];
                      return (
                        <MaquinaColumn
                          key={m.id}
                          maquina={m}
                          dayKey={dayKey}
                          itemsManana={itemsManana}
                          itemsTarde={itemsTarde}
                          capacityManana={capacityFor(m.id, "manana")}
                          capacityTarde={capacityFor(m.id, "tarde")}
                          onEditCapacity={openCapacityDialog}
                          onAction={runMesaAction}
                          actionLoadingId={actionLoadingId}
                          disabled={loading}
                          onConfirmColumn={() => void confirmColumn(m.id)}
                          confirmingColumn={confirmingMaquinaId === m.id}
                          onHideColumn={() => {
                            setHiddenMaquinaIds((prev) => {
                              const next = new Set(prev);
                              next.add(m.id);
                              return next;
                            });
                          }}
                          onExportPdf={() => openExportDialogFor(m.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DragOverlay>
              {overlayCard ? (
                <PlanificacionCard data={overlayCard} isDragging fixedHeight />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>

      <EditCapacidadDialog
        open={capDialogOpen}
        onOpenChange={(o) => (savingCap ? null : setCapDialogOpen(o))}
        fecha={capDialogDay}
        turno={capDialogTurno}
        initialHoras={initialCapDialogValues.horas}
        initialMotivo={initialCapDialogValues.motivo}
        saving={savingCap}
        onSave={saveCapacity}
      />

      {exportMaquinaId ? (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={(open) => {
            setExportDialogOpen(open);
            if (!open) setExportMaquinaId(null);
          }}
          visibleDayKeys={[dayKey]}
          weekMondayKey={dayKey}
          realBySlot={buildRealBySlotForMaquina(
            exportMaquinaId,
            mesaItems,
            dayKey,
          )}
          draftBySlot={null}
          simulationOn={false}
          capacidades={buildCapacidadesForMaquina(exportMaquinaId, capacidades)}
          maquinaId={exportMaquinaId}
          maquinaNombre={maquinaById.get(exportMaquinaId)?.nombre ?? "—"}
          defaultCapacidad={
            maquinaById.get(exportMaquinaId)?.capacidad_horas_default_manana ?? 8
          }
          userEmail={userEmail}
          trabajoByOt={trabajoByOt}
        />
      ) : null}

      <MesaDiariaPrintTemplate
        ref={printDiariaRef}
        ambitoLabel={ambitoLabel}
        dayKey={dayKey}
        currentDay={currentDay}
        maquinas={visibleMaquinas}
        mesaItems={mesaItems}
        capacidades={capacidades}
        trabajoByOt={trabajoByOt}
        umbrales={umbralesOtsCompras}
        generadoPor={userEmail}
      />
    </Card>
  );
}
