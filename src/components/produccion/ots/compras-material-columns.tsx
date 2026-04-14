"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateDDMMYY } from "@/components/produccion/ots/master-ots-table-helpers";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";
import { cn } from "@/lib/utils";

function formatGramajeCell(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  const s = Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
  return `${s}g`;
}

function estadoCompraBadgeClass(estado: string | null | undefined): {
  label: string;
  className: string;
} {
  const t = (estado ?? "").trim();
  const n = t.toLowerCase();
  if (!t) {
    return {
      label: "—",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }
  if (n === "pendiente") {
    return {
      label: t,
      className: "border-slate-300 bg-slate-100 text-slate-800",
    };
  }
  if (n === "generada") {
    return {
      label: t,
      className: "border-blue-200 bg-blue-50 text-blue-950",
    };
  }
  if (n === "confirmada") {
    return {
      label: t,
      className: "border-amber-200 bg-amber-50 text-amber-950",
    };
  }
  if (n === "recepcionada") {
    return {
      label: t,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  return {
    label: t,
    className: "border-slate-200 bg-slate-50 text-slate-800",
  };
}

export type ComprasMaterialColumnsContext = {
  onEdit: (row: ComprasMaterialTableRow) => void;
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
      cell: ({ row, table }) => (
        <div className="flex justify-center px-0.5 py-0.5">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => {
              if (checked) {
                table.setRowSelection({ [row.id]: true });
              } else {
                table.setRowSelection({});
              }
            }}
            aria-label={`Seleccionar compra ${row.original.num_compra}`}
          />
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
        const amarillo = days > 30;
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
                      +30d
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
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          OT
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 font-mono text-[11px] font-medium text-[#002147]">
          {row.original.ot_numero}
        </div>
      ),
      size: 80,
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
          {row.original.num_compra || "—"}
        </div>
      ),
      size: 120,
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
      accessorKey: "proveedor_nombre",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Proveedor
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-[11px]">
          {row.original.proveedor_nombre?.trim()
            ? row.original.proveedor_nombre
            : "—"}
        </div>
      ),
    },
    {
      accessorKey: "fecha_prevista_recepcion",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Fecha prevista
        </span>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-700">
          {formatDateDDMMYY(row.original.fecha_prevista_recepcion)}
        </div>
      ),
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
    },
    {
      accessorKey: "estado",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Estado
        </span>
      ),
      cell: ({ row }) => {
        const { label, className } = estadoCompraBadgeClass(row.original.estado);
        return (
          <div className="px-0.5 py-0.5">
            <Badge
              variant="outline"
              className={cn(
                "max-w-full truncate text-[10px] font-medium",
                className
              )}
            >
              {label}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "acciones",
      size: 44,
      enableSorting: false,
      header: () => (
        <span className="sr-only">Acciones</span>
      ),
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
  ];
}
