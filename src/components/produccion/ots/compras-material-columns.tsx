"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Camera, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COMPRAS_MATERIAL_ESTADOS } from "@/lib/compras-material-estados";
import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";
import { cn } from "@/lib/utils";

function ComprasSortHeader({
  column,
  label,
  title,
}: {
  column: Column<ComprasMaterialTableRow, unknown>;
  label: string;
  title?: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      title={title ?? `Ordenar por ${label}`}
      className={cn(
        "-mx-0.5 inline-flex max-w-full min-w-0 items-center gap-0.5 rounded px-0.5 py-0.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/90 hover:text-slate-800",
        sorted && "text-[#002147]"
      )}
      onClick={column.getToggleSortingHandler()}
    >
      <span className="min-w-0 shrink truncate">{label}</span>
      <span className="inline-flex size-3 shrink-0 items-center justify-center" aria-hidden>
        {sorted === "asc" ? (
          <ArrowUp className="size-3 text-[#002147]" strokeWidth={2.25} />
        ) : sorted === "desc" ? (
          <ArrowDown className="size-3 text-[#002147]" strokeWidth={2.25} />
        ) : (
          <ArrowUpDown className="size-3 text-slate-300" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

function formatGramajeCell(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  const s = Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
  return `${s}g`;
}

function formatNumCompraCell(numCompra: string | null | undefined, ot: string): string {
  const nc = String(numCompra ?? "").trim();
  if (nc) return nc;
  const otTrim = String(ot ?? "").trim().replace(/^ocm-/i, "");
  return otTrim ? `OCM-${otTrim}` : "—";
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function InlineFechaPrevistaCompraCell({
  rowId,
  isoValue,
  disabled,
  onCommit,
}: {
  rowId: string;
  isoValue: string | null | undefined;
  disabled?: boolean;
  onCommit: (ymd: string) => void | Promise<void>;
}) {
  const serverYmd = toDateInputValue(isoValue);
  const [local, setLocal] = useState(serverYmd);
  useEffect(() => {
    setLocal(serverYmd);
  }, [rowId, serverYmd]);
  return (
    <input
      type="date"
      disabled={disabled}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local === serverYmd) return;
        void onCommit(local);
      }}
      className={cn(
        "touch-manipulation rounded-md border border-slate-200 bg-white shadow-xs",
        "h-7 w-full min-w-[6.75rem] max-w-[7.5rem] px-1 py-0 text-[10px] leading-tight sm:text-[11px]"
      )}
      aria-label="Fecha prevista recepción"
    />
  );
}

export type ComprasMaterialColumnsContext = {
  onEdit: (row: ComprasMaterialTableRow) => void;
  onDelete: (row: ComprasMaterialTableRow) => void;
  onOpenRecepcionFotos: (row: ComprasMaterialTableRow) => void;
  proveedoresPapelCarton: { id: string; nombre: string }[];
  isRowCheckboxDisabled: (row: ComprasMaterialTableRow) => boolean;
  isSavingRow: (rowId: string) => boolean;
  onProveedorChange: (rowId: string, proveedorId: string) => void;
  onEstadoChange: (rowId: string, estado: string) => void;
  onFechaPrevistaCommit: (rowId: string, ymd: string) => void;
  umbralesOtsCompras: OtsComprasUmbralesParametros;
};

export function createComprasMaterialColumns(
  ctx: ComprasMaterialColumnsContext
): ColumnDef<ComprasMaterialTableRow>[] {
  return [
    {
      id: "select",
      size: 32,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const disabled = ctx.isRowCheckboxDisabled(row.original);
        return (
          <div className="flex justify-center px-0.5 py-0.5">
            <Checkbox
              checked={row.getIsSelected()}
              disabled={disabled}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
              aria-label={`Seleccionar compra ${row.original.num_compra}`}
            />
          </div>
        );
      },
    },
    {
      id: "acciones_edit",
      size: 44,
      enableSorting: false,
      header: () => <span className="sr-only">Editar</span>,
      cell: ({ row }) => (
        <div className="flex justify-center px-0.5 py-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0"
            onClick={() => ctx.onEdit(row.original)}
            aria-label={`Editar compra ${row.original.num_compra}`}
          >
            <Pencil className="size-3.5 text-[#002147]" aria-hidden />
          </Button>
        </div>
      ),
    },
    {
      id: "stock",
      size: 56,
      enableSorting: false,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Stock
        </span>
      ),
      cell: ({ row }) => {
        const f = row.original.fecha_entrega_maestro;
        const days = diasDesdeHastaFecha(f);
        const tooltipLabel = f?.trim()
          ? `Entrega OT: ${formatFechaEsCorta(f)}`
          : "Sin fecha de entrega en maestro";
        if (!f?.trim() || days === null) {
          return (
            <div className="flex justify-center px-0.5 py-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default text-[11px] text-muted-foreground">
                    —
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p>{tooltipLabel}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        }
        const um = ctx.umbralesOtsCompras.sobrestockUmbral;
        const amarillo = days > um;
        return (
          <div className="flex justify-center px-0.5 py-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1">
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      amarillo ? "bg-amber-400" : "bg-emerald-500"
                    )}
                    aria-hidden
                  />
                  {amarillo ? (
                    <span className="text-[9px] leading-none text-muted-foreground">
                      +{um}d
                    </span>
                  ) : null}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>{tooltipLabel}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
    {
      accessorKey: "ot_numero",
      sortingFn: (a, b) => {
        const na = Number(String(a.original.ot_numero ?? "").replace(/\D/g, ""));
        const nb = Number(String(b.original.ot_numero ?? "").replace(/\D/g, ""));
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a.original.ot_numero ?? "").localeCompare(
          String(b.original.ot_numero ?? ""), "es", { numeric: true }
        );
      },
      header: ({ column }) => (
        <ComprasSortHeader column={column} label="OT" title="Ordenar por número de OT" />
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 font-mono text-[11px]">
          {row.original.ot_numero?.trim() || "—"}
        </div>
      ),
      size: 96,
    },
    {
      accessorKey: "num_compra",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Nº compra
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 font-mono text-[11px]">
          {formatNumCompraCell(row.original.num_compra, row.original.ot_numero)}
        </div>
      ),
      size: 120,
    },
    {
      id: "posicion",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          P
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-center font-mono text-[11px]">
          {row.original.posicion ?? "1"}
        </div>
      ),
      size: 42,
    },
    {
      accessorKey: "material",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Material
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-[11px]">
          {row.original.material?.trim() ? row.original.material : "—"}
        </div>
      ),
    },
    {
      id: "gramaje",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Gramaje
        </span>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap px-1 py-0.5 text-center text-[11px] tabular-nums">
          {formatGramajeCell(row.original.gramaje)}
        </div>
      ),
      size: 64,
    },
    {
      accessorKey: "tamano_hoja",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Formato
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-[11px]">
          {row.original.tamano_hoja?.trim() ? row.original.tamano_hoja : "—"}
        </div>
      ),
    },
    {
      id: "hojas",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Netas / Brutas
        </span>
      ),
      cell: ({ row }) => {
        const n = row.original.num_hojas_netas;
        const b = row.original.num_hojas_brutas;
        return (
          <div className="whitespace-nowrap px-1 py-0.5 text-center text-[11px] tabular-nums">
            {n != null || b != null ? (
              <>
                {n ?? "—"} / {b ?? "—"}
              </>
            ) : (
              "—"
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "cliente",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Cliente
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-[11px] leading-snug">
          {row.original.cliente ?? "—"}
        </div>
      ),
    },
    {
      accessorKey: "titulo",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Título
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-[11px] leading-snug">
          {row.original.titulo ?? "—"}
        </div>
      ),
    },
    {
      id: "proveedor",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Proveedor
        </span>
      ),
      cell: ({ row }) => {
        const id = row.original.id;
        const saving = ctx.isSavingRow(id);
        const val = row.original.proveedor_id ?? "";
        return (
          <div className="min-w-0 px-0.5 py-0.5">
            <select
              className="h-7 w-full min-w-[5.5rem] max-w-[11rem] truncate rounded-md border border-slate-200 bg-white px-1 text-[10px] shadow-xs sm:text-[11px]"
              value={val}
              disabled={saving || ctx.proveedoresPapelCarton.length === 0}
              onChange={(e) => ctx.onProveedorChange(id, e.target.value)}
              aria-label={`Proveedor compra ${row.original.num_compra}`}
            >
              <option value="">— Sin asignar —</option>
              {ctx.proveedoresPapelCarton.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        );
      },
      size: 140,
    },
    {
      id: "fecha_prevista",
      accessorFn: (row) => row.fecha_prevista_recepcion ?? "",
      sortingFn: "alphanumeric",
      header: ({ column }) => (
        <ComprasSortHeader column={column} label="Fecha prevista" title="Ordenar por fecha prevista de recepción" />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center px-0.5 py-0.5">
          <InlineFechaPrevistaCompraCell
            rowId={row.original.id}
            isoValue={row.original.fecha_prevista_recepcion}
            disabled={ctx.isSavingRow(row.original.id)}
            onCommit={(ymd) => ctx.onFechaPrevistaCommit(row.original.id, ymd)}
          />
        </div>
      ),
      size: 108,
    },
    {
      id: "estado",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Estado
        </span>
      ),
      cell: ({ row }) => {
        const id = row.original.id;
        const saving = ctx.isSavingRow(id);
        const raw = (row.original.estado ?? "").trim();
        const normalized = raw.toLowerCase();
        const canonical = COMPRAS_MATERIAL_ESTADOS.find(
          (e) => e.toLowerCase() === normalized
        );
        const legacySynonym =
          normalized === "recepcionada"
            ? "Recibido"
            : normalized === "confirmada"
              ? "Confirmado"
              : null;
        const value =
          canonical ?? legacySynonym ?? (raw || "Pendiente");
        const isLegacy =
          Boolean(raw) && !canonical && !legacySynonym;
        return (
          <div className="min-w-0 px-0.5 py-0.5">
            <select
              className="h-7 w-full min-w-[6rem] max-w-[9.5rem] truncate rounded-md border border-slate-200 bg-white px-1 text-[10px] shadow-xs sm:text-[11px]"
              value={value}
              disabled={saving}
              onChange={(e) => ctx.onEstadoChange(id, e.target.value)}
              aria-label={`Estado compra ${row.original.num_compra}`}
            >
              {isLegacy ? (
                <option value={raw}>
                  {raw} (catálogo anterior)
                </option>
              ) : null}
              {COMPRAS_MATERIAL_ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        );
      },
      size: 132,
    },
    {
      accessorKey: "albaran_proveedor",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Albarán
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 font-mono text-[11px]">
          {row.original.albaran_proveedor?.trim()
            ? row.original.albaran_proveedor
            : "—"}
        </div>
      ),
      size: 120,
    },
    {
      id: "fotos_recepcion",
      size: 44,
      enableSorting: false,
      header: () => (
        <span className="text-[10px] font-normal uppercase tracking-wide text-slate-600">
          Fotos
        </span>
      ),
      cell: ({ row }) => {
        const urls = row.original.recepcion_foto_urls;
        if (!urls?.length) return <div className="h-6 min-h-6 w-full" />;
        return (
          <div className="flex min-h-6 items-center justify-center px-0.5 py-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 text-blue-800 hover:bg-blue-50 hover:text-blue-900"
              onClick={(e) => {
                e.stopPropagation();
                ctx.onOpenRecepcionFotos(row.original);
              }}
              aria-label={`Ver ${urls.length} foto${urls.length === 1 ? "" : "s"} de recepción, compra ${row.original.num_compra}`}
              title="Fotos de recepción en muelle"
            >
              <Camera className="size-4" strokeWidth={1.75} aria-hidden />
            </Button>
          </div>
        );
      },
    },
    {
      id: "eliminar",
      size: 44,
      enableSorting: false,
      header: () => <span className="sr-only">Eliminar</span>,
      cell: ({ row }) => (
        <div className="flex justify-center px-0.5 py-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => ctx.onDelete(row.original)}
            aria-label={`Eliminar compra ${row.original.num_compra}`}
            title="Eliminar línea de compra"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];
}
