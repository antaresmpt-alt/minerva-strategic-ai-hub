"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Inbox, Search } from "lucide-react";
import { useMemo } from "react";

import {
  POOL_CONTAINER_ID,
  itemIdForPool,
} from "@/components/produccion/planificacion/mesa/turno-column";
import {
  PlanificacionCard,
  type PlanificacionCardData,
} from "@/components/produccion/planificacion/mesa/planificacion-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PoolOT } from "@/types/planificacion-mesa";

interface SidebarPoolProps {
  pool: PoolOT[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  /** OTs ya en mesa (no se muestran). */
  otsEnMesa: Set<string>;
  disabled?: boolean;
}

function SortablePoolCard({
  pool,
  disabled,
}: {
  pool: PoolOT;
  disabled?: boolean;
}) {
  const sortableId = itemIdForPool(pool.ot);
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled });

  const data: PlanificacionCardData = {
    ot: pool.ot,
    cliente: pool.cliente,
    tintas: pool.tintas,
    barniz: pool.barniz,
    acabadoPral: pool.acabadoPral,
    papel: pool.papel,
    numHojas: pool.numHojasBrutas,
    horas: pool.horasPlanificadas,
    materialStatus: pool.materialStatus,
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
      <PlanificacionCard data={data} fixedHeight isDragging={isDragging} />
    </div>
  );
}

export function SidebarPool({
  pool,
  loading,
  search,
  onSearchChange,
  otsEnMesa,
  disabled,
}: SidebarPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_CONTAINER_ID });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter((p) => {
      if (otsEnMesa.has(p.ot)) return false;
      if (!q) return true;
      return (
        p.ot.toLowerCase().includes(q) ||
        p.cliente.toLowerCase().includes(q) ||
        p.papel.toLowerCase().includes(q) ||
        p.tintas.toLowerCase().includes(q) ||
        (p.barniz ?? "").toLowerCase().includes(q) ||
        p.acabadoPral.toLowerCase().includes(q)
      );
    });
  }, [pool, otsEnMesa, search]);

  const sortableIds = useMemo(
    () => visible.map((p) => itemIdForPool(p.ot)),
    [visible],
  );

  return (
    <aside
      className={cn(
        "flex h-full min-h-[20rem] w-full min-w-0 flex-col rounded-lg border bg-white shadow-sm transition-colors",
        isOver
          ? "border-[#C69C2B]/60 ring-1 ring-[#C69C2B]/30"
          : "border-slate-200/90",
      )}
    >
      <header className="space-y-2 border-b border-slate-100 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#002147]">
            <Inbox className="size-3.5" aria-hidden />
            Pool · Pendientes
          </p>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-700">
            {visible.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrar OTs..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </header>

      <div
        ref={setNodeRef}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 [scrollbar-width:thin]"
      >
        {loading ? (
          <>
            <Skeleton className="h-[65px] w-full" />
            <Skeleton className="h-[65px] w-full" />
            <Skeleton className="h-[65px] w-full" />
          </>
        ) : visible.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-500">
            {search.trim()
              ? "Sin coincidencias para tu búsqueda."
              : "No hay OTs pendientes en el pool."}
          </div>
        ) : (
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((p) => (
              <SortablePoolCard key={p.ot} pool={p} disabled={disabled} />
            ))}
          </SortableContext>
        )}
      </div>
    </aside>
  );
}
