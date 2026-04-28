"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Info, Loader2, Pencil, PlayCircle, Sun, Sunrise } from "lucide-react";
import { useMemo } from "react";

import {
  PlanificacionCard,
  type PlanificacionCardData,
} from "@/components/produccion/planificacion/mesa/planificacion-card";
import { Button } from "@/components/ui/button";
import {
  computeTurnLoad,
  detectAdjacentLinks,
  loadBarClass,
  loadTextClass,
  slotKey,
} from "@/lib/planificacion-mesa";
import { cn } from "@/lib/utils";
import type {
  DayKey,
  MesaTrabajo,
  TurnoKey,
} from "@/types/planificacion-mesa";

/** Identificadores estables para D&D. */
export const containerIdForSlot = (day: DayKey, turno: TurnoKey) =>
  `slot::${slotKey(day, turno)}`;
export const itemIdForMesa = (id: string) => `mesa::${id}`;
export const itemIdForPool = (ot: string) => `pool::${ot}`;
export const POOL_CONTAINER_ID = "pool::sidebar";

interface TurnoColumnProps {
  day: DayKey;
  turno: TurnoKey;
  items: MesaTrabajo[];
  capacityHoras: number;
  onEditCapacity: () => void;
  onStartExecution: (trabajo: MesaTrabajo) => void;
  startingExecutionId: string | null;
  disabled?: boolean;
}

function turnoLabel(t: TurnoKey): string {
  return t === "manana" ? "Mañana" : "Tarde";
}
function turnoIcon(t: TurnoKey) {
  return t === "manana" ? (
    <Sunrise className="size-3.5 text-amber-600" aria-hidden />
  ) : (
    <Sun className="size-3.5 text-orange-600" aria-hidden />
  );
}

function isValidHexColor(value: string | null | undefined): value is string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "");
}

function readableTextColor(hex: string): "#0f172a" | "#ffffff" {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function SortableMesaCard({
  trabajo,
  linkedToNext,
  onStartExecution,
  startingExecutionId,
  disabled,
}: {
  trabajo: MesaTrabajo;
  linkedToNext: boolean;
  onStartExecution: (trabajo: MesaTrabajo) => void;
  startingExecutionId: string | null;
  disabled?: boolean;
}) {
  const sortableId = itemIdForMesa(trabajo.id);
  const isRunning = trabajo.estadoMesa === "en_ejecucion";
  const isFinished = trabajo.estadoMesa === "finalizada";
  const isPendingStart = trabajo.estadoEjecucionActual === "pendiente_inicio";
  const isPaused = trabajo.estadoEjecucionActual === "pausada";
  const pausedMinutes = Math.max(0, Math.trunc(trabajo.minutosPausadaAcumActual ?? 0));
  const pauseReason = trabajo.motivoPausaActivaActual?.trim() || null;
  const pauseColor = isValidHexColor(trabajo.motivoPausaColorHexActual)
    ? trabajo.motivoPausaColorHexActual
    : "#64748B";
  const pauseTextColor = readableTextColor(pauseColor);
  const pauseObservation = trabajo.observacionesPausaActivaActual?.trim() || null;
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled: disabled || isRunning || isFinished });

  const data: PlanificacionCardData = {
    ot: trabajo.ot,
    cliente: trabajo.clienteSnapshot,
    tintas: trabajo.tintasSnapshot,
    barniz: trabajo.barnizSnapshot,
    acabadoPral: trabajo.acabadoPralSnapshot,
    papel: trabajo.papelSnapshot,
    numHojas: trabajo.numHojasBrutasSnapshot,
    horas: trabajo.horasPlanificadasSnapshot,
    materialStatus: trabajo.materialStatus,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <PlanificacionCard
        data={data}
        linkedToNext={linkedToNext}
        isDragging={isDragging}
        className={cn(
          isRunning && !isPaused && !isPendingStart && "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-300",
          isPendingStart && "border-sky-400 bg-sky-50/80 ring-2 ring-sky-200",
          isPaused && "border-amber-400 bg-amber-50/80 ring-2 ring-amber-300",
          isFinished && "border-slate-300 bg-slate-50/90 ring-1 ring-slate-300",
        )}
        badgeStart={
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#002147]/10 text-[9px] font-bold text-[#002147] tabular-nums">
            {trabajo.slotOrden}
          </span>
        }
        footerSlot={
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {isRunning ? (
              isPendingStart ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Pendiente inicio
                </span>
              ) : isPaused ? (
                <>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Pausada · {pausedMinutes} min
                  </span>
                  {pauseReason ? (
                    <span
                      className="inline-flex min-w-0 max-w-[8.5rem] items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-xs"
                      style={{ backgroundColor: pauseColor, color: pauseTextColor }}
                      title={[
                        pauseReason,
                        trabajo.motivoPausaCategoriaActual
                          ? `Categoría: ${trabajo.motivoPausaCategoriaActual}`
                          : null,
                        pauseObservation ? `Obs.: ${pauseObservation}` : null,
                      ].filter(Boolean).join(" · ")}
                    >
                      <span className="min-w-0 truncate">{pauseReason}</span>
                      {pauseObservation ? (
                        <Info className="size-2.5 shrink-0" aria-label="Con observaciones" />
                      ) : null}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  En marcha
                </span>
              )
            ) : isFinished ? (
              <span className="inline-flex items-center rounded-full bg-slate-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Terminada
              </span>
            ) : trabajo.estadoMesa === "confirmado" ? (
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                disabled={disabled || startingExecutionId === trabajo.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartExecution(trabajo);
                }}
              >
                {startingExecutionId === trabajo.id ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <PlayCircle className="mr-1 size-3" />
                )}
                Liberar a máquina
              </button>
            ) : (
              <span className="text-[9px] font-medium uppercase tracking-wide text-amber-700">
                Borrador
              </span>
            )}
          </div>
        }
      />
    </div>
  );
}

