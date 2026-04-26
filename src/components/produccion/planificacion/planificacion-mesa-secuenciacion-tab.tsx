"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  type Modifier,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { addDays, format, isSameWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FlaskConical,
  Loader2,
  Printer,
  RefreshCcw,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  PlanificacionIaProgressDialog,
  type PlanificacionIaDialogState,
  type PlanificacionIaMode,
} from "@/components/produccion/planificacion/mesa/planificacion-ia-progress-dialog";
import {
  PublicandoOverlay,
} from "@/components/produccion/planificacion/mesa/publicando-overlay";
import {
  SidebarPool,
} from "@/components/produccion/planificacion/mesa/sidebar-pool";
import {
  POOL_CONTAINER_ID,
  TurnoColumn,
} from "@/components/produccion/planificacion/mesa/turno-column";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildCapacityMap,
  buildMesaFromPool,
  cardHeightPx,
  DEFAULT_PLANIFICACION_IA_SETTINGS,
  deserializeDraft,
  flattenBoard,
  getDraftStorageKey,
  getVisibleSlotKeys,
  getWeekDays,
  getWeekMonday,
  recomputeSlotOrden,
  serializeDraft,
  slotKey,
  toDayKey,
} from "@/lib/planificacion-mesa";
import { reorderBoardWithIaRules } from "@/lib/planificacion-ia-reorder";
import { mapRowsToIaSettings } from "@/lib/planificacion-ia-settings";
import {
  validateAndApplyIaProposal,
  type PlanificacionIaProposalItem,
} from "@/lib/planificacion-ia-validate";
import { useHubStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type {
  CapacidadTurno,
  DayKey,
  DraftBoardState,
  MaterialStatus,
  MesaTrabajo,
  PlanificacionIaSettings,
  PlanificacionIaScope,
  PoolOT,
  SlotKey,
  TroquelStatus,
  TurnoKey,
} from "@/types/planificacion-mesa";

// ---------------------------------------------------------------------------
// Constantes BD (mismas que el resto del módulo de Producción).
// ---------------------------------------------------------------------------
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_OTS_GENERAL = "prod_ots_general";
const TABLE_POOL = "prod_planificacion_pool";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_CAPACIDAD = "prod_mesa_capacidad_turnos";
const TABLE_MAQUINAS = "prod_maquinas";
const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_SYS_PARAMETROS = "sys_parametros";

// Estados visibles en la Mesa. `finalizada` queda como trazabilidad operativa.
const ACTIVE_MESA_ESTADOS = [
  "borrador",
  "confirmado",
  "en_ejecucion",
  "finalizada",
] as const;
const EDITABLE_PLAN_ESTADOS = ["borrador", "confirmado"] as const;

// ---------------------------------------------------------------------------
// Helpers locales
// ---------------------------------------------------------------------------
function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const c = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      error?: unknown;
      code?: unknown;
      description?: unknown;
      statusText?: unknown;
    };
    const m =
      (typeof c.message === "string" && c.message.trim()) ||
      (typeof c.details === "string" && c.details.trim()) ||
      (typeof c.hint === "string" && c.hint.trim()) ||
      (typeof c.error === "string" && c.error.trim()) ||
      (typeof c.description === "string" && c.description.trim()) ||
      (typeof c.code === "string" && c.code.trim()) ||
      (typeof c.statusText === "string" && c.statusText.trim()) ||
      "";
    if (m) return m;
    try {
      const raw = JSON.stringify(error);
      if (raw && raw !== "{}") return raw;
    } catch {
      // ignore
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

function toDebugError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { raw: String(error ?? "") };
  }
  const obj = error as Record<string, unknown>;
  return {
    message: obj.message,
    details: obj.details,
    hint: obj.hint,
    code: obj.code,
    error: obj.error,
    description: obj.description,
    status: obj.status,
    statusText: obj.statusText,
    raw: (() => {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    })(),
  };
}

function troquelStatusToDb(value: TroquelStatus): string {
  // La BD histórica usa `desconocido`; el frontend usa `sin_informar`.
  if (value === "sin_informar") return "desconocido";
  return value;
}

function boardHasItems(bySlot: Record<SlotKey, MesaTrabajo[]>): boolean {
  return Object.values(bySlot).some((items) => items.length > 0);
}

function isMesaTrabajoLocked(it: MesaTrabajo): boolean {
  return it.estadoMesa === "en_ejecucion" || it.estadoMesa === "finalizada";
}

