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
import { Eye, FileDown, ListOrdered, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EditCapacidadDialog } from "@/components/produccion/planificacion/mesa/edit-capacidad-dialog";
import {
  PlanificacionCard,
  type PlanificacionCardData,
} from "@/components/produccion/planificacion/mesa/planificacion-card";
import { SidebarPool } from "@/components/produccion/planificacion/mesa/sidebar-pool";
import {
  itemIdForMesa,
  itemIdForPool,
  POOL_CONTAINER_ID,
} from "@/components/produccion/planificacion/mesa/turno-column";
import {
  MaquinaColumn,
  type MaquinaColumnData,
} from "@/components/produccion/planificacion/mesa-diaria/maquina-column";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  applyDetalleBoardTransition,
  boardFromDetalleRows,
  detalleDiaDialogMaxWidth,
  draftByMaquinaFromBoard,
  fetchDetalleDiaDespachoMetaByOts,
  findDetalleBoardContainer,
  lineasToPoolList,
  otsEnDetalleBoard,
  type DetalleDiaDespachoMeta,
} from "@/lib/calendario-detalle-dia-board";
import {
  fetchDetalleDiaByCalendarioOtIds,
  fetchMaquinasForAmbito,
  saveDetalleDiaBoard,
  tipoMaquinaForCalendarioAmbito,
} from "@/lib/calendario-detalle-dia";
import {
  buildDetalleDiaPrintHtml,
  fetchDetalleDiaPrintMetaByOts,
  printHtmlInNewWindow,
} from "@/lib/calendario-detalle-dia-print";
import {
  labelCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import { errorMessageFromUnknown } from "@/lib/error-message";
import type { PlanificacionTipoMaquina } from "@/lib/planificacion-ambito";
import {
  dailySlotKey,
  flattenDailyBoard,
  getVisibleDailySlotKeys,
  groupMesaItemsByDailySlot,
} from "@/lib/planificacion-mesa-diaria";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { ProdCalendarioDetalleDiaRow } from "@/types/prod-calendario-detalle-dia";
import type {
  DayKey,
  MesaTrabajo,
  PoolOT,
  TurnoKey,
} from "@/types/planificacion-mesa";

type CapacidadDailyTurno = {
  maquina_id: string;
  fecha: string;
  turno: TurnoKey;
  capacidadHoras: number;
  motivoOverride: string | null;
};

export type CalendarioDetalleDiaMesaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayYmd: string;
  dayLabel: string;
  ambito: CalendarioAmbito;
  lineas: CalendarioProduccionLinea[];
  canEdit: boolean;
  onSaved?: () => void;
};

const TABLE_CAPACIDAD = "prod_mesa_capacidad_turnos";

function isLineaHecha(l: CalendarioProduccionLinea): boolean {
  return Boolean(l.hechoVisual ?? l.marcadoHecho);
}

function hiddenMaquinasStorageKey(userId: string | null): string {
  return `minerva_detalle_cal_hidden_maquinas_${userId ?? "anon"}`;
}

function collisionDetectionStrategy(args: Parameters<typeof pointerWithin>[0]) {
  const hits = pointerWithin(args);
  if (hits.length > 0) return hits;
  return closestCorners(args);
}