export function TurnoColumn({
  day,
  turno,
  items,
  capacityHoras,
  onEditCapacity,
  onStartExecution,
  startingExecutionId,
  disabled,
}: TurnoColumnProps) {
  const containerId = containerIdForSlot(day, turno);
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  const load = useMemo(
    () => computeTurnLoad(items, capacityHoras),
    [items, capacityHoras],
  );
  const links = useMemo(() => detectAdjacentLinks(items), [items]);
  const sortableIds = useMemo(
    () => items.map((it) => itemIdForMesa(it.id)),
    [items],
  );

  const pctClamped = Math.min(load.pct, 100);
  const overflowPct = Math.max(0, load.pct - 100);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-md border bg-white/70 p-1.5 transition-colors",
        isOver
          ? "border-[#C69C2B]/60 bg-amber-50/60 ring-1 ring-[#C69C2B]/30"
          : "border-slate-200/90",
      )}
    >
      <header className="space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            {turnoIcon(turno)}
            {turnoLabel(turno)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 text-slate-400 hover:text-[#002147]"
            onClick={onEditCapacity}
            title="Editar capacidad del turno"
          >
            <Pencil className="size-3" aria-hidden />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
          <span className={cn("font-medium", loadTextClass(load.bucket))}>
            {load.totalHoras.toFixed(1)} / {load.capacidadHoras.toFixed(1)}h
          </span>
          <span className={cn("font-semibold", loadTextClass(load.bucket))}>
            {Math.round(load.pct)}%
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <span
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all",
              loadBarClass(load.bucket),
            )}
            style={{ width: `${pctClamped}%` }}
            aria-hidden
          />
          {overflowPct > 0 ? (
            <span
              className="absolute inset-y-0 right-0 rounded-full bg-red-700/40"
              style={{ width: `${Math.min(overflowPct, 100)}%` }}
              aria-hidden
            />
          ) : null}
        </div>
      </header>

      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[5rem] flex-1 flex-col gap-1.5 rounded-sm p-0.5",
            items.length === 0 &&
              "items-center justify-center border border-dashed border-slate-200 text-[10px] text-slate-400",
          )}
        >
          {items.length === 0 ? (
            <span>Arrastra aquí</span>
          ) : (
            items.map((trabajo, idx) => (
              <SortableMesaCard
                key={trabajo.id}
                trabajo={trabajo}
                linkedToNext={!!links[idx]}
                onStartExecution={onStartExecution}
                startingExecutionId={startingExecutionId}
                disabled={disabled}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