function waitForUi(ms = 120): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildIaInsights(bySlot: Record<SlotKey, MesaTrabajo[]>): string[] {
  const all = Object.values(bySlot).flat();
  const total = all.length;
  const locked = all.filter((it) => it.estadoMesa === "en_ejecucion").length;
  const barnices = new Set(
    all
      .map((it) => (it.barnizSnapshot || it.acabadoPralSnapshot || "").trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const papeles = new Set(all.map((it) => (it.papelSnapshot || "").trim().toLowerCase()).filter(Boolean)).size;
  const tintas = new Set(all.map((it) => (it.tintasSnapshot || "").trim().toLowerCase()).filter(Boolean)).size;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const urgent = all.filter((it) => {
    if (!it.fechaEntrega) return false;
    const d = new Date(`${it.fechaEntrega}T00:00:00`);
    return Number.isFinite(d.getTime()) && d <= tomorrow;
  }).length;
  return [
    `OTs analizadas: ${total}`,
    `OTs en ejecución bloqueadas: ${locked}`,
    `Acabados/Barnices detectados: ${barnices}`,
    `Papeles/formatos detectados: ${papeles}`,
    `Esquemas de tintas detectados: ${tintas}`,
    `OTs críticas (hoy/mañana): ${urgent}`,
  ];
}

type TipoMaquina = "impresion" | "troquelado" | "engomado";
type MaquinaOption = {
  id: string;
  codigo: string;
  nombre: string;
  tipo_maquina: TipoMaquina;
  activa: boolean;
  orden_visual: number;
  capacidad_horas_default_manana: number;
  capacidad_horas_default_tarde: number;
};

const IMPRESION_SCOPE: TipoMaquina = "impresion";
const DRAFT_SCOPE = "impresion" as const;

const dragOverlayPointerFix: Modifier = ({ transform }) => ({
  ...transform,
  x: transform.x + 8,
  y: transform.y - 22,
});

/**
 * Mapea un sortable id (mesa::X / pool::Y / slot::day::turno) a su contenedor
 * lógico (POOL_CONTAINER_ID o `slot::day::turno`).
 */
function findContainerOf(
  id: string,
  bySlot: Record<SlotKey, MesaTrabajo[]>,
  visibleSlotKeys: SlotKey[],
  poolOts: Set<string>,
): string | null {
  // Es un container directo
  if (id === POOL_CONTAINER_ID) return POOL_CONTAINER_ID;
  if (id.startsWith("slot::")) return id;

  // Es un item: busca su container
  if (id.startsWith("pool::")) {
    const ot = id.slice("pool::".length);
    return poolOts.has(ot) ? POOL_CONTAINER_ID : null;
  }
  if (id.startsWith("mesa::")) {
    const itemId = id.slice("mesa::".length);
    for (const sk of visibleSlotKeys) {
      const list = bySlot[sk] ?? [];
      if (list.some((x) => x.id === itemId)) return `slot::${sk}`;
    }
  }
  return null;
}

function containerToSlotKey(containerId: string): SlotKey | null {
  if (!containerId.startsWith("slot::")) return null;
  return containerId.slice("slot::".length);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export function PlanificacionMesaSecuenciacionTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const globalModel = useHubStore((s) => s.globalModel);

  // ---- Identidad
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(
        typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null,
      );
      setUserEmail(
        typeof user?.email === "string" && user.email.trim()
          ? user.email.trim()
          : null,
      );
    })().catch(() => {
      if (mounted) {
        setUserId(null);
        setUserEmail(null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // ---- Semana visible y toggles
  const [weekMonday, setWeekMonday] = useState<Date>(() =>
    getWeekMonday(new Date()),
  );
  const [showSaturday, setShowSaturday] = useState(false);
  const [maquinas, setMaquinas] = useState<MaquinaOption[]>([]);
  const [selectedMaquinaId, setSelectedMaquinaId] = useState<string | null>(null);

  const weekDays = useMemo(
    () => getWeekDays(weekMonday, showSaturday),
    [weekMonday, showSaturday],
  );
  const weekStartKey = useMemo(() => toDayKey(weekMonday), [weekMonday]);
  const weekEndKey = useMemo(
    () => toDayKey(addDays(weekMonday, showSaturday ? 5 : 4)),
    [weekMonday, showSaturday],
  );
  const visibleSlotKeys = useMemo(
    () => getVisibleSlotKeys(weekDays),
    [weekDays],
  );
  const isCurrentWeek = useMemo(
    () => isSameWeek(weekMonday, new Date(), { weekStartsOn: 1 }),
    [weekMonday],
  );

  // ---- Datos
  const [pool, setPool] = useState<PoolOT[]>([]);
  const [mesaItems, setMesaItems] = useState<MesaTrabajo[]>([]);
  const [capacidades, setCapacidades] = useState<CapacidadTurno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Simulación
  const [simulationOn, setSimulationOn] = useState(false);
  const [draftBySlot, setDraftBySlot] = useState<Record<
    SlotKey,
    MesaTrabajo[]
  > | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [iaSettings, setIaSettings] = useState<PlanificacionIaSettings>(
    DEFAULT_PLANIFICACION_IA_SETTINGS,
  );
  const [iaScope, setIaScope] = useState<PlanificacionIaScope>("turno");
  const [iaOrdering, setIaOrdering] = useState(false);
  const [iaResult, setIaResult] = useState<{
    movedCount: number;
    reasons: string[];
    warnings: string[];
    mode: "rules" | "advanced" | "mixed";
    scope: PlanificacionIaScope;
    modelUsed?: string;
    didFallback?: boolean;
  } | null>(null);
  const [iaDialog, setIaDialog] = useState<PlanificacionIaDialogState>({
    open: false,
    status: "idle",
    mode: "rules",
    scope: "turno",
    stepIndex: 0,
    movedCount: null,
    reasons: [],
    warnings: [],
    error: null,
    insights: [],
  });

  // ---- DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * Snapshot del draft al iniciar un drag (solo modo Simulación). Se usa para
   * revertir cambios visuales aplicados en `onDragOver` cuando el usuario
   * suelta fuera de cualquier zona droppable.
   */
  const [dragStartDraftSnapshot, setDragStartDraftSnapshot] = useState<
    Record<SlotKey, MesaTrabajo[]> | null
  >(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ---- Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // ---- Edición de capacidad
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [capDialogDay, setCapDialogDay] = useState<DayKey | null>(null);
  const [capDialogTurno, setCapDialogTurno] = useState<TurnoKey | null>(null);
  const [savingCap, setSavingCap] = useState(false);

  // ---- Saving / publishing
  const [savingChanges, setSavingChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [startingExecutionId, setStartingExecutionId] = useState<string | null>(null);

  // ---- Búsqueda en el sidebar (controlada desde el tab para preservarla
  // entre re-renders y cambios de semana).
  const [poolSearch, setPoolSearch] = useState("");

  const machineUiStorageKey = useMemo(
    () => `minerva_plan_machine_ui_${userId ?? "anon"}`,
    [userId],
  );

  // ===== CARGA DE DATOS =====================================================

  const loadCapacidades = useCallback(async () => {
    let query = supabase
      .from(TABLE_CAPACIDAD)
      .select("fecha, turno, capacidad_horas, motivo_ajuste, maquina_id")
      .gte("fecha", weekStartKey)
      .lte("fecha", weekEndKey);
    if (selectedMaquinaId) {
      query = query.eq("maquina_id", selectedMaquinaId);
    }
    const { data, error: capErr } = await query;
    if (capErr) throw capErr;
    const rows = (data ?? []) as Array<{
      fecha: string;
      turno: string;
      capacidad_horas: number | string | null;
      motivo_ajuste: string | null;
      maquina_id: string | null;
    }>;
    const out: CapacidadTurno[] = [];
    for (const r of rows) {
      const turno = r.turno === "manana" || r.turno === "tarde" ? r.turno : null;
      if (!turno) continue;
      out.push({
        fecha: String(r.fecha),
        turno,
        capacidadHoras: parseNum(r.capacidad_horas),
        motivoAjuste: r.motivo_ajuste ?? null,
      });
    }
    return out;
  }, [supabase, weekStartKey, weekEndKey, selectedMaquinaId]);

  const loadMesa = useCallback(async () => {
    let query = supabase
      .from(TABLE_MESA)
      .select(
        "id, maquina_id, ot_numero, fecha_planificada, turno, slot_orden, estado_mesa, fecha_entrega_snapshot, material_status, troquel_status, acabado_pral_snapshot, cliente_snapshot, papel_snapshot, tintas_snapshot, barniz_snapshot, num_hojas_brutas_snapshot, horas_planificadas_snapshot",
      )
      .gte("fecha_planificada", weekStartKey)
      .lte("fecha_planificada", weekEndKey)
      .in("estado_mesa", ACTIVE_MESA_ESTADOS as unknown as string[]);
    if (selectedMaquinaId) {
      query = query.or(`maquina_id.eq.${selectedMaquinaId},maquina_id.is.null`);
    }
    const { data, error: mesaErr } = await query;
    if (mesaErr) throw mesaErr;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const out: MesaTrabajo[] = [];
    for (const r of rows) {
      const turnoRaw = String(r.turno ?? "").trim();
      const turno: TurnoKey =
        turnoRaw === "manana" || turnoRaw === "tarde" ? turnoRaw : "manana";
      const matRaw = String(r.material_status ?? "").trim().toLowerCase();
      const matStatus: MaterialStatus =
        matRaw === "verde" || matRaw === "amarillo" || matRaw === "rojo"
          ? (matRaw as MaterialStatus)
          : "rojo";
      const troqRaw = String(r.troquel_status ?? "").trim().toLowerCase();
      const troqStatus: TroquelStatus =
        troqRaw === "ok" ||
        troqRaw === "falta" ||
        troqRaw === "no_aplica" ||
        troqRaw === "sin_informar"
          ? (troqRaw as TroquelStatus)
          : "sin_informar";

      out.push({
        id: String(r.id),
        maquinaId:
          (r.maquina_id as string | null) ?? selectedMaquinaId ?? null,
        ot: String(r.ot_numero ?? "").trim(),
        fechaPlanificada: String(r.fecha_planificada ?? ""),
        turno,
        slotOrden: Math.trunc(parseNum(r.slot_orden)),
        estadoMesa: String(r.estado_mesa ?? "borrador"),
        fechaEntrega: (r.fecha_entrega_snapshot as string | null) ?? null,
        materialStatus: matStatus,
        troquelStatus: troqStatus,
        acabadoPralSnapshot: String(r.acabado_pral_snapshot ?? ""),
        clienteSnapshot: String(r.cliente_snapshot ?? ""),
        papelSnapshot: String(r.papel_snapshot ?? ""),
        tintasSnapshot: String(r.tintas_snapshot ?? ""),
        barnizSnapshot: (r.barniz_snapshot as string | null) ?? null,
        numHojasBrutasSnapshot: Math.trunc(parseNum(r.num_hojas_brutas_snapshot)),
        horasPlanificadasSnapshot: parseNum(r.horas_planificadas_snapshot),
      });
    }
    return out;
  }, [supabase, weekStartKey, weekEndKey, selectedMaquinaId]);

  const loadPool = useCallback(async () => {
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
    const otsList = rows.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean);
    if (otsList.length === 0) return [] as PoolOT[];

    // Datos técnicos (despachadas) para tarjetas: agregamos por OT.
    const { data: despData, error: despErr } = await supabase
      .from(TABLE_DESPACHADAS)
      .select(
        "ot_numero, tintas, material, num_hojas_brutas, horas_entrada, horas_tiraje, acabado_pral",
      )
      .in("ot_numero", otsList);
    if (despErr) throw despErr;

    const despAgg = new Map<
      string,
      {
        tintas: string;
        material: string;
        numHojas: number;
        horas: number;
        acabadoPral: string;
      }
    >();
    for (const d of (despData ?? []) as Array<Record<string, unknown>>) {
      const ot = String(d.ot_numero ?? "").trim();
      if (!ot) continue;
      const horas = parseNum(d.horas_entrada) + parseNum(d.horas_tiraje);
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

    // Datos comerciales (cliente, fecha entrega, etc.)
    const { data: otsData, error: otsErr } = await supabase
      .from(TABLE_OTS_GENERAL)
      .select("num_pedido, cliente, fecha_entrega, titulo")
      .in("num_pedido", otsList);
    if (otsErr) throw otsErr;
    const otsByNum = new Map<
      string,
      { cliente: string; fechaEntrega: string | null; trabajo: string }
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
      });
    }

    const out: PoolOT[] = [];
    for (const r of rows) {
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
      };
      const matRaw = String(r.material_status ?? "")
        .trim()
        .toLowerCase();
      const matStatus: MaterialStatus =
        matRaw === "verde" || matRaw === "amarillo" || matRaw === "rojo"
          ? (matRaw as MaterialStatus)
          : "rojo";
      const troqRaw = String(r.troquel_status ?? "")
        .trim()
        .toLowerCase();
      const troqStatus: TroquelStatus =
        troqRaw === "ok" ||
        troqRaw === "falta" ||
        troqRaw === "no_aplica" ||
        troqRaw === "sin_informar"
          ? (troqRaw as TroquelStatus)
          : "sin_informar";
      out.push({
        ot,
        poolId: String(r.id ?? "") || null,
        cliente: meta.cliente,
        trabajo: meta.trabajo,
        papel: desp.material || "",
        tintas: desp.tintas || "—",
        acabadoPral:
          (r.acabado_pral_snapshot ?? "").toString().trim() || desp.acabadoPral,
        barniz: null,
        fechaEntrega: r.fecha_entrega_snapshot ?? meta.fechaEntrega,
        numHojasBrutas: desp.numHojas,
        horasPlanificadas: desp.horas,
        materialStatus: matStatus,
        troquelStatus: troqStatus,
      });
    }
    return out;
  }, [supabase]);

  const loadMaquinas = useCallback(async () => {
    const { data, error: mqErr } = await supabase
      .from(TABLE_MAQUINAS)
      .select(
        "id, codigo, nombre, tipo_maquina, activa, orden_visual, capacidad_horas_default_manana, capacidad_horas_default_tarde",
      )
      .eq("tipo_maquina", IMPRESION_SCOPE)
      .eq("activa", true)
      .order("orden_visual")
      .order("nombre");
    if (mqErr) throw mqErr;
    return ((data ?? []) as MaquinaOption[]).filter(
      (m) => m.tipo_maquina === IMPRESION_SCOPE,
    );
  }, [supabase]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [maqList, poolList, mesaList, capList] = await Promise.all([
        loadMaquinas(),
        loadPool(),
        loadMesa(),
        loadCapacidades(),
      ]);
      setMaquinas(maqList);
      setPool(poolList);
      setMesaItems(mesaList);
      setCapacidades(capList);
    } catch (e) {
      const msg = getErrorMessage(e, "No se pudo cargar la mesa.");
      console.error("[Mesa] reload error", { error: e, msg });
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [loadMaquinas, loadPool, loadMesa, loadCapacidades]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from(TABLE_SYS_PARAMETROS)
        .select("clave, valor_num, valor_text")
        .eq("seccion", "planificacion_ia");
      if (cancelled || error) return;
      setIaSettings(
        mapRowsToIaSettings(
          (data ?? []) as Array<{
            clave: string;
            valor_num: number | string | null;
            valor_text: string | null;
          }>,
        ),
      );
    })().catch(() => {
      // Mantener defaults si falla la carga de parámetros.
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(machineUiStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { maquinaId?: string | null };
      if (typeof parsed.maquinaId === "string" && parsed.maquinaId.trim()) {
        setSelectedMaquinaId(parsed.maquinaId);
      }
    } catch {
      // ignore
    }
  }, [machineUiStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        machineUiStorageKey,
        JSON.stringify({
          maquinaId: selectedMaquinaId,
        }),
      );
    } catch {
      // ignore
    }
  }, [machineUiStorageKey, selectedMaquinaId]);

  // ===== MAPS DERIVADOS =====================================================

  const capacityBySlot = useMemo(
    () => buildCapacityMap(capacidades),
    [capacidades],
  );

  const maquinasPorTipo = useMemo(
    () => maquinas,
    [maquinas],
  );

  const maquinaSeleccionada = useMemo(
    () => maquinas.find((m) => m.id === selectedMaquinaId) ?? null,
    [maquinas, selectedMaquinaId],
  );

  useEffect(() => {
    if (maquinas.length === 0) return;
    const exists = selectedMaquinaId
      ? maquinas.some((m) => m.id === selectedMaquinaId)
      : false;
    if (exists) return;
    const fallback = maquinas[0] ?? null;
    if (fallback) {
      setSelectedMaquinaId(fallback.id);
    }
  }, [maquinas, selectedMaquinaId]);

  const hasImpresionMachine = maquinas.length > 0 && !!selectedMaquinaId;

  /** Mesa real agrupada por slotKey y ordenada por slot_orden. */
  const realBySlot = useMemo(() => {
    const out: Record<SlotKey, MesaTrabajo[]> = {};
    for (const sk of visibleSlotKeys) out[sk] = [];
    for (const it of mesaItems) {
      const sk = slotKey(it.fechaPlanificada, it.turno);
      if (!out[sk]) out[sk] = [];
      out[sk].push(it);
    }
    for (const sk of Object.keys(out)) {
      out[sk]!.sort((a, b) => a.slotOrden - b.slotOrden);
    }
    return out;
  }, [mesaItems, visibleSlotKeys]);

  const planStatus = useMemo<"vacio" | "borrador" | "confirmado" | "en_ejecucion" | "finalizada">(() => {
    if (mesaItems.some((it) => it.estadoMesa === "en_ejecucion")) return "en_ejecucion";
    if (mesaItems.some((it) => it.estadoMesa === "borrador")) return "borrador";
    if (mesaItems.some((it) => it.estadoMesa === "confirmado")) return "confirmado";
    if (mesaItems.some((it) => it.estadoMesa === "finalizada")) return "finalizada";
    return "vacio";
  }, [mesaItems]);

  const realBoardHasItems = useMemo(() => boardHasItems(realBySlot), [realBySlot]);

  const simulationBaseBySlot = useMemo(() => {
    const hasConfirmedPlan = mesaItems.some(
      (it) =>
        it.estadoMesa === "confirmado" ||
        it.estadoMesa === "en_ejecucion" ||
        it.estadoMesa === "finalizada",
    );
    if (!hasConfirmedPlan) return realBySlot;

    const out: Record<SlotKey, MesaTrabajo[]> = {};
    for (const sk of visibleSlotKeys) out[sk] = [];
    for (const it of mesaItems) {
      if (
        it.estadoMesa !== "confirmado" &&
        it.estadoMesa !== "en_ejecucion" &&
        it.estadoMesa !== "finalizada"
      ) {
        continue;
      }
      const sk = slotKey(it.fechaPlanificada, it.turno);
      if (!out[sk]) out[sk] = [];
      out[sk].push(it);
    }
    for (const sk of Object.keys(out)) {
      out[sk] = recomputeSlotOrden(
        [...(out[sk] ?? [])].sort((a, b) => a.slotOrden - b.slotOrden),
      );
    }
    return out;
  }, [mesaItems, realBySlot, visibleSlotKeys]);

  /** bySlot efectivo: draft si simulación ON con draft, si no, real. */
  const effectiveBySlot = useMemo<Record<SlotKey, MesaTrabajo[]>>(() => {
    if (simulationOn && draftBySlot) return draftBySlot;
    return realBySlot;
  }, [simulationOn, draftBySlot, realBySlot]);

  const otsEnMesa = useMemo(() => {
    const set = new Set<string>();
    for (const sk of Object.keys(effectiveBySlot)) {
      for (const t of effectiveBySlot[sk] ?? []) set.add(t.ot);
    }
    return set;
  }, [effectiveBySlot]);

  const poolOtsSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of pool) {
      if (!otsEnMesa.has(p.ot)) s.add(p.ot);
    }
    return s;
  }, [pool, otsEnMesa]);

  const poolByOt = useMemo(() => {
    const m = new Map<string, PoolOT>();
    for (const p of pool) m.set(p.ot, p);
    return m;
  }, [pool]);

  const trabajoByOt = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of pool) {
      const t = (p.trabajo ?? "").trim();
      if (t) out[p.ot] = t;
    }
    return out;
  }, [pool]);

  // ===== SIMULACIÓN: DRAFT EN LOCALSTORAGE ==================================

  const draftKey = useMemo(() => getDraftStorageKey(userId), [userId]);

  // Hidratar draft desde localStorage al activar simulación o al cambiar semana
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDraftHydrated(false);
    if (!simulationOn) {
      setDraftBySlot(null);
      setDraftUpdatedAt(null);
      setDraftHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = deserializeDraft(raw);
        if (
          parsed &&
          parsed.weekMondayKey === weekStartKey &&
          parsed.maquinaId === selectedMaquinaId &&
          parsed.scope === DRAFT_SCOPE &&
          (!realBoardHasItems || boardHasItems(parsed.bySlot))
        ) {
          setDraftBySlot(parsed.bySlot);
          setDraftUpdatedAt(parsed.updatedAt);
          setDraftHydrated(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    // Inicializar el draft con el plan vigente: confirmado si existe; si no, borrador.
    setDraftBySlot(simulationBaseBySlot);
    setDraftUpdatedAt(new Date().toISOString());
    setDraftHydrated(true);
  }, [
    simulationOn,
    draftKey,
    weekStartKey,
    selectedMaquinaId,
    simulationBaseBySlot,
    realBoardHasItems,
  ]);

  // Persistir draft a localStorage (debounced)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!simulationOn || !draftBySlot || !draftHydrated) return;
    const t = window.setTimeout(() => {
      try {
        const updatedAt = new Date().toISOString();
        const payload: DraftBoardState = {
          weekMondayKey: weekStartKey,
          maquinaId: selectedMaquinaId ?? "",
          scope: DRAFT_SCOPE,
          bySlot: draftBySlot,
          updatedAt,
        };
        setDraftUpdatedAt(updatedAt);
        window.localStorage.setItem(draftKey, serializeDraft(payload));
      } catch {
        // ignore
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    simulationOn,
    draftBySlot,
    draftHydrated,
    draftKey,
    weekStartKey,
    selectedMaquinaId,
  ]);

  const clearDraft = useCallback(() => {
    setDraftBySlot(null);
    setDraftUpdatedAt(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  }, [draftKey]);

  // ===== ACCIONES BD (modo Real) ============================================

  /** Persiste en BD el estado completo de un slot (delete + insert). */
  const persistRealSlot = useCallback(
    async (sk: SlotKey, items: MesaTrabajo[]) => {
      if (!selectedMaquinaId) {
        throw new Error("Selecciona una máquina para guardar la planificación.");
      }
      const parsed = sk.split("::");
      const fecha = parsed[0];
      const turno = parsed[1] as TurnoKey;
      if (!fecha || (turno !== "manana" && turno !== "tarde")) return;

      // Delete existentes del slot
      const { error: delErr } = await supabase
        .from(TABLE_MESA)
        .delete()
        .eq("fecha_planificada", fecha)
        .eq("turno", turno)
        .eq("maquina_id", selectedMaquinaId)
        .in("estado_mesa", EDITABLE_PLAN_ESTADOS as unknown as string[]);
      if (delErr) throw delErr;

      const editableItems = items.filter((it) => !isMesaTrabajoLocked(it));
      if (editableItems.length === 0) return;

      const fullInserts = editableItems.map((it) => ({
        ot_numero: it.ot,
        fecha_planificada: fecha,
        turno,
        maquina_id: selectedMaquinaId,
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

      // Fallback temporal para entornos donde aún no existen campos snapshot.
      if (!isMissingColumnError(insErrFull)) throw insErrFull;
      const legacyInserts = editableItems.map((it) => ({
        ot_numero: it.ot,
        fecha_planificada: fecha,
        turno,
        maquina_id: selectedMaquinaId,
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
    [supabase, userId, userEmail, selectedMaquinaId],
  );

  /** Persiste todo el tablero (modo Real, slot a slot) — usado tras DnD. */
  const persistRealAffectedSlots = useCallback(
    async (
      newBySlot: Record<SlotKey, MesaTrabajo[]>,
      affected: Set<SlotKey>,
    ) => {
      setSavingChanges(true);
      try {
        for (const sk of affected) {
          await persistRealSlot(sk, newBySlot[sk] ?? []);
        }
      } catch (e) {
        const msg = getErrorMessage(e, "No se pudo guardar el cambio.");
        console.error("[Mesa] persistRealAffectedSlots", {
          msg,
          error: toDebugError(e),
          affectedSlots: [...affected],
        });
        toast.error(msg);
        await reload();
      } finally {
        setSavingChanges(false);
      }
    },
    [persistRealSlot, reload],
  );

  const confirmPlanificacion = useCallback(async () => {
    if (!selectedMaquinaId) {
      toast.error("Selecciona una máquina para confirmar la planificación.");
      return;
    }
    if (!realBoardHasItems) {
      toast.error("No hay trabajos en la semana actual para confirmar.");
      return;
    }
    setSavingChanges(true);
    try {
      const { error: updErr } = await supabase
        .from(TABLE_MESA)
        .update({
          estado_mesa: "confirmado",
        })
        .gte("fecha_planificada", weekStartKey)
        .lte("fecha_planificada", weekEndKey)
        .eq("maquina_id", selectedMaquinaId)
        .eq("estado_mesa", "borrador");
      if (updErr) throw updErr;
      toast.success("Planificación confirmada.");
      await reload();
    } catch (e) {
      const msg = getErrorMessage(e, "No se pudo confirmar la planificación.");
      console.error("[Mesa] confirmPlanificacion", {
        msg,
        error: toDebugError(e),
      });
      toast.error(msg);
    } finally {
      setSavingChanges(false);
    }
  }, [
    selectedMaquinaId,
    realBoardHasItems,
    supabase,
    weekStartKey,
    weekEndKey,
    reload,
  ]);

  const startExecution = useCallback(
    async (trabajo: MesaTrabajo) => {
      if (!selectedMaquinaId) {
        toast.error("Selecciona una máquina para iniciar la OT.");
        return;
      }
      if (trabajo.estadoMesa !== "confirmado") {
        toast.error("Solo se pueden iniciar OTs confirmadas.");
        return;
      }
      setStartingExecutionId(trabajo.id);
      try {
        const { error: insErr } = await supabase.from(TABLE_EJECUCIONES).insert({
          mesa_trabajo_id: trabajo.id,
          ot_numero: trabajo.ot,
          maquina_id: selectedMaquinaId,
          fecha_planificada: trabajo.fechaPlanificada,
          turno: trabajo.turno,
          slot_orden: trabajo.slotOrden,
          inicio_real_at: new Date().toISOString(),
          estado_ejecucion: "en_curso",
          horas_planificadas_snapshot: trabajo.horasPlanificadasSnapshot,
          created_by: userId,
          created_by_email: userEmail,
        });
        if (insErr) throw insErr;

        const { error: updErr } = await supabase
          .from(TABLE_MESA)
          .update({ estado_mesa: "en_ejecucion" })
          .eq("id", trabajo.id);
        if (updErr) throw updErr;

        toast.success(`OT ${trabajo.ot} iniciada.`);
        await reload();
      } catch (e) {
        const msg = getErrorMessage(e, "No se pudo iniciar la OT.");
        console.error("[Mesa] startExecution", { msg, error: toDebugError(e), trabajo });
        toast.error(msg);
        await reload();
      } finally {
        setStartingExecutionId(null);
      }
    },
    [selectedMaquinaId, supabase, userId, userEmail, reload],
  );

  // ===== DnD ================================================================

  /** Aplica una transición de estado y devuelve los slots afectados. */
  type Transition = {
    next: Record<SlotKey, MesaTrabajo[]>;
    affected: Set<SlotKey>;
  };

  const applyTransition = useCallback(
    (
      activeContainer: string,
      activeId: string,
      overContainer: string,
      overId: string | null,
      currentBySlot: Record<SlotKey, MesaTrabajo[]>,
    ): Transition | null => {
      const affected = new Set<SlotKey>();
      const next: Record<SlotKey, MesaTrabajo[]> = {};
      for (const k of Object.keys(currentBySlot)) {
        next[k] = [...(currentBySlot[k] ?? [])];
      }
      for (const sk of visibleSlotKeys) if (!next[sk]) next[sk] = [];

      // CASE A: del Pool a un slot
      if (
        activeContainer === POOL_CONTAINER_ID &&
        overContainer.startsWith("slot::")
      ) {
        const sk = containerToSlotKey(overContainer);
        if (!sk) return null;
        const ot = activeId.startsWith("pool::")
          ? activeId.slice("pool::".length)
          : "";
        const poolItem = poolByOt.get(ot);
        if (!poolItem) return null;
        if (otsEnMesa.has(ot)) return null;

        const parsed = sk.split("::");
        const fecha = parsed[0];
        const turno = parsed[1] as TurnoKey;
        if (!fecha || (turno !== "manana" && turno !== "tarde")) return null;

        const targetList = next[sk] ?? [];
        const newItem: MesaTrabajo = {
          id: `tmp-${ot}-${Date.now()}`,
          ...buildMesaFromPool(
            poolItem,
            fecha,
            turno,
            targetList.length + 1,
            selectedMaquinaId,
          ),
        };
        // Posición de inserción: si over es un item, antes de él; si no, al final.
        let insertAt = targetList.length;
        if (overId && overId.startsWith("mesa::")) {
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

      // CASE B: de un slot al Pool (devolver al pool)
      if (
        activeContainer.startsWith("slot::") &&
        overContainer === POOL_CONTAINER_ID
      ) {
        const sk = containerToSlotKey(activeContainer);
        if (!sk) return null;
        const itemId = activeId.startsWith("mesa::")
          ? activeId.slice("mesa::".length)
          : "";
        const list = next[sk] ?? [];
        const idx = list.findIndex((x) => x.id === itemId);
        if (idx < 0) return null;
        if (list[idx] && isMesaTrabajoLocked(list[idx]!)) return null;
        list.splice(idx, 1);
        next[sk] = recomputeSlotOrden(list);
        affected.add(sk);
        return { next, affected };
      }

      // CASE C: entre slots (incluye reorder dentro de un slot)
      if (
        activeContainer.startsWith("slot::") &&
        overContainer.startsWith("slot::")
      ) {
        const fromSk = containerToSlotKey(activeContainer);
        const toSk = containerToSlotKey(overContainer);
        if (!fromSk || !toSk) return null;
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
            if (overIdx < 0 || overIdx === fromIdx) {
              return { next, affected };
            }
            const newList = arrayMove(fromList, fromIdx, overIdx);
            next[fromSk] = recomputeSlotOrden(newList);
            affected.add(fromSk);
            return { next, affected };
          }
          // sin overId concreto: nada que hacer
          return { next, affected };
        }

        // Cross-slot move
        fromList.splice(fromIdx, 1);
        next[fromSk] = recomputeSlotOrden(fromList);
        affected.add(fromSk);

        const parsed = toSk.split("::");
        const turno = parsed[1] as TurnoKey;
        const fecha = parsed[0] ?? "";
        const updatedMoving: MesaTrabajo = {
          ...moving,
          fechaPlanificada: fecha,
          turno,
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
        next[toSk] = recomputeSlotOrden(newList);
        affected.add(toSk);
        return { next, affected };
      }

      return null;
    },
    [visibleSlotKeys, poolByOt, otsEnMesa, selectedMaquinaId],
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!hasImpresionMachine) return;
      setActiveId(String(event.active.id));
      if (simulationOn) {
        setDragStartDraftSnapshot(draftBySlot ?? realBySlot);
      } else {
        setDragStartDraftSnapshot(null);
      }
    },
    [hasImpresionMachine, simulationOn, draftBySlot, realBySlot],
  );

  /**
   * onDragOver: en el modo simulación movemos visualmente entre containers en
   * tiempo real. En modo real lo dejamos en onDragEnd (más simple y robusto).
   */
  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!hasImpresionMachine) return;
      if (!simulationOn) return; // En modo Real, esperamos al drop

      const { active, over } = event;
      if (!over) return;
      const aId = String(active.id);
      // Para arrastres desde Pool evitamos pre-aplicar en onDragOver:
      // así no queda anclada en el primer slot tocado (p.ej. lunes mañana).
      // El destino final se resuelve en onDragEnd.
      if (aId.startsWith("pool::")) return;
      const oId = String(over.id);
      if (aId === oId) return;

      const current = draftBySlot ?? realBySlot;
      const fromContainer = aId.startsWith("pool::")
        ? POOL_CONTAINER_ID
        : findContainerOf(
            aId,
            current,
            visibleSlotKeys,
            poolOtsSet,
          );
      const toContainer = findContainerOf(
        oId,
        current,
        visibleSlotKeys,
        poolOtsSet,
      );
      if (!fromContainer || !toContainer) return;
      if (fromContainer === toContainer) return; // reorder se hace en end

      const t = applyTransition(
        fromContainer,
        aId,
        toContainer,
        oId.startsWith("slot::") || oId === POOL_CONTAINER_ID ? null : oId,
        current,
      );
      if (!t) return;
      setDraftBySlot(t.next);
    },
    [
      hasImpresionMachine,
      simulationOn,
      draftBySlot,
      realBySlot,
      visibleSlotKeys,
      poolOtsSet,
      applyTransition,
    ],
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!hasImpresionMachine) return;
      const { active, over } = event;
      setActiveId(null);
      const isPoolDrag = String(active.id).startsWith("pool::");
      const poolOt = isPoolDrag ? String(active.id).slice("pool::".length) : "";
      const boardHasOt = (bySlot: Record<SlotKey, MesaTrabajo[]>, ot: string): boolean =>
        Object.values(bySlot).some((items) => items.some((it) => it.ot === ot));

      if (!over) {
        // Si en simulación habíamos pre-aplicado un cross-container move en
        // `onDragOver`, revertimos al snapshot inicial.
        if (
          simulationOn &&
          isPoolDrag &&
          poolOt &&
          draftBySlot &&
          boardHasOt(draftBySlot, poolOt)
        ) {
          setDragStartDraftSnapshot(null);
          return;
        }
        if (simulationOn && dragStartDraftSnapshot) {
          setDraftBySlot(dragStartDraftSnapshot);
        }
        setDragStartDraftSnapshot(null);
        return;
      }
      const aId = String(active.id);
      const oId = String(over.id);

      const current = simulationOn
        ? (draftBySlot ?? realBySlot)
        : realBySlot;
      const fromContainer = aId.startsWith("pool::")
        ? POOL_CONTAINER_ID
        : findContainerOf(
            aId,
            current,
            visibleSlotKeys,
            poolOtsSet,
          );
      const toContainer = findContainerOf(
        oId,
        current,
        visibleSlotKeys,
        poolOtsSet,
      );
      if (!fromContainer || !toContainer) {
        if (
          simulationOn &&
          isPoolDrag &&
          poolOt &&
          boardHasOt(current, poolOt)
        ) {
          setDragStartDraftSnapshot(null);
          return;
        }
        return;
      }

      const t = applyTransition(
        fromContainer,
        aId,
        toContainer,
        oId.startsWith("slot::") || oId === POOL_CONTAINER_ID ? null : oId,
        current,
      );
      if (!t) {
        // Sin transición: si hubo pre-aplicación visual en simulación, revertir.
        if (
          simulationOn &&
          isPoolDrag &&
          poolOt &&
          boardHasOt(current, poolOt)
        ) {
          setDragStartDraftSnapshot(null);
          return;
        }
        if (simulationOn && dragStartDraftSnapshot) {
          setDraftBySlot(dragStartDraftSnapshot);
        }
        setDragStartDraftSnapshot(null);
        return;
      }

      if (simulationOn) {
        setDraftBySlot(t.next);
        setDragStartDraftSnapshot(null);
        return;
      }

      // Modo Real: actualiza UI de mesa de inmediato y persiste BD.
      // Aplanamos para reconstruir mesaItems con ids existentes (los nuevos
      // tienen prefijo `tmp-`; tras persist + reload los IDs reales vendrán
      // del select).
      const newMesa = flattenBoard(t.next);
      setMesaItems(newMesa);
      setDragStartDraftSnapshot(null);
      void persistRealAffectedSlots(t.next, t.affected).then(() => {
        void reload();
      });
    },
    [
      hasImpresionMachine,
      simulationOn,
      dragStartDraftSnapshot,
      draftBySlot,
      realBySlot,
      visibleSlotKeys,
      poolOtsSet,
      applyTransition,
      persistRealAffectedSlots,
      reload,
    ],
  );

  // ===== APLICAR SIMULACIÓN (publicar plan) =================================

  const applySimulation = useCallback(async () => {
    if (!draftBySlot) return;
    if (!selectedMaquinaId) {
      toast.error("Selecciona una máquina antes de publicar la simulación.");
      return;
    }
    setPublishing(true);
    try {
      // 1) DELETE del plan editable/oficial en el rango visible.
      const { error: delErr } = await supabase
        .from(TABLE_MESA)
        .delete()
        .gte("fecha_planificada", weekStartKey)
        .lte("fecha_planificada", weekEndKey)
        .eq("maquina_id", selectedMaquinaId)
        .in("estado_mesa", EDITABLE_PLAN_ESTADOS as unknown as string[]);
      if (delErr) throw delErr;

      // 2) INSERT del estado del draft.
      const inserts: Array<Record<string, unknown>> = [];
      for (const sk of visibleSlotKeys) {
        const items = draftBySlot[sk] ?? [];
        const parsed = sk.split("::");
        const fecha = parsed[0];
        const turno = parsed[1] as TurnoKey;
        if (!fecha || (turno !== "manana" && turno !== "tarde")) continue;
        items.forEach((it) => {
          if (isMesaTrabajoLocked(it)) return;
          inserts.push({
            ot_numero: it.ot,
            fecha_planificada: fecha,
            turno,
            maquina_id: selectedMaquinaId,
            slot_orden: it.slotOrden,
            maquina: null,
            estado_mesa: "confirmado",
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
          });
        });
      }
      if (inserts.length > 0) {
        const { error: insErrFull } = await supabase
          .from(TABLE_MESA)
          .insert(inserts);
        if (insErrFull) {
          if (!isMissingColumnError(insErrFull)) throw insErrFull;
          const legacyInserts = inserts.map((row) => ({
            ot_numero: row.ot_numero,
            fecha_planificada: row.fecha_planificada,
            turno: row.turno,
            maquina_id: row.maquina_id,
            slot_orden: row.slot_orden,
            maquina: row.maquina,
            estado_mesa: "confirmado",
            prioridad_snapshot: row.prioridad_snapshot,
            fecha_entrega_snapshot: row.fecha_entrega_snapshot,
            material_status: row.material_status,
            troquel_status: row.troquel_status,
            acabado_pral_snapshot: row.acabado_pral_snapshot,
            created_by: row.created_by,
            created_by_email: row.created_by_email,
          }));
          const { error: insErrLegacy } = await supabase
            .from(TABLE_MESA)
            .insert(legacyInserts);
          if (insErrLegacy) throw insErrLegacy;
        }
      }

      toast.success("Plan publicado correctamente.");
      clearDraft();
      setSimulationOn(false);
      await reload();
    } catch (e) {
      const msg = getErrorMessage(e, "No se pudo publicar el plan.");
      console.error("[Mesa] applySimulation", { error: e, msg });
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }, [
    draftBySlot,
    supabase,
    weekStartKey,
    weekEndKey,
    selectedMaquinaId,
    visibleSlotKeys,
    userId,
    userEmail,
    reload,
    clearDraft,
  ]);

  const orderDraftWithIa = useCallback(async (mode: PlanificacionIaMode) => {
    const base = draftBySlot ?? simulationBaseBySlot;
    const insights = buildIaInsights(base);
    setIaOrdering(true);
    const advance = async (stepIndex: number) => {
      setIaDialog((prev) => ({ ...prev, stepIndex }));
      await waitForUi();
    };
    setIaDialog({
      open: true,
      status: "running",
      mode,
      scope: iaScope,
      stepIndex: 0,
      movedCount: null,
      reasons: [],
      warnings: [],
      error: null,
      insights,
    });
    try {
      await advance(0);
      await advance(1);
      await advance(2);
      await advance(3);
      const ruleResult = reorderBoardWithIaRules(base, iaSettings, iaScope, capacityBySlot);

      if (mode === "rules") {
        await advance(5);
        const validatedRules = validateAndApplyIaProposal({
          currentBySlot: base,
          proposalItems: Object.entries(ruleResult.nextBySlot).flatMap(([slotKey, items]) =>
            items.map((it) => ({
              id: it.id,
              ot: it.ot,
              slotKey: slotKey as SlotKey,
              slotOrden: it.slotOrden,
            })),
          ),
          capacityBySlot,
          scope: iaScope,
        });
        await advance(6);
        setDraftBySlot(validatedRules.nextBySlot);
        setDraftUpdatedAt(new Date().toISOString());
        setIaResult({
          movedCount: validatedRules.movedCount,
          reasons: ruleResult.reasons,
          warnings: [...ruleResult.warnings, ...validatedRules.warnings],
          mode,
          scope: iaScope,
        });
        setIaDialog((prev) => ({
          ...prev,
          status: "success",
          stepIndex: 6,
          movedCount: validatedRules.movedCount,
          reasons: ruleResult.reasons,
          warnings: [...ruleResult.warnings, ...validatedRules.warnings],
          insights: prev.insights,
        }));
        toast.success(`Ordenación por reglas aplicada (${validatedRules.movedCount} movimientos).`);
        return;
      }

      const modelBase = mode === "mixed" ? ruleResult.nextBySlot : base;
      await advance(4);
      const res = await fetch("/api/produccion/planificacion-ia-reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          mode: mode === "mixed" ? "mixed" : "advanced",
          scope: iaScope,
          settings: iaSettings,
          promptBase: iaSettings.promptBase,
          slots: modelBase,
          capacityBySlot,
        }),
      });
      const data = (await res.json()) as {
        items?: PlanificacionIaProposalItem[];
        reasons?: string[];
        warnings?: string[];
        modelUsed?: string;
        didFallback?: boolean;
        error?: string;
        parseError?: string;
        rawPreview?: string;
      };
      if (!res.ok || !Array.isArray(data.items)) {
        if (mode === "mixed" || mode === "advanced") {
          await advance(6);
          setDraftBySlot(ruleResult.nextBySlot);
          setDraftUpdatedAt(new Date().toISOString());
          const warnings = [
            ...(ruleResult.warnings ?? []),
            [data.error, data.parseError, data.rawPreview?.slice(0, 500)]
              .filter(Boolean)
              .join(" · ") ||
              "El modelo no pudo refinar; se conserva la propuesta por reglas.",
          ];
          setIaResult({
            movedCount: ruleResult.movedCount,
            reasons: ruleResult.reasons,
            warnings,
            mode,
            scope: iaScope,
          });
          setIaDialog((prev) => ({
            ...prev,
            status: "success",
            stepIndex: 6,
            movedCount: ruleResult.movedCount,
            reasons: ruleResult.reasons,
            warnings,
            insights: prev.insights,
          }));
          toast.warning("IA avanzada no disponible. Se aplicó la propuesta por reglas.");
          return;
        }
        throw new Error(
          [data.error, data.parseError, data.rawPreview?.slice(0, 500)]
            .filter(Boolean)
            .join(" · ") || "El modelo no devolvió una propuesta válida.",
        );
      }

      await advance(5);
      const validated = validateAndApplyIaProposal({
        currentBySlot: base,
        proposalItems: data.items,
        capacityBySlot,
        scope: iaScope,
      });
      await advance(6);
      setDraftBySlot(validated.nextBySlot);
      setDraftUpdatedAt(new Date().toISOString());
      const warnings = [...(data.warnings ?? []), ...validated.warnings];
      setIaResult({
        movedCount: validated.movedCount,
        reasons: data.reasons?.length ? data.reasons : ruleResult.reasons,
        warnings,
        mode,
        scope: iaScope,
        modelUsed: data.modelUsed,
        didFallback: data.didFallback,
      });
      setIaDialog((prev) => ({
        ...prev,
        status: "success",
        stepIndex: 6,
        movedCount: validated.movedCount,
        reasons: data.reasons?.length ? data.reasons : ruleResult.reasons,
        warnings,
        modelUsed: data.modelUsed,
        didFallback: data.didFallback,
        insights: prev.insights,
      }));
      toast.success(
        `${mode === "mixed" ? "Ordenación mixta" : "IA avanzada"} aplicada (${validated.movedCount} movimientos).`,
      );
    } catch (e) {
      if (mode === "mixed" || mode === "advanced") {
        const fallback = reorderBoardWithIaRules(base, iaSettings, iaScope, capacityBySlot);
        setDraftBySlot(fallback.nextBySlot);
        setDraftUpdatedAt(new Date().toISOString());
        const warnings = [
          ...fallback.warnings,
          getErrorMessage(e, "El modelo no pudo refinar; se conserva la propuesta por reglas."),
        ];
        setIaResult({
          movedCount: fallback.movedCount,
          reasons: fallback.reasons,
          warnings,
          mode,
          scope: iaScope,
        });
        setIaDialog((prev) => ({
          ...prev,
          status: "success",
          stepIndex: 6,
          movedCount: fallback.movedCount,
          reasons: fallback.reasons,
          warnings,
          insights: prev.insights,
        }));
        toast.warning("IA avanzada no disponible. Se aplicó la propuesta por reglas.");
        return;
      }
      const msg = getErrorMessage(e, "No se pudo ordenar con IA.");
      setIaDialog((prev) => ({
        ...prev,
        status: "error",
        error: msg,
        warnings: prev.warnings,
        insights: prev.insights,
      }));
      toast.error(msg);
    } finally {
      setIaOrdering(false);
    }
  }, [draftBySlot, simulationBaseBySlot, iaSettings, iaScope, globalModel, capacityBySlot]);

  // ===== EDICIÓN DE CAPACIDAD ==============================================

  const openCapacityDialog = (day: DayKey, turno: TurnoKey) => {
    setCapDialogDay(day);
    setCapDialogTurno(turno);
    setCapDialogOpen(true);
  };

  const saveCapacity = useCallback(
    async (horas: number, motivo: string | null) => {
      if (!capDialogDay || !capDialogTurno) return;
      if (!selectedMaquinaId) {
        toast.error("Selecciona una máquina para guardar la capacidad.");
        return;
      }
      setSavingCap(true);
      try {
        const { error: upErr } = await supabase.from(TABLE_CAPACIDAD).upsert(
          {
            fecha: capDialogDay,
            turno: capDialogTurno,
            maquina_id: selectedMaquinaId,
            capacidad_horas: horas,
            motivo_ajuste: motivo,
            updated_at: new Date().toISOString(),
            created_by: userId,
            created_by_email: userEmail,
          },
          { onConflict: "fecha,turno,maquina_id" },
        );
        if (upErr) throw upErr;
        toast.success("Capacidad actualizada.");
        const newCaps = await loadCapacidades();
        setCapacidades(newCaps);
        setCapDialogOpen(false);
      } catch (e) {
        const msg = getErrorMessage(e, "No se pudo guardar la capacidad.");
        console.error("[Mesa] saveCapacity", { error: e, msg });
        toast.error(msg);
      } finally {
        setSavingCap(false);
      }
    },
    [
      capDialogDay,
      capDialogTurno,
      supabase,
      selectedMaquinaId,
      userId,
      userEmail,
      loadCapacidades,
    ],
  );

  const initialCapDialogValues = useMemo(() => {
    if (!capDialogDay || !capDialogTurno) {
      return { horas: 8, motivo: null as string | null };
    }
    const cur = capacidades.find(
      (c) => c.fecha === capDialogDay && c.turno === capDialogTurno,
    );
    return {
      horas: cur?.capacidadHoras ?? 8,
      motivo: cur?.motivoAjuste ?? null,
    };
  }, [capDialogDay, capDialogTurno, capacidades]);

  // ===== RENDER =============================================================

  const weekRangeLabel = useMemo(() => {
    const lastDay = addDays(weekMonday, showSaturday ? 5 : 4);
    return `${format(weekMonday, "d MMM", { locale: es })} – ${format(
      lastDay,
      "d MMM yyyy",
      { locale: es },
    )}`;
  }, [weekMonday, showSaturday]);

  const planStatusLabel = useMemo(() => {
    if (planStatus === "confirmado") return "Plan confirmado";
    if (planStatus === "en_ejecucion") return "Plan en ejecución";
    if (planStatus === "finalizada") return "Plan finalizado";
    if (planStatus === "borrador") return "Plan en borrador";
    return "Sin plan";
  }, [planStatus]);

  const draftUpdatedAtLabel = useMemo(() => {
    if (!draftUpdatedAt) return "sin guardar";
    const date = new Date(draftUpdatedAt);
    if (Number.isNaN(date.getTime())) return "sin guardar";
    return format(date, "dd/MM/yyyy HH:mm", { locale: es });
  }, [draftUpdatedAt]);

  const confirmDisabled =
    !selectedMaquinaId || !realBoardHasItems || savingChanges || publishing;

  const resetDraftFromReal = useCallback(() => {
    clearDraft();
    setDraftBySlot(simulationBaseBySlot);
    setDraftUpdatedAt(new Date().toISOString());
    toast.message("Simulación cargada desde el plan real visible.");
  }, [clearDraft, simulationBaseBySlot]);

  const goPrevWeek = () => setWeekMonday((d) => addDays(d, -7));
  const goNextWeek = () => setWeekMonday((d) => addDays(d, 7));
  const goToday = () => setWeekMonday(getWeekMonday(new Date()));

  /** Tarjeta usada en DragOverlay (item flotante). */
  const overlayCard = useMemo(() => {
    if (!activeId) return null;
    if (activeId.startsWith("pool::")) {
      const ot = activeId.slice("pool::".length);
      const p = poolByOt.get(ot);
      if (!p) return null;
      const data: PlanificacionCardData = {
        ot: p.ot,
        cliente: p.cliente,
        tintas: p.tintas,
        barniz: p.barniz,
        acabadoPral: p.acabadoPral,
        papel: p.papel,
        numHojas: p.numHojasBrutas,
        horas: p.horasPlanificadas,
        materialStatus: p.materialStatus,
      };
      return <PlanificacionCard data={data} fixedHeight isDragging />;
    }
    if (activeId.startsWith("mesa::")) {
      const id = activeId.slice("mesa::".length);
      let found: MesaTrabajo | null = null;
      for (const sk of Object.keys(effectiveBySlot)) {
        const it = (effectiveBySlot[sk] ?? []).find((x) => x.id === id);
        if (it) {
          found = it;
          break;
        }
      }
      if (!found) return null;
      const data: PlanificacionCardData = {
        ot: found.ot,
        cliente: found.clienteSnapshot,
        tintas: found.tintasSnapshot,
        barniz: found.barnizSnapshot,
        acabadoPral: found.acabadoPralSnapshot,
        papel: found.papelSnapshot,
        numHojas: found.numHojasBrutasSnapshot,
        horas: found.horasPlanificadasSnapshot,
        materialStatus: found.materialStatus,
      };
      const overlayStyle: CSSProperties = {
        minHeight: `${cardHeightPx(found.horasPlanificadasSnapshot)}px`,
      };
      return (
        <PlanificacionCard data={data} isDragging style={overlayStyle} />
      );
    }
    return null;
  }, [activeId, poolByOt, effectiveBySlot]);

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg text-[#002147]">
            Mesa de Secuenciación - Impresión
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goPrevWeek}
              title="Semana anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToday}
              className={cn(
                isCurrentWeek && "border-[#C69C2B]/60 text-[#002147]",
              )}
              title="Ir a esta semana"
            >
              Hoy
            </Button>
            <span className="rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1 text-xs font-medium text-slate-700 capitalize">
              {weekRangeLabel}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goNextWeek}
              title="Semana siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              disabled={!hasImpresionMachine || loading}
              title="Imprimir / Exportar"
            >
              <Printer className="mr-1 size-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void reload()}
              disabled={loading || savingChanges || publishing || !hasImpresionMachine}
              title="Recargar"
            >
              <RefreshCcw
                className={cn("size-4", loading && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
              Ámbito: Impresión
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold",
                planStatus === "confirmado" || planStatus === "en_ejecucion"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : planStatus === "finalizada"
                    ? "border-slate-300 bg-slate-100 text-slate-700"
                  : planStatus === "borrador"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-600",
              )}
            >
              {planStatusLabel}
            </span>
            <select
              className="h-8 min-w-[13rem] rounded-md border border-slate-300 bg-white px-2 text-xs"
              value={selectedMaquinaId ?? ""}
              onChange={(e) => setSelectedMaquinaId(e.target.value || null)}
              disabled={!hasImpresionMachine}
            >
              {maquinasPorTipo.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
              <input
                type="checkbox"
                checked={showSaturday}
                onChange={(e) => setShowSaturday(e.target.checked)}
                aria-label="Mostrar sábado"
              />
              Mostrar sábado
            </label>
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1",
                simulationOn
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              <FlaskConical
                className={cn(
                  "size-3.5",
                  simulationOn ? "text-amber-700" : "text-slate-400",
                )}
                aria-hidden
              />
              <input
                type="checkbox"
                checked={simulationOn}
                onChange={(e) => setSimulationOn(e.target.checked)}
                aria-label="Modo simulación"
                disabled={!hasImpresionMachine}
              />
              Modo simulación
            </label>
            {savingChanges ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 className="size-3 animate-spin" /> Guardando...
              </span>
            ) : null}
          </div>

          {simulationOn ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetDraftFromReal}
                disabled={publishing}
              >
                <CircleDashed className="mr-1 size-4" /> Reiniciar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetDraftFromReal}
                disabled={publishing || !hasImpresionMachine}
              >
                Cargar plan real en simulación
              </Button>
              <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                Alcance IA
                <select
                  className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-xs"
                  value={iaScope}
                  disabled={publishing || iaOrdering}
                  onChange={(e) => setIaScope(e.target.value as PlanificacionIaScope)}
                  title={
                    iaScope === "semana"
                      ? "Reordena toda la semana visible; revisar antes de aplicar"
                      : iaScope === "dias_contiguos"
                        ? "Optimiza por días adyacentes"
                        : iaScope === "dia"
                          ? "Puede mover entre mañana/tarde del mismo día"
                          : "Solo reordena dentro de cada turno"
                  }
                >
                  <option value="turno">Turno</option>
                  <option value="dia">Día</option>
                  <option value="dias_contiguos">Días contiguos</option>
                  <option value="semana">Semana completa</option>
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void orderDraftWithIa("rules")}
                disabled={publishing || iaOrdering || !draftHydrated || !hasImpresionMachine}
                title={iaSettings.promptBase}
              >
                {iaOrdering ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-4 text-[#C69C2B]" />
                )}
                Ordenar con reglas
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void orderDraftWithIa("advanced")}
                disabled={publishing || iaOrdering || !draftHydrated || !hasImpresionMachine}
                title={`Usa el modelo global: ${globalModel}`}
              >
                <Sparkles className="mr-1 size-4 text-[#C69C2B]" />
                IA avanzada
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#C69C2B]/60 bg-[#C69C2B]/10 text-[#002147] hover:bg-[#C69C2B]/20"
                onClick={() => void orderDraftWithIa("mixed")}
                disabled={publishing || iaOrdering || !draftHydrated || !hasImpresionMachine}
                title={`Reglas + refinado con ${globalModel}`}
              >
                <Sparkles className="mr-1 size-4 text-[#C69C2B]" />
                Ordenar mixto
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#002147] text-white hover:bg-[#001735]"
                disabled={publishing || !draftHydrated || !hasImpresionMachine}
                onClick={() => void applySimulation()}
              >
                {publishing ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Send className="mr-1 size-4" />
                )}
                Aplicar simulación
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasImpresionMachine || loading}
                onClick={() => {
                  setSimulationOn(true);
                  setDraftBySlot(simulationBaseBySlot);
                  setDraftUpdatedAt(new Date().toISOString());
                  setIaResult(null);
                  toast.message("Simulación activada. Puedes usar reglas, IA avanzada o modo mixto.");
                }}
              >
                <Sparkles className="mr-1 size-4 text-[#C69C2B]" />
                IA sobre simulación
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#002147] text-white hover:bg-[#001735]"
                disabled={confirmDisabled}
                onClick={() => void confirmPlanificacion()}
              >
                {savingChanges ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Send className="mr-1 size-4" />
                )}
                Confirmar planificación
              </Button>
            </div>
          )}
        </div>

        {simulationOn ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p className="leading-snug">
              <strong>Modo simulación activo.</strong> Tus cambios solo se
              guardan en este navegador (clave{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px]">
                {`minerva_plan_draft_${userId ?? "anon"}`}
              </code>
              ) hasta que pulses{" "}
              <strong>“Aplicar simulación”</strong>. Sobreviven a un refresco.
              <span className="mt-1 block">
                Semana: <strong>{weekRangeLabel}</strong> · Máquina:{" "}
                <strong>{maquinaSeleccionada?.nombre ?? "sin máquina"}</strong>{" "}
                · Draft: <strong>{draftUpdatedAtLabel}</strong>
              </span>
            </p>
          </div>
        ) : null}

        {simulationOn && iaResult ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <strong>
              {iaResult.mode === "rules"
                ? "Ordenación por reglas"
                : iaResult.mode === "mixed"
                  ? "Ordenación mixta"
                  : "Ordenación IA avanzada"}
              :
            </strong>{" "}
            {iaResult.movedCount} movimientos
            {iaResult.modelUsed ? (
              <span>
                {" "}
                · Modelo: <strong>{iaResult.modelUsed}</strong>
                {iaResult.didFallback ? " (fallback)" : ""}
              </span>
            ) : null}
            {" "}· Alcance: <strong>{iaResult.scope}</strong>.{" "}
            {iaResult.reasons.slice(0, 3).join(" ")}
            {iaResult.warnings.length > 0 ? (
              <span className="mt-1 block text-amber-800">
                Avisos: {iaResult.warnings.join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert className="size-4" />
              {error}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void reload()}
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        {!hasImpresionMachine ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert className="size-4" />
              No hay máquinas activas de impresión configuradas. Ve a Settings →
              Recursos Producción y activa al menos una.
            </span>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="px-3 pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
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
              disabled={publishing || !hasImpresionMachine}
            />

            <div className="min-w-0">
              {loading ? (
                <div
                  className={cn(
                    "grid gap-2",
                    "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
                    showSaturday && "lg:grid-cols-6",
                  )}
                >
                  {weekDays.map((d) => (
                    <Skeleton
                      key={toDayKey(d)}
                      className="h-[20rem] w-full rounded-md"
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={cn(
                    "grid gap-2",
                    "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
                    showSaturday && "lg:grid-cols-6",
                  )}
                >
                  {weekDays.map((d) => {
                    const dayKey = toDayKey(d);
                    return (
                      <DayCard
                        key={dayKey}
                        date={d}
                        bySlot={effectiveBySlot}
                        capacityBySlot={capacityBySlot}
                        capacities={capacidades}
                        defaultHorasManana={
                          maquinaSeleccionada?.capacidad_horas_default_manana ?? 8
                        }
                        defaultHorasTarde={
                          maquinaSeleccionada?.capacidad_horas_default_tarde ?? 8
                        }
                        onEditCapacity={openCapacityDialog}
                        onStartExecution={startExecution}
                        startingExecutionId={startingExecutionId}
                        disabled={publishing || !hasImpresionMachine}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DragOverlay modifiers={[dragOverlayPointerFix]}>
            {overlayCard}
          </DragOverlay>
        </DndContext>
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

      {selectedMaquinaId && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          visibleDayKeys={weekDays.map(toDayKey)}
          weekMondayKey={weekStartKey}
          realBySlot={realBySlot}
          draftBySlot={draftBySlot}
          simulationOn={simulationOn}
          capacidades={capacidades}
          maquinaId={selectedMaquinaId}
          maquinaNombre={maquinaSeleccionada?.nombre ?? "—"}
          defaultCapacidad={maquinaSeleccionada?.capacidad_horas_default_manana ?? 8}
          userEmail={userEmail}
          trabajoByOt={trabajoByOt}
        />
      )}

      <PublicandoOverlay open={publishing} />
      <PlanificacionIaProgressDialog
        state={iaDialog}
        onClose={() => setIaDialog((prev) => ({ ...prev, open: false }))}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DayCard — cabecera de día + 2 turnos
// ---------------------------------------------------------------------------
function DayCard({
  date,
  bySlot,
  capacityBySlot,
  capacities,
  defaultHorasManana,
  defaultHorasTarde,
  onEditCapacity,
  onStartExecution,
  startingExecutionId,
  disabled,
}: {
  date: Date;
  bySlot: Record<SlotKey, MesaTrabajo[]>;
  capacityBySlot: Record<SlotKey, number>;
  capacities: CapacidadTurno[];
  defaultHorasManana: number;
  defaultHorasTarde: number;
  onEditCapacity: (day: DayKey, turno: TurnoKey) => void;
  onStartExecution: (trabajo: MesaTrabajo) => void;
  startingExecutionId: string | null;
  disabled?: boolean;
}) {
  const dayKey = toDayKey(date);
  const isTodayDay = useMemo(() => {
    const t = new Date();
    return (
      t.getFullYear() === date.getFullYear() &&
      t.getMonth() === date.getMonth() &&
      t.getDate() === date.getDate()
    );
  }, [date]);

  const capManana = useMemo(() => {
    const v = capacityBySlot[slotKey(dayKey, "manana")];
    return typeof v === "number" && v >= 0 ? v : defaultHorasManana;
  }, [capacityBySlot, dayKey, defaultHorasManana]);
  const capTarde = useMemo(() => {
    const v = capacityBySlot[slotKey(dayKey, "tarde")];
    return typeof v === "number" && v >= 0 ? v : defaultHorasTarde;
  }, [capacityBySlot, dayKey, defaultHorasTarde]);
  const motivoManana = useMemo(
    () =>
      capacities.find((c) => c.fecha === dayKey && c.turno === "manana")
        ?.motivoAjuste ?? null,
    [capacities, dayKey],
  );
  const motivoTarde = useMemo(
    () =>
      capacities.find((c) => c.fecha === dayKey && c.turno === "tarde")
        ?.motivoAjuste ?? null,
    [capacities, dayKey],
  );

  const skManana = slotKey(dayKey, "manana");
  const skTarde = slotKey(dayKey, "tarde");

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border p-1.5",
        isTodayDay
          ? "border-[#C69C2B]/60 bg-amber-50/30 ring-1 ring-[#C69C2B]/30"
          : "border-slate-200/90 bg-slate-50/40",
      )}
    >
      <header className="flex items-center justify-between gap-1 px-1">
        <p className="text-[11px] capitalize">
          <span className="font-semibold text-[#002147]">
            {format(date, "EEEE", { locale: es })}
          </span>{" "}
          <span className="tabular-nums text-slate-500">
            {format(date, "d MMM", { locale: es })}
          </span>
        </p>
        {isTodayDay ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#C69C2B]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#002147]">
            Hoy
          </span>
        ) : null}
      </header>

      <TurnoColumn
        day={dayKey}
        turno="manana"
        items={bySlot[skManana] ?? []}
        capacityHoras={capManana}
        onEditCapacity={() => onEditCapacity(dayKey, "manana")}
        onStartExecution={onStartExecution}
        startingExecutionId={startingExecutionId}
        disabled={disabled}
      />
      {motivoManana ? (
        <p
          className="truncate px-1 text-[10px] text-amber-700"
          title={motivoManana}
        >
          ⚠ {motivoManana}
        </p>
      ) : null}

      <TurnoColumn
        day={dayKey}
        turno="tarde"
        items={bySlot[skTarde] ?? []}
        capacityHoras={capTarde}
        onEditCapacity={() => onEditCapacity(dayKey, "tarde")}
        onStartExecution={onStartExecution}
        startingExecutionId={startingExecutionId}
        disabled={disabled}
      />
      {motivoTarde ? (
        <p
          className="truncate px-1 text-[10px] text-amber-700"
          title={motivoTarde}
        >
          ⚠ {motivoTarde}
        </p>
      ) : null}
    </div>
  );
}