export function CalendarioDetalleDiaMesaDialog({
  open,
  onOpenChange,
  dayYmd,
  dayLabel,
  ambito,
  lineas,
  canEdit,
  onSaved,
}: CalendarioDetalleDiaMesaDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const tipoMaquina = tipoMaquinaForCalendarioAmbito(
    ambito,
  ) as PlanificacionTipoMaquina;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printingMaquinaId, setPrintingMaquinaId] = useState<string | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [mesaItems, setMesaItems] = useState<MesaTrabajo[]>([]);
  const [savedRows, setSavedRows] = useState<ProdCalendarioDetalleDiaRow[]>(
    [],
  );
  const [metaByOt, setMetaByOt] = useState<Map<string, DetalleDiaDespachoMeta>>(
    new Map(),
  );
  const [maquinas, setMaquinas] = useState<MaquinaColumnData[]>([]);
  const [capacidades, setCapacidades] = useState<CapacidadDailyTurno[]>([]);
  const [hiddenMaquinaIds, setHiddenMaquinaIds] = useState<Set<string>>(
    new Set(),
  );
  const [poolSearch, setPoolSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [capMaquinaId, setCapMaquinaId] = useState<string | null>(null);
  const [capTurno, setCapTurno] = useState<TurnoKey | null>(null);
  const [capSaving, setCapSaving] = useState(false);

  const dayKey = dayYmd as DayKey;
  const pendingLineas = useMemo(
    () => lineas.filter((l) => !isLineaHecha(l)),
    [lineas],
  );

  const visibleMaquinas = useMemo(
    () => maquinas.filter((m) => !hiddenMaquinaIds.has(m.id)),
    [maquinas, hiddenMaquinaIds],
  );
  const visibleMaquinaIds = useMemo(
    () => visibleMaquinas.map((m) => m.id),
    [visibleMaquinas],
  );
  const allMaquinaIds = useMemo(() => maquinas.map((m) => m.id), [maquinas]);

  const bySlot = useMemo(
    () => groupMesaItemsByDailySlot(mesaItems, dayKey, allMaquinaIds),
    [mesaItems, dayKey, allMaquinaIds],
  );

  const visibleSlotKeys = useMemo(
    () => getVisibleDailySlotKeys(visibleMaquinaIds),
    [visibleMaquinaIds],
  );

  const poolAll = useMemo(
    () => lineasToPoolList(lineas, metaByOt, isLineaHecha),
    [lineas, metaByOt],
  );

  const otsEnMesa = useMemo(
    () => otsEnDetalleBoard(mesaItems, dayKey),
    [mesaItems, dayKey],
  );

  const poolForSidebar = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    return poolAll.filter((p) => {
      if (otsEnMesa.has(p.ot)) return false;
      if (!q) return true;
      const hay = [p.ot, p.cliente, p.trabajo, p.papel].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [poolAll, otsEnMesa, poolSearch]);

  const poolByOt = useMemo(() => {
    const m = new Map<string, PoolOT>();
    for (const p of poolAll) m.set(p.ot, p);
    return m;
  }, [poolAll]);

  const lineaIdByOt = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lineas) m.set(l.otNumero, l.id);
    return m;
  }, [lineas]);

  const poolOtSet = useMemo(
    () => new Set(poolForSidebar.map((p) => p.ot)),
    [poolForSidebar],
  );

  const maquinaById = useMemo(() => {
    const m = new Map<string, MaquinaColumnData>();
    for (const x of maquinas) m.set(x.id, x);
    return m;
  }, [maquinas]);

  const capacityFor = useCallback(
    (maquinaId: string, turno: TurnoKey): number => {
      const override = capacidades.find(
        (c) =>
          c.maquina_id === maquinaId &&
          c.turno === turno &&
          c.fecha === dayKey,
      );
      if (override && override.capacidadHoras >= 0) {
        return override.capacidadHoras;
      }
      const mq = maquinaById.get(maquinaId);
      if (!mq) return 8;
      return turno === "manana"
        ? mq.capacidad_horas_default_manana
        : mq.capacidad_horas_default_tarde;
    },
    [capacidades, dayKey, maquinaById],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    if (!open || !dayYmd) return;
    setLoading(true);
    setDirty(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);

      const storedHidden = window.localStorage.getItem(
        hiddenMaquinasStorageKey(user?.id ?? null),
      );
      if (storedHidden) {
        try {
          const ids = JSON.parse(storedHidden) as string[];
          setHiddenMaquinaIds(new Set(ids));
        } catch {
          setHiddenMaquinaIds(new Set());
        }
      } else {
        setHiddenMaquinaIds(new Set());
      }

      const maqsRaw = await fetchMaquinasForAmbito(supabase, ambito);
      const maqs: MaquinaColumnData[] = maqsRaw.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        codigo: m.nombre.slice(0, 4).toUpperCase(),
        tipo_maquina: m.tipo_maquina as PlanificacionTipoMaquina,
        capacidad_horas_default_manana:
          m.capacidad_horas_default_manana ?? 8,
        capacidad_horas_default_tarde: m.capacidad_horas_default_tarde ?? 8,
      }));
      setMaquinas(maqs);

      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setSavedRows(rows);

      const meta = await fetchDetalleDiaDespachoMetaByOts(
        supabase,
        lineas.map((l) => l.otNumero),
        tipoMaquina,
      );
      setMetaByOt(meta);

      const items = boardFromDetalleRows(
        rows,
        dayYmd,
        maqs.map((m) => m.id),
        meta,
      );
      setMesaItems(items);

      if (maqs.length > 0) {
        const { data: capData, error: capErr } = await supabase
          .from(TABLE_CAPACIDAD)
          .select("maquina_id, fecha, turno, capacidad_horas, motivo_ajuste")
          .eq("fecha", dayYmd)
          .in(
            "maquina_id",
            maqs.map((m) => m.id),
          );
        if (capErr) throw capErr;
        setCapacidades(
          (capData ?? []).map((c) => ({
            maquina_id: String(c.maquina_id),
            fecha: String(c.fecha),
            turno: c.turno === "tarde" ? "tarde" : "manana",
            capacidadHoras: Number(c.capacidad_horas ?? 8),
            motivoOverride:
              c.motivo_ajuste != null ? String(c.motivo_ajuste) : null,
          })),
        );
      } else {
        setCapacidades([]);
      }
    } catch (e) {
      console.error(e);
      toast.error(
        errorMessageFromUnknown(e, "No se pudo cargar el detalle del día."),
      );
      setMesaItems([]);
    } finally {
      setLoading(false);
    }
  }, [open, dayYmd, ambito, lineas, supabase, tipoMaquina]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    window.localStorage.setItem(
      hiddenMaquinasStorageKey(userId),
      JSON.stringify([...hiddenMaquinaIds]),
    );
  }, [hiddenMaquinaIds, userId]);

  const findContainerOf = useCallback(
    (id: string) =>
      findDetalleBoardContainer({
        id,
        bySlot,
        visibleSlotKeys,
        poolOtSet,
      }),
    [bySlot, visibleSlotKeys, poolOtSet],
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!canEdit || !over) return;
      const aId = String(active.id);
      const oId = String(over.id);
      if (aId === oId) return;

      const fromContainer = aId.startsWith("pool::")
        ? POOL_CONTAINER_ID
        : findContainerOf(aId);
      let toContainer = findContainerOf(oId);
      if (!toContainer && oId.startsWith("dailyslot::")) {
        toContainer = oId;
      }
      if (!fromContainer || !toContainer) return;

      const t = applyDetalleBoardTransition({
        activeContainer: fromContainer,
        activeId: aId,
        overContainer: toContainer,
        overId: oId.startsWith("mesa::") || oId.startsWith("dailyslot::") ? oId : null,
        currentBySlot: bySlot,
        visibleSlotKeys,
        dayYmd,
        poolByOt,
        lineaIdByOt,
        otsPlaced: otsEnMesa,
      });
      if (!t) return;

      const updatedFlat = flattenDailyBoard(t.next);
      setMesaItems((prev) => {
        const keep = prev.filter((it) => {
          if (it.fechaPlanificada !== dayKey) return true;
          const mid = (it.maquinaId ?? "").trim();
          if (!mid) return true;
          return !allMaquinaIds.includes(mid);
        });
        return [...keep, ...updatedFlat];
      });
      setDirty(true);
    },
    [
      canEdit,
      findContainerOf,
      bySlot,
      visibleSlotKeys,
      dayYmd,
      dayKey,
      poolByOt,
      lineaIdByOt,
      otsEnMesa,
      allMaquinaIds,
    ],
  );

  const tryClose = (nextOpen: boolean) => {
    if (!nextOpen && dirty && canEdit) {
      const ok = window.confirm(
        "Hay cambios sin guardar. ¿Salir sin guardar?",
      );
      if (!ok) return;
    }
    onOpenChange(nextOpen);
  };

  const handleGuardar = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const draftByMaquina = draftByMaquinaFromBoard(bySlot, allMaquinaIds);
      const placedIds = new Set<string>();
      for (const draft of draftByMaquina.values()) {
        for (const d of draft) placedIds.add(d.calendarioOtId);
      }
      const unsequenced = pendingLineas
        .filter((l) => !placedIds.has(l.id))
        .map((l) => l.id);

      await saveDetalleDiaBoard(supabase, {
        ambito,
        maquinaIds: allMaquinaIds,
        draftByMaquina,
        savedRows,
        unsequencedCalendarioOtIds: unsequenced,
        createdBy: user?.id ?? null,
      });

      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setSavedRows(rows);
      setMesaItems(
        boardFromDetalleRows(rows, dayYmd, allMaquinaIds, metaByOt),
      );
      setDirty(false);
      toast.success("Orden del día guardado.");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(errorMessageFromUnknown(e, "No se pudo guardar."));
    } finally {
      setSaving(false);
    }
  };

  const openCapacity = (
    maquinaId: string,
    _day: DayKey,
    turno: TurnoKey,
  ) => {
    setCapMaquinaId(maquinaId);
    setCapTurno(turno);
    setCapDialogOpen(true);
  };

  const saveCapacity = async (horas: number, motivo: string | null) => {
    if (!capMaquinaId || !capTurno) return;
    setCapSaving(true);
    try {
      const { error } = await supabase.from(TABLE_CAPACIDAD).upsert(
        {
          maquina_id: capMaquinaId,
          fecha: dayYmd,
          turno: capTurno,
          capacidad_horas: horas,
          motivo_ajuste: motivo,
        },
        { onConflict: "maquina_id,fecha,turno" },
      );
      if (error) throw error;
      setCapacidades((prev) => {
        const rest = prev.filter(
          (c) =>
            !(
              c.maquina_id === capMaquinaId &&
              c.fecha === dayYmd &&
              c.turno === capTurno
            ),
        );
        return [
          ...rest,
          {
            maquina_id: capMaquinaId,
            fecha: dayYmd,
            turno: capTurno,
            capacidadHoras: horas,
            motivoOverride: motivo,
          },
        ];
      });
      setCapDialogOpen(false);
      toast.success("Capacidad actualizada.");
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo guardar capacidad."));
    } finally {
      setCapSaving(false);
    }
  };

  const handlePrintMaquina = async (maquinaId: string) => {
    if (printingMaquinaId) return;
    setPrintingMaquinaId(maquinaId);
    try {
      const draft = [
        ...(bySlot[dailySlotKey(maquinaId, "manana")] ?? []).map((it) => ({
          calendarioOtId: it.id,
          otNumero: it.ot,
          turno: "manana" as const,
          slotOrden: it.slotOrden,
        })),
        ...(bySlot[dailySlotKey(maquinaId, "tarde")] ?? []).map((it) => ({
          calendarioOtId: it.id,
          otNumero: it.ot,
          turno: "tarde" as const,
          slotOrden: it.slotOrden,
        })),
      ];
      if (draft.length === 0) {
        toast.error("No hay OTs planificadas en esta máquina.");
        return;
      }
      const metaPrint = await fetchDetalleDiaPrintMetaByOts(
        supabase,
        draft.map((d) => d.otNumero),
      );
      const maqNombre =
        maquinaById.get(maquinaId)?.nombre ?? "Máquina";
      const html = buildDetalleDiaPrintHtml({
        dayYmd,
        dayLabel,
        ambito,
        maquinaNombre: maqNombre,
        draft,
        metaByOt: metaPrint,
        generadoPor: userEmail,
      });
      printHtmlInNewWindow(html, `Plan-${ambito}-${dayYmd}-${maquinaId}`);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo generar el PDF."));
    } finally {
      setPrintingMaquinaId(null);
    }
  };

  const activeOverlay = useMemo(() => {
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
        trabajoTitulo: p.trabajo,
        cantidadOt: p.cantidadOt,
      };
      return <PlanificacionCard data={data} isDragging fixedHeight />;
    }
    if (activeId.startsWith("mesa::")) {
      const id = activeId.slice("mesa::".length);
      const it = mesaItems.find((x) => x.id === id);
      if (!it) return null;
      const data: PlanificacionCardData = {
        ot: it.ot,
        cliente: it.clienteSnapshot,
        tintas: it.tintasSnapshot,
        barniz: it.barnizSnapshot,
        acabadoPral: it.acabadoPralSnapshot,
        papel: it.papelSnapshot,
        numHojas: it.numHojasBrutasSnapshot,
        horas: it.horasPlanificadasSnapshot,
        materialStatus: it.materialStatus,
        trabajoTitulo: it.trabajoTitulo,
        cantidadOt: it.cantidadOt,
      };
      return <PlanificacionCard data={data} isDragging fixedHeight />;
    }
    return null;
  }, [activeId, poolByOt, mesaItems]);

  const dialogMaxWidth = useMemo(
    () => detalleDiaDialogMaxWidth(visibleMaquinas.length),
    [visibleMaquinas.length],
  );

  const capInitial = useMemo(() => {
    if (!capMaquinaId || !capTurno) return { horas: 8, motivo: null as string | null };
    const ov = capacidades.find(
      (c) =>
        c.maquina_id === capMaquinaId &&
        c.turno === capTurno &&
        c.fecha === dayKey,
    );
    if (ov) return { horas: ov.capacidadHoras, motivo: ov.motivoOverride };
    return {
      horas: capacityFor(capMaquinaId, capTurno),
      motivo: null as string | null,
    };
  }, [capMaquinaId, capTurno, capacidades, dayKey, capacityFor]);

  return (
    <>
      <Dialog open={open} onOpenChange={tryClose}>
        <DialogContent
          className="flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          style={{ maxWidth: dialogMaxWidth, width: dialogMaxWidth }}
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-[#002147]">
              <ListOrdered className="size-5" aria-hidden />
              Detalle del día — vista mesa
              {dirty ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  Sin guardar
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {dayLabel} · {labelCalendarioAmbito(ambito)}. Arrastra desde el
              pool (OTs del calendario) a las columnas. No lanza ejecución.
            </DialogDescription>
          </DialogHeader>

          {maquinas.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
              <span className="text-[11px] font-medium text-slate-500">
                Máquinas:
              </span>
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
                        ? "border-slate-200 bg-slate-50 text-slate-400"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800",
                    )}
                  >
                    {hidden ? (
                      <Eye className="size-3" aria-hidden />
                    ) : (
                      <span
                        className="size-1.5 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                    )}
                    {m.nombre}
                  </button>
                );
              })}
              {hiddenMaquinaIds.size > 0 ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#002147] underline-offset-2 hover:underline"
                  onClick={() => setHiddenMaquinaIds(new Set())}
                >
                  Mostrar todas
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden p-3">
            {loading ? (
              <div className="flex gap-2">
                <Skeleton className="h-[24rem] w-48" />
                <Skeleton className="h-[24rem] flex-1" />
              </div>
            ) : maquinas.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-slate-600">
                No hay máquinas activas para este ámbito.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetectionStrategy}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              >
                <div className="grid h-[min(68vh,42rem)] grid-cols-1 gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
                  <SidebarPool
                    pool={poolForSidebar}
                    loading={false}
                    search={poolSearch}
                    onSearchChange={setPoolSearch}
                    otsEnMesa={otsEnMesa}
                    disabled={!canEdit || saving}
                  />
                  <div className="min-w-0 overflow-x-auto pb-1">
                    {visibleMaquinas.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        Activa al menos una máquina arriba.
                      </p>
                    ) : (
                      <div
                        className="flex min-h-full gap-2"
                        style={{
                          minWidth: `${visibleMaquinas.length * 17}rem`,
                        }}
                      >
                        {visibleMaquinas.map((m) => (
                          <MaquinaColumn
                            key={m.id}
                            maquina={m}
                            dayKey={dayKey}
                            itemsManana={
                              bySlot[dailySlotKey(m.id, "manana")] ?? []
                            }
                            itemsTarde={
                              bySlot[dailySlotKey(m.id, "tarde")] ?? []
                            }
                            capacityManana={capacityFor(m.id, "manana")}
                            capacityTarde={capacityFor(m.id, "tarde")}
                            onEditCapacity={openCapacity}
                            onAction={() => {}}
                            actionLoadingId={null}
                            disabled={!canEdit || saving}
                            planningOnly
                            wide={visibleMaquinas.length === 1}
                            onHideColumn={() => {
                              setHiddenMaquinaIds((prev) => {
                                const next = new Set(prev);
                                next.add(m.id);
                                return next;
                              });
                            }}
                            onExportPdf={() => void handlePrintMaquina(m.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeOverlay}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 px-4 py-3 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => tryClose(false)}
            >
              Atrás
            </Button>
            {canEdit ? (
              <Button
                type="button"
                className="bg-[#002147] hover:bg-[#003366]"
                disabled={saving || loading || maquinas.length === 0}
                onClick={() => void handleGuardar()}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : null}
                Guardar orden
              </Button>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditCapacidadDialog
        open={capDialogOpen}
        onOpenChange={setCapDialogOpen}
        fecha={dayYmd}
        turno={capTurno}
        initialHoras={capInitial.horas}
        initialMotivo={capInitial.motivo}
        saving={capSaving}
        onSave={saveCapacity}
        key={`${capMaquinaId}-${capTurno}-${capDialogOpen}`}
      />
    </>
  );
}

/** Re-export props compat con el dialog anterior. */
export type CalendarioDetalleDiaDialogProps = CalendarioDetalleDiaMesaDialogProps;

/** Alias: bloque 12 sustituye el selector simple por vista mesa. */
export const CalendarioDetalleDiaDialog = CalendarioDetalleDiaMesaDialog;
