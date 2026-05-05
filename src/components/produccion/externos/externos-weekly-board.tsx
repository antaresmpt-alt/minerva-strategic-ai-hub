"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  addDays,
  format,
  isSameWeek,
  isToday,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";

import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import { cn } from "@/lib/utils";

/** Fila mínima para el tablero (compatible con `SeguimientoRow` del padre). */
export type ExternosWeeklyBoardRow = {
  id: string;
  OT?: string | null;
  id_pedido: number;
  trabajo_titulo: string;
  proveedor_id: string;
  acabado_id: string;
  estado: string;
  fecha_prevista: string | null;
  /** F. entrega OT (cliente); semáforo alineado con Compras / Despachadas. */
  f_entrega_ot?: string | null;
};

function getOtDisplay(row: ExternosWeeklyBoardRow): string {
  const o =
    row.OT != null && String(row.OT).trim() !== "" ? String(row.OT).trim() : "";
  if (o) return o;
  return String(row.id_pedido);
}

/** ISO Supabase → fecha local a medianoche (misma lógica que `isoToDateInput` + parse). */
function fechaIsoToLocalDate(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function isEstadoTerminal(estado: string): boolean {
  return estado === "Recibido" || estado === "Terminado";
}

const COL_BACKLOG = "backlog";

function columnIdForRow(
  row: ExternosWeeklyBoardRow,
  weekMonday: Date
): string {
  if (isEstadoTerminal(row.estado)) return COL_BACKLOG;
  const monday = startOfWeek(weekMonday, { weekStartsOn: 1 });
  if (!row.fecha_prevista) return COL_BACKLOG;
  const d = fechaIsoToLocalDate(row.fecha_prevista);
  if (Number.isNaN(d.getTime())) return COL_BACKLOG;
  if (!isSameWeek(d, monday, { weekStartsOn: 1 })) return COL_BACKLOG;
  const day = d.getDay();
  if (day === 0 || day === 6) return COL_BACKLOG;
  return format(d, "yyyy-MM-dd");
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

const collisionDetection: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  if (p.length) return p;
  return rectIntersection(args);
};

type ExternosWeeklyBoardProps = {
  /** Lunes de la semana mostrada (normalizado). */
  weekMonday: Date;
  rows: ExternosWeeklyBoardRow[];
  proveedorNombreById: Map<string, string>;
  acabadoNombreById: Map<string, string>;
  saving?: boolean;
  onCardClick: (row: ExternosWeeklyBoardRow) => void;
  /** `ymd` `yyyy-MM-dd` o `null` para dejar sin fecha prevista. */
  onMoveToDate: (
    row: ExternosWeeklyBoardRow,
    ymd: string | null
  ) => void | Promise<void>;
  renderMrp?: (row: ExternosWeeklyBoardRow) => ReactNode;
  otEntregaUmbrales: OtsComprasUmbralesParametros;
};

function DroppableColumn({
  id,
  header,
  highlight,
  children,
  className,
}: {
  id: string;
  header: ReactNode;
  highlight?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      className={cn(
        "flex min-h-[12rem] min-w-0 flex-col rounded-lg border border-slate-200/90 bg-slate-50/40",
        isOver && "border-[#C69C2B]/60 bg-amber-50/50 ring-1 ring-[#C69C2B]/25",
        className
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-slate-200/80 px-2 py-2 text-center",
          highlight && "bg-[#C69C2B]/15 font-semibold text-[#002147]"
        )}
      >
        {header}
      </div>
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-1.5 p-1.5">
        {children}
      </div>
    </div>
  );
}

function DraggableCard({
  row,
  disabled,
  proveedorLabel,
  acabadoLabel,
  onCardClick,
  mrpSlot,
  otEntregaUmbrales,
}: {
  row: ExternosWeeklyBoardRow;
  disabled?: boolean;
  proveedorLabel: string;
  acabadoLabel: string;
  onCardClick: (row: ExternosWeeklyBoardRow) => void;
  mrpSlot?: ReactNode;
  otEntregaUmbrales: OtsComprasUmbralesParametros;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: row.id,
      disabled,
    });
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

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (suppressClick.current) return;
        onCardClick(row);
      }}
      className={cn(
        "externos-weekly-print-card-border w-full cursor-grab rounded-md border border-slate-200/90 bg-white p-2 text-left shadow-xs transition-[opacity,box-shadow] active:cursor-grabbing",
        "border-l-4",
        estadoBorderClass(row.estado),
        isDragging && "z-20 cursor-grabbing opacity-60 shadow-md",
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
          {mrpSlot != null ? mrpSlot : null}
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
  );
}

