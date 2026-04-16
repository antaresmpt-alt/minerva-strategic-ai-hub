"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDndMonitor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Truck } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import { cn } from "@/lib/utils";

/** Fila compatible con `SeguimientoRow` del padre (campos usados en tarjeta). */
export type ExternosDailyGridRow = {
  id: string;
  OT?: string | null;
  id_pedido: number;
  trabajo_titulo: string;
  proveedor_id: string;
  acabado_id: string;
  estado: string;
  fecha_prevista: string | null;
  orden_diario?: number | null;
  f_entrega_ot?: string | null;
};

function getOtDisplay(row: ExternosDailyGridRow): string {
  const o =
    row.OT != null && String(row.OT).trim() !== "" ? String(row.OT).trim() : "";
  if (o) return o;
  return String(row.id_pedido);
}

function estadoBorderClass(estado: string): string {
  switch (estado) {
    case "Pendiente":
      return "border-l-slate-400";
    case "Muelle Minerva":
      return "border-l-slate-500";
    case "Enviado":
      return "border-l-sky-500";
    case "En Proveedor":
    case "Acabado en Proveedor":
      return "border-l-orange-500";
    case "Retrasado":
      return "border-l-red-500";
    case "Parcial":
      return "border-l-amber-500";
    case "Recibido":
      return "border-l-emerald-600";
    default:
      return "border-l-slate-300";
  }
}

function estadoAbrev(estado: string): string {
  const map: Record<string, string> = {
    Pendiente: "Pend.",
    "Muelle Minerva": "Muelle",
    Enviado: "Env.",
    "En Proveedor": "Prov.",
    Retrasado: "Retr.",
    Parcial: "Parc.",
    "Acabado en Proveedor": "Acab.",
    Recibido: "Rec.",
  };
  return map[estado] ?? (estado.length > 6 ? `${estado.slice(0, 5)}…` : estado);
}

function compareDailyRows(a: ExternosDailyGridRow, b: ExternosDailyGridRow): number {
  const oa = a.orden_diario ?? 0;
  const ob = b.orden_diario ?? 0;
  if (oa !== ob) return oa - ob;
  const sa = getOtDisplay(a);
  const sb = getOtDisplay(b);
  if (sa !== sb) return sa.localeCompare(sb, "es", { numeric: true });
  return a.id.localeCompare(b.id);
}

function SortableCard({
  row,
  disabled,
  proveedorLabel,
  acabadoLabel,
  onCardClick,
  mrpSlot,
  otEntregaUmbrales,
}: {
  row: ExternosDailyGridRow;
  disabled?: boolean;
  proveedorLabel: string;
  acabadoLabel: string;
  onCardClick: (row: ExternosDailyGridRow) => void;
  mrpSlot: ReactNode;
  otEntregaUmbrales: OtsComprasUmbralesParametros;
}) {
  const suppressClick = useRef(false);
  useDndMonitor({
    onDragEnd({ active }) {
      if (active.id === row.id) {
        suppressClick.current = true;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 120);
      }
    },
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-20 opacity-80")}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={() => {
          if (suppressClick.current) return;
          onCardClick(row);
        }}
        className={cn(
          "externos-daily-print-card w-full cursor-grab rounded-md border border-slate-200/90 bg-white p-2 text-left shadow-xs transition-[opacity,box-shadow] active:cursor-grabbing",
          "border-l-4",
          estadoBorderClass(row.estado),
          isDragging && "shadow-md",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="flex min-w-0 flex-1 items-center gap-1 font-normal text-[#002147]">
            <Truck className="size-3.5 shrink-0 text-slate-500" aria-hidden />
            <OtNumeroSemaforoBadge
              otNumero={getOtDisplay(row)}
              fechaEntregaIso={row.f_entrega_ot}
              umbrales={otEntregaUmbrales}
              className="min-w-0 flex-1"
            />
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {mrpSlot}
            <span className="text-[10px] font-medium text-muted-foreground">
              {estadoAbrev(row.estado)}
            </span>
          </div>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-800">
          {row.trabajo_titulo?.trim() || "—"}
        </p>
        <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground">
          {proveedorLabel} — {acabadoLabel}
        </p>
      </button>
    </div>
  );
}

export type ExternosDailyGridProps = {
  day: Date;
  rows: ExternosDailyGridRow[];
  proveedorNombreById: Map<string, string>;
  acabadoNombreById: Map<string, string>;
  saving?: boolean;
  onCardClick: (row: ExternosDailyGridRow) => void;
  /** Persistir nuevo orden (ids en orden visual). */
  onReorder: (orderedIds: string[]) => void | Promise<void>;
  renderMrp: (row: ExternosDailyGridRow) => ReactNode;
  otEntregaUmbrales: OtsComprasUmbralesParametros;
};

export function ExternosDailyGrid({
  day,
  rows,
  proveedorNombreById,
  acabadoNombreById,
  saving,
  onCardClick,
  onReorder,
  renderMrp,
  otEntregaUmbrales,
}: ExternosDailyGridProps) {
  const sorted = useMemo(
    () => [...rows].sort(compareDailyRows),
    [rows]
  );

  const [items, setItems] = useState<ExternosDailyGridRow[]>(sorted);

  useEffect(() => {
    setItems(sorted);
  }, [sorted]);

  const ids = useMemo(() => items.map((r) => r.id), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((r) => r.id === active.id);
      const newIndex = items.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(items, oldIndex, newIndex);
      setItems(next);
      await onReorder(next.map((r) => r.id));
    },
    [items, onReorder]
  );

  const printTitle = useMemo(
    () =>
      format(day, "EEEE, d 'de' MMMM 'de' yyyy", {
        locale: es,
      }),
    [day]
  );

  return (
    <div className="externos-daily-print-root w-full min-w-0 space-y-3">
      <h2 className="mb-2 font-heading text-lg font-bold capitalize leading-snug text-[#002147] print:mb-4 print:text-center print:text-lg">
        {printTitle}
      </h2>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-muted-foreground">
          No hay trabajos con fecha prevista en este día (o están recibidos /
          terminados). Ajusta filtros o el día.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="externos-daily-print-grid grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5 print:grid-cols-5">
              {items.map((row) => (
                <SortableCard
                  key={row.id}
                  row={row}
                  disabled={saving}
                  proveedorLabel={
                    proveedorNombreById.get(row.proveedor_id) ?? "—"
                  }
                  acabadoLabel={acabadoNombreById.get(row.acabado_id) ?? "—"}
                  onCardClick={onCardClick}
                  mrpSlot={renderMrp(row)}
                  otEntregaUmbrales={otEntregaUmbrales}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
