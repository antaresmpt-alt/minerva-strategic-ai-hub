"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Pencil, Truck } from "lucide-react";

import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import type { ProdOtsGeneralRow } from "@/types/prod-ots";
import { cn } from "@/lib/utils";

import {
  formatDateDDMMYY,
  statusBadge,
} from "@/components/produccion/ots/master-ots-table-helpers";

export type MasterOtsColumnsContext = {
  rowHasExterno: (r: ProdOtsGeneralRow) => boolean;
  openEdit: (r: ProdOtsGeneralRow) => void;
  umbralesOtsCompras: OtsComprasUmbralesParametros;
};

export function createMasterOtsColumns(
  ctx: MasterOtsColumnsContext
): ColumnDef<ProdOtsGeneralRow>[] {
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
            aria-label={`Seleccionar OT ${row.original.num_pedido}`}
          />
        </div>
      ),
    },
    {
      id: "ext",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Ext.
        </span>
      ),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="px-0.5 py-0.5 align-middle">
            {ctx.rowHasExterno(r) ? (
              <span
                title="OT en seguimiento externo"
                className="mx-auto flex size-7 items-center justify-center rounded-md border border-blue-100 bg-blue-50/90"
              >
                <Truck
                  className="size-4 text-blue-600"
                  aria-label="OT en seguimiento externo"
                />
              </span>
            ) : (
              <span className="text-muted-foreground flex h-7 items-center justify-center">
                —
              </span>
            )}
          </div>
        );
      },
      size: 36,
    },
    {
      accessorKey: "num_pedido",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          OT
        </span>
      ),
      cell: ({ row }) => (
        <div className="flex min-h-6 min-w-0 items-center justify-center px-0.5 py-0">
          <OtNumeroSemaforoBadge
            otNumero={String(row.original.num_pedido ?? "").trim()}
            fechaEntregaIso={row.original.fecha_entrega}
            umbrales={ctx.umbralesOtsCompras}
          />
        </div>
      ),
      size: 104,
    },
    {
      id: "despachado",
      size: 40,
      header: () => (
        <div className="text-[10px] font-semibold uppercase tracking-wide">
          D
        </div>
      ),
      cell: ({ row }) => {
        const d = row.original.despachado;
        return (
          <div className="flex justify-center px-0.5 py-0.5">
            {d === true ? (
              <Check className="mx-auto h-4 w-4 text-green-500" aria-hidden />
            ) : (
              <span className="text-muted-foreground mx-auto">-</span>
            )}
          </div>
        );
      },
    },
    {
      id: "estado",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Estado
        </span>
      ),
      cell: ({ row }) => {
        const r = row.original;
        const st = statusBadge(r);
        const Icon = st.icon;
        return (
          <div className="px-0.5 py-0.5 align-middle">
            <span
              className={cn(
                "inline-flex max-w-full items-center rounded-md border px-1 py-0.5 text-[10px] font-medium leading-tight",
                st.className
              )}
            >
              {Icon ? (
                <Icon className="size-3 shrink-0 opacity-90" />
              ) : null}
              <span className="min-w-0 truncate">{st.label}</span>
            </span>
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
      accessorKey: "pedido_cliente",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Ped. cli.
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 font-mono text-[10px] leading-snug">
          {row.original.pedido_cliente?.trim()
            ? row.original.pedido_cliente
            : "—"}
        </div>
      ),
    },
    {
      accessorKey: "cantidad",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Cant.
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-0.5 py-0.5 text-right tabular-nums text-[11px]">
          {row.original.cantidad ?? "—"}
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
      accessorKey: "fecha_apertura",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Apert.
        </span>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-700">
          {formatDateDDMMYY(row.original.fecha_apertura)}
        </div>
      ),
    },
    {
      accessorKey: "fecha_entrega",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Entr.
        </span>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-700">
          {formatDateDDMMYY(row.original.fecha_entrega)}
        </div>
      ),
    },
    {
      accessorKey: "vendedor",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Vendedor
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-1 py-0.5 text-[11px] leading-snug">
          {row.original.vendedor?.trim() ? row.original.vendedor : "—"}
        </div>
      ),
    },
    {
      accessorKey: "prueba_color",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Prueba col.
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-0.5 py-0.5 text-center text-[10px]">
          {row.original.prueba_color?.trim() ? row.original.prueba_color : "—"}
        </div>
      ),
    },
    {
      accessorKey: "pdf_ok",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          PDF ok
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-0.5 py-0.5 text-center text-[10px]">
          {row.original.pdf_ok?.trim() ? row.original.pdf_ok : "—"}
        </div>
      ),
    },
    {
      accessorKey: "muestra_ok",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Muestra
        </span>
      ),
      cell: ({ row }) => (
        <div className="truncate px-0.5 py-0.5 text-center text-[10px]">
          {row.original.muestra_ok?.trim() ? row.original.muestra_ok : "—"}
        </div>
      ),
    },
    {
      id: "edit",
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Ed.
        </span>
      ),
      cell: ({ row }) => (
        <div className="px-0 py-0.5 text-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label="Editar OT"
            onClick={() => ctx.openEdit(row.original)}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      ),
      size: 32,
    },
  ];
}
