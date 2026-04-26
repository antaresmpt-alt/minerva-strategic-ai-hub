"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Sun, Sunrise } from "lucide-react";
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

function SortableMesaCard({
  trabajo,
  linkedToNext,
  disabled,
}: {
  trabajo: MesaTrabajo;
  linkedToNext: boolean;
  disabled?: boolean;
}) {
  const sortableId = itemIdForMesa(trabajo.id);
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled });

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
        badgeStart={
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#002147]/10 text-[9px] font-bold text-[#002147] tabular-nums">
            {trabajo.slotOrden}
          </span>
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
                disabled={disabled}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
