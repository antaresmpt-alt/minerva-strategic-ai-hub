"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { OtsDespachadasTableRow } from "@/types/prod-ots-despachadas";
import { cn } from "@/lib/utils";

import { formatDateDDMMYY } from "@/components/produccion/ots/master-ots-table-helpers";

function estadoMaterialBadge(estado: string | null | undefined): {
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
  /** Valores previstos: Material recibido, Material pedido, Orden compra generada, Sin orden compra */
  if (n.includes("recibido")) {
    return {
      label: t,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (n.includes("material pedido") || (n.includes("pedido") && !n.includes("orden"))) {
    return {
      label: t,
      className: "border-amber-200 bg-amber-50 text-amber-950",
    };
  }
  if (n.includes("generada") || n.includes("orden compra")) {
    return {
      label: t,
      className: "border-blue-200 bg-blue-50 text-blue-950",
    };
  }
  if (n.includes("sin orden")) {
    return {
      label: t,
      className: "border-slate-300 bg-slate-100 text-slate-700",
    };
  }
  return {
    label: t,
    className: "border-slate-200 bg-slate-50 text-slate-800",
  };
}

export function createOtsDespachadasColumns(): ColumnDef<OtsDespachadasTableRow>[] {
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
            aria-label={`Seleccionar OT ${row.original.ot_numero}`}
          />
        </div>
      ),
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
      accessorKey: "fecha_entrega_prevista",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Entrega prev.
        </span>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-700">
          {formatDateDDMMYY(row.original.fecha_entrega_prevista)}
        </div>
      ),
    },
    {
      accessorKey: "estado_material",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Estado material
        </span>
      ),
      cell: ({ row }) => {
        const { label, className } = estadoMaterialBadge(
          row.original.estado_material
        );
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
  ];
}