export function ExternosWeeklyBoard({
  weekMonday,
  rows,
  proveedorNombreById,
  acabadoNombreById,
  saving,
  onCardClick,
  onMoveToDate,
  renderMrp,
  otEntregaUmbrales,
}: ExternosWeeklyBoardProps) {

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekMonday, i)),
    [weekMonday]
  );

  const boardRows = useMemo(() => {
    const filtered = rows.filter((r) => !isEstadoTerminal(r.estado));
    const seen = new Set<string>();
    return filtered.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [rows]);

  const columns = useMemo(() => {
    const map = new Map<string, ExternosWeeklyBoardRow[]>();
    map.set(COL_BACKLOG, []);
    for (const d of weekDays) {
      map.set(format(d, "yyyy-MM-dd"), []);
    }
    for (const row of boardRows) {
      const col = columnIdForRow(row, weekMonday);
      if (!map.has(col)) {
        if (!map.has(COL_BACKLOG)) map.set(COL_BACKLOG, []);
        map.get(COL_BACKLOG)!.push(row);
      } else {
        map.get(col)!.push(row);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const oa = getOtDisplay(a);
        const ob = getOtDisplay(b);
        return oa.localeCompare(ob, "es", { numeric: true });
      });
    }
    return map;
  }, [boardRows, weekMonday, weekDays]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const rowId = String(active.id);
      const targetCol = String(over.id);
      const row = boardRows.find((r) => r.id === rowId);
      if (!row) return;

      const currentCol = columnIdForRow(row, weekMonday);
      if (currentCol === targetCol) return;

      if (targetCol === COL_BACKLOG) {
        await onMoveToDate(row, null);
        return;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(targetCol)) {
        await onMoveToDate(row, targetCol);
      }
    },
    [boardRows, weekMonday, onMoveToDate]
  );

  const weekFriday = useMemo(() => addDays(weekMonday, 4), [weekMonday]);

  const printTitle = useMemo(
    () =>
      `Planificación de Externos - Semana del ${format(weekMonday, "d 'de' MMMM 'de' yyyy", { locale: es })} al ${format(weekFriday, "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    [weekMonday, weekFriday]
  );

  return (
    <div className="externos-weekly-print-root w-full min-w-0 space-y-3">
      <h2 className="hidden print:mb-4 print:block print:text-center font-heading text-base font-bold leading-snug text-[#002147] print:text-lg">
        {printTitle}
      </h2>

      {boardRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-muted-foreground">
          No hay trabajos activos para el tablero (los recibidos o terminados no
          se muestran aquí). Ajusta filtros o activa el histórico en la vista
          lista.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <div className="w-full min-w-0 overflow-x-auto pb-1 print:overflow-visible">
            <div className="externos-weekly-print-grid grid min-w-[72rem] grid-cols-6 gap-2 print:min-w-0">
            <DroppableColumn
              id={COL_BACKLOG}
              header={
                <span className="text-xs font-semibold leading-tight">
                  Atrasados / Sin fecha
                  <span className="ml-1 font-medium text-slate-500 tabular-nums">
                    ({(columns.get(COL_BACKLOG) ?? []).length})
                  </span>
                </span>
              }
            >
              {(columns.get(COL_BACKLOG) ?? []).map((row) => (
                <DraggableCard
                  key={row.id}
                  row={row}
                  disabled={saving}
                  proveedorLabel={
                    proveedorNombreById.get(row.proveedor_id) ?? "—"
                  }
                  acabadoLabel={acabadoNombreById.get(row.acabado_id) ?? "—"}
                  onCardClick={onCardClick}
                  mrpSlot={renderMrp?.(row)}
                  otEntregaUmbrales={otEntregaUmbrales}
                />
              ))}
            </DroppableColumn>

            {weekDays.map((d) => {
              const id = format(d, "yyyy-MM-dd");
              const today = isToday(d);
              const dayCount = (columns.get(id) ?? []).length;
              return (
                <DroppableColumn
                  key={id}
                  id={id}
                  highlight={today}
                  header={
                    <span className="text-xs leading-tight">
                      <span className="block font-medium capitalize">
                        {format(d, "EEEE", { locale: es })}
                        <span className="ml-1 font-medium text-slate-500 tabular-nums">
                          ({dayCount})
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {format(d, "d MMM", { locale: es })}
                      </span>
                    </span>
                  }
                >
                  {(columns.get(id) ?? []).map((row) => (
                    <DraggableCard
                      key={row.id}
                      row={row}
                      disabled={saving}
                      proveedorLabel={
                        proveedorNombreById.get(row.proveedor_id) ?? "—"
                      }
                      acabadoLabel={acabadoNombreById.get(row.acabado_id) ?? "—"}
                      onCardClick={onCardClick}
                      mrpSlot={renderMrp?.(row)}
                      otEntregaUmbrales={otEntregaUmbrales}
                    />
                  ))}
                </DroppableColumn>
              );
            })}
            </div>
          </div>
        </DndContext>
      )}

      <p className="externos-plan-print-hide flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden />
        Arrastra una tarjeta a un día para fijar la fecha prevista; suelta en
        «Atrasados / Sin fecha» para quitar la fecha.
      </p>
    </div>
  );
}
