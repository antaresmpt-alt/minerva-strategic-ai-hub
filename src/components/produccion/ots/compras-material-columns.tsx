"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import { COMPRAS_MATERIAL_ESTADOS } from "@/lib/compras-material-estados";
import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";
import { cn } from "@/lib/utils";

function formatGramajeCell(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  const s = Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
  return `${s}g`;
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
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          OT
        </span>
      ),
      cell: ({ row }) => (
        <div className="flex min-h-6 min-w-0 items-center px-0.5 py-0">
          <OtNumeroSemaforoBadge
            otNumero={row.original.ot_numero}
            fechaEntregaIso={row.original.fecha_entrega_maestro}
            umbrales={ctx.umbralesOtsCompras}
          />
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
          {row.original.num_compra || "—"}
        </div>
      ),
      size: 120,
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
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Fecha prevista
        </span>
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
      id: "acciones",
      size: 44,
      enableSorting: false,
      header: () => <span className="sr-only">Acciones</span>,
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
