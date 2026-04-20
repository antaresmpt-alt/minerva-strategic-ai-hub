"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LayoutGrid, Package } from "lucide-react";
import { useMemo } from "react";

import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";
import { cn } from "@/lib/utils";

function displayNumCompra(row: ComprasMaterialTableRow): string {
  const nc = String(row.num_compra ?? "").trim();
  if (nc) return nc;
  const ot = String(row.ot_numero ?? "").trim();
  return ot ? `OCM-${ot}` : "—";
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

type ComprasMaterialDailyGridProps = {
  day: Date;
  rows: ComprasMaterialTableRow[];
  onCardClick: (row: ComprasMaterialTableRow) => void;
};

export function ComprasMaterialDailyGrid({
  day,
  rows,
  onCardClick,
}: ComprasMaterialDailyGridProps) {
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const oa = String(a.ot_numero ?? "");
        const ob = String(b.ot_numero ?? "");
        const c = oa.localeCompare(ob, "es", { numeric: true });
        if (c !== 0) return c;
        return String(a.num_compra ?? "").localeCompare(
          String(b.num_compra ?? ""),
          "es",
          { numeric: true }
        );
      }),
    [rows]
  );

  const title = format(day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="w-full min-w-0 space-y-3">
      <h3 className="mb-2 font-heading text-lg font-bold capitalize leading-snug text-[#002147] print:mb-4 print:text-center print:text-lg">
        {title}
      </h3>
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-muted-foreground">
          No hay compras con fecha prevista de recepción en este día (o quedaron
          fuera por filtros). Cambia de día o revisa la vista lista.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-4">
          {sorted.map((row) => (
            <CompraCard
              key={row.id}
              row={row}
              onClick={() => onCardClick(row)}
            />
          ))}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
        Vista por día según{" "}
        <span className="font-medium">fecha prevista recepción</span>.
      </p>
    </div>
  );
}
