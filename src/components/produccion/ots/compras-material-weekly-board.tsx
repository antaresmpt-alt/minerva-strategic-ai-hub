"use client";

import { addDays, format, isSameWeek, isToday, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Package } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";
import { cn } from "@/lib/utils";

const COL_BACKLOG = "backlog";

function displayNumCompra(row: ComprasMaterialTableRow): string {
  const nc = String(row.num_compra ?? "").trim();
  if (nc) return nc;
  const ot = String(row.ot_numero ?? "").trim();
  return ot ? `OCM-${ot}` : "—";
}

/** fecha_prevista_recepcion (date o ISO) → medianoche local */
function fechaRecepcionToLocalDate(
  iso: string | null | undefined
): Date | null {
  if (!iso?.trim()) return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function formatGramajeLine(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  const s = Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
  return `${s}g`;
}

function estadoBorderClass(estado: string | null | undefined): string {
  const e = (estado ?? "").trim().toLowerCase();
  if (e === "recibido") return "border-l-emerald-600";
  if (e === "generada") return "border-l-sky-500";
  if (e === "confirmado") return "border-l-amber-500";
  if (e === "pendiente") return "border-l-slate-400";
  return "border-l-slate-300";
}

function columnIdForRow(
  row: ComprasMaterialTableRow,
  weekMonday: Date
): string {
  const monday = startOfWeek(weekMonday, { weekStartsOn: 1 });
  if (!row.fecha_prevista_recepcion) return COL_BACKLOG;
  const d = fechaRecepcionToLocalDate(row.fecha_prevista_recepcion);
  if (!d || Number.isNaN(d.getTime())) return COL_BACKLOG;
  if (!isSameWeek(d, monday, { weekStartsOn: 1 })) return COL_BACKLOG;
  const day = d.getDay();
  if (day === 0 || day === 6) return COL_BACKLOG;
  return format(d, "yyyy-MM-dd");
}

type ComprasMaterialWeeklyBoardProps = {
  weekMonday: Date;
  rows: ComprasMaterialTableRow[];
  onCardClick: (row: ComprasMaterialTableRow) => void;
};

function ColumnShell({
  header,
  children,
  highlight,
}: {
  header: ReactNode;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex min-h-[12rem] min-w-0 flex-col rounded-lg border border-slate-200/90 bg-slate-50/40">
      <div
        className={cn(
          "shrink-0 border-b border-slate-200/80 px-2 py-2 text-center",
          highlight && "bg-[#C69C2B]/15 font-semibold text-[#002147]"
        )}
      >
        {header}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-1.5">{children}</div>
    </div>
  );
}

function CompraCard({
  row,
  onClick,
}: {
  row: ComprasMaterialTableRow;
  onClick: () => void;
}) {
  const mat = row.material?.trim() || "—";
  const gram = formatGramajeLine(row.gramaje);
  const fmt = row.tamano_hoja?.trim() || "—";
  const prov = row.proveedor_nombre?.trim() || "—";
  const est = row.estado?.trim() || "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border border-slate-200/90 bg-white p-2 text-left shadow-xs transition hover:bg-slate-50/90",
        "border-l-4",
        estadoBorderClass(row.estado)
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1 font-mono text-[11px] font-semibold text-[#002147]">
          <Package className="size-3.5 shrink-0 text-slate-500" aria-hidden />
          <span className="truncate">
            {row.ot_numero?.trim() || "—"} — {displayNumCompra(row)}
          </span>
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-800">
        {mat}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {gram} · {fmt}
      </p>
      <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground">
        {prov} · {est}
      </p>
    </button>
  );
}

export function ComprasMaterialWeeklyBoard({
  weekMonday,
  rows,
  onCardClick,
}: ComprasMaterialWeeklyBoardProps) {
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekMonday, i)),
    [weekMonday]
  );

  const columns = useMemo(() => {
    const map = new Map<string, ComprasMaterialTableRow[]>();
    map.set(COL_BACKLOG, []);
    for (const d of weekDays) {
      map.set(format(d, "yyyy-MM-dd"), []);
    }
    for (const row of rows) {
      const col = columnIdForRow(row, weekMonday);
      if (!map.has(col)) {
        map.get(COL_BACKLOG)!.push(row);
      } else {
        map.get(col)!.push(row);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const oa = String(a.ot_numero ?? "");
        const ob = String(b.ot_numero ?? "");
        const c = oa.localeCompare(ob, "es", { numeric: true });
        if (c !== 0) return c;
        return String(a.num_compra ?? "").localeCompare(
          String(b.num_compra ?? ""),
          "es",
          { numeric: true }
        );
      });
    }
    return map;
  }, [rows, weekMonday, weekDays]);

  const weekFriday = useMemo(() => addDays(weekMonday, 4), [weekMonday]);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-muted-foreground">
        No hay líneas con los filtros actuales. Ajusta búsqueda o vista lista.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <h3 className="hidden print:mb-2 print:block print:text-center font-heading text-sm font-semibold text-[#002147]">
        Compras de material — Semana del{" "}
        {format(weekMonday, "d MMM", { locale: es })} al{" "}
        {format(weekFriday, "d MMM yyyy", { locale: es })}
      </h3>
      <div className="w-full min-w-0 overflow-x-auto pb-1 print:overflow-visible">
        <div className="grid min-w-[72rem] grid-cols-6 gap-2 print:min-w-0">
          <ColumnShell
            header={
              <span className="text-xs font-semibold leading-tight">
                Sin fecha / otra semana
                <span className="ml-1 font-medium text-slate-500 tabular-nums">
                  ({(columns.get(COL_BACKLOG) ?? []).length})
                </span>
              </span>
            }
          >
            {(columns.get(COL_BACKLOG) ?? []).map((row) => (
              <CompraCard
                key={row.id}
                row={row}
                onClick={() => onCardClick(row)}
              />
            ))}
          </ColumnShell>

          {weekDays.map((d) => {
            const id = format(d, "yyyy-MM-dd");
            const today = isToday(d);
            const dayCount = (columns.get(id) ?? []).length;
            return (
              <ColumnShell
                key={id}
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
                  <CompraCard
                    key={row.id}
                    row={row}
                    onClick={() => onCardClick(row)}
                  />
                ))}
              </ColumnShell>
            );
          })}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden />
        Agrupación por{" "}
        <span className="font-medium">fecha prevista recepción</span>. Las
        fechas fuera de esta semana o sin fecha aparecen a la izquierda.
      </p>
    </div>
  );
}
