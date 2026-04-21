"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Info, Pencil } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import type { OtsDespachadasTableRow } from "@/types/prod-ots-despachadas";
import { cn } from "@/lib/utils";

import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import { formatDateDDMMYY } from "@/components/produccion/ots/master-ots-table-helpers";

/** Datos «Tipo Excel» desde `prod_troqueles` (clave = `num_troquel` en minúsculas). */
export type TroquelExcelTooltip = {
  mides: string | null;
  num_figuras: string | null;
  descripcion: string | null;
};

function troquelExcelTooltipText(meta: TroquelExcelTooltip): string {
  const m = meta.mides?.trim() || "—";
  const f = meta.num_figuras?.trim() || "—";
  const d = meta.descripcion?.trim() || "—";
  return `Mides: ${m} | Figuras: ${f} | Descripción: ${d}`;
}

/**
 * Unifica textos de `estado_material` (despachadas / compras) para color y ojo.
 */
type BucketEstadoMaterial =
  | "sin_orden"
  | "naranja"
  | "azul"
  | "amarillo"
  | "verde"
  | "otro";

function bucketEstadoMaterial(estado: string | null | undefined): BucketEstadoMaterial {
  const n = (estado ?? "").trim().toLowerCase();
  if (!n) return "otro";
  if (n === "sin orden compra") return "sin_orden";
  if (n === "pendiente de pedir" || n === "pendiente") return "naranja";
  if (n === "orden compra generada" || n === "generada") return "azul";
  if (n === "compra confirmada" || n === "confirmada" || n === "confirmado")
    return "amarillo";
  if (n === "material recibido" || n === "recepcionada") return "verde";
  if (n === "material parcialmente recibido") return "amarillo";
  if (n === "compra cancelada") return "sin_orden";
  return "otro";
}

/** Misma cadena que en BD; colores según bucket + sinónimos. */
function estadoMaterialBadge(estado: string | null | undefined): {
  label: string;
  className: string;
} {
  const t = (estado ?? "").trim();
  if (!t) {
    return {
      label: "—",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }
  switch (bucketEstadoMaterial(estado)) {
    case "sin_orden":
      return {
        label: t,
        className: "border-slate-300 bg-slate-100 text-slate-800",
      };
    case "naranja":
      return {
        label: t,
        className: "border-orange-200 bg-orange-50 text-orange-950",
      };
    case "azul":
      return {
        label: t,
        className: "border-blue-200 bg-blue-50 text-blue-950",
      };
    case "amarillo":
      return {
        label: t,
        className: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "verde":
      return {
        label: t,
        className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      };
    default:
      return {
        label: t,
        className: "border-slate-200 bg-slate-50 text-slate-800",
      };
  }
}

/**
 * Ojo solo cuando hay datos útiles en compra (proveedor, fechas): generada, confirmada o recibida (+ sinónimos).
 * Oculto en «Sin orden compra», «Pendiente de pedir» / «Pendiente» y estados desconocidos.
 */
function mostrarBotonVerCompra(estado: string | null | undefined): boolean {
  const t = (estado ?? "").trim();
  if (!t) return false;
  const b = bucketEstadoMaterial(estado);
  return b === "azul" || b === "amarillo" || b === "verde";
}

function formatMaterialGramaje(
  material: string | null,
  gramaje: number | null
): string {
  const m = material?.trim();
  const gOk = gramaje != null && Number.isFinite(Number(gramaje));
  if (!m && !gOk) return "—";
  const gStr = gOk
    ? `${Number.isInteger(Number(gramaje)) ? String(Math.trunc(Number(gramaje))) : String(gramaje)}g`
    : "";
  if (!m) return gStr;
  return gStr ? `${m} ${gStr}` : m;
}

function formatHorasEt(
  entrada: number | null,
  tiraje: number | null
): string {
  const fmt = (n: number | null) => {
    if (n == null || !Number.isFinite(n)) return "—";
    const v = Number(n);
    const s = Number.isInteger(v) ? String(v) : String(v);
    return `${s}h`;
  };
  return `${fmt(entrada)} / ${fmt(tiraje)}`;
}

function OtsDespachadasSortHeader({
  column,
  label,
  title,
}: {
  column: Column<OtsDespachadasTableRow, unknown>;
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

export type OtsDespachadasColumnsContext = {
  onVerCompra: (row: OtsDespachadasTableRow) => void;
  onEditarDespacho: (row: OtsDespachadasTableRow) => void;
  troquelExcelByCodigo: Map<string, TroquelExcelTooltip>;
  /** true = checkbox deshabilitado (OT con gestión de compra ya iniciada). */
  isSeleccionCompraDeshabilitada: (row: OtsDespachadasTableRow) => boolean;
  umbralesOtsCompras: OtsComprasUmbralesParametros;
};

export function createOtsDespachadasColumns(
  ctx: OtsDespachadasColumnsContext
): ColumnDef<OtsDespachadasTableRow>[] {
  return [
    {
      id: "select",
      size: 36,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const disabled = ctx.isSeleccionCompraDeshabilitada(row.original);
        return (
          <div
            className={cn(
              "flex justify-center px-0.5 py-0.5",
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <Checkbox
              checked={row.getIsSelected()}
              disabled={disabled}
              className={cn(!disabled && "cursor-pointer")}
              onCheckedChange={(checked) =>
                row.toggleSelected(checked === true)
              }
              aria-label={`Seleccionar OT ${row.original.ot_numero}`}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "ot_numero",
      size: 96,
      sortingFn: (rowA, rowB) =>
        String(rowA.original.ot_numero ?? "").localeCompare(
          String(rowB.original.ot_numero ?? ""),
          "es",
          { numeric: true, sensitivity: "base" }
        ),
      header: ({ column }) => <OtsDespachadasSortHeader column={column} label="OT" />,
      cell: ({ row }) => (
        <div className="flex min-h-6 min-w-0 max-w-[9rem] items-center px-0.5 py-0">
          <OtNumeroSemaforoBadge
            otNumero={row.original.ot_numero}
            fechaEntregaIso={row.original.fecha_entrega_prevista}
            umbrales={ctx.umbralesOtsCompras}
          />
        </div>
      ),
    },
    {
      accessorKey: "cliente",
      size: 118,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Cliente
        </span>
      ),
      cell: ({ row }) => (
        <div className="max-w-[8rem] truncate px-1 py-0.5 text-[11px] leading-snug">
          {row.original.cliente ?? "—"}
        </div>
      ),
    },
    {
      accessorKey: "titulo",
      size: 248,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Título
        </span>
      ),
      cell: ({ row }) => {
        const r = row.original;
        const cod = r.troquel?.trim();
        const key = cod ? cod.toLowerCase() : "";
        const excel = key ? ctx.troquelExcelByCodigo.get(key) : undefined;
        const posesStr =
          r.poses != null && Number.isFinite(Number(r.poses))
            ? String(r.poses)
            : "";
        const showTech = Boolean(
          cod || posesStr || r.acabado_pral?.trim()
        );
        return (
          <div className="min-w-0 px-1 py-0.5 text-[11px] leading-snug">
            <div
              className="line-clamp-2 break-words text-foreground"
              title={r.titulo?.trim() ? r.titulo : undefined}
            >
              {r.titulo?.trim() ? r.titulo : "—"}
            </div>
            {showTech ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                {cod ? (
                  excel ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex max-w-[min(100%,11rem)] cursor-default items-center gap-0.5 rounded-sm px-0.5 hover:bg-slate-50">
                          <span className="shrink-0 rounded bg-slate-100 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                            Tr
                          </span>
                          <span className="truncate font-mono text-[10px] text-slate-700">
                            {cod}
                          </span>
                          <Info
                            className="h-3 w-3 shrink-0 text-slate-500"
                            aria-hidden
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        <p className="leading-snug">
                          {troquelExcelTooltipText(excel)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="inline-flex max-w-[min(100%,11rem)] items-center gap-0.5">
                      <span className="shrink-0 rounded bg-slate-100 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                        Tr
                      </span>
                      <span className="truncate font-mono text-[10px] text-slate-700">
                        {cod}
                      </span>
                    </span>
                  )
                ) : null}
                {posesStr ? (
                  <span className="shrink-0 tabular-nums">
                    <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-wide">
                      Pos
                    </span>
                    {posesStr}
                  </span>
                ) : null}
                {r.acabado_pral?.trim() ? (
                  <span
                    className="min-w-0 max-w-[6.5rem] truncate"
                    title={r.acabado_pral.trim()}
                  >
                    <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-wide">
                      Acb
                    </span>
                    {r.acabado_pral.trim()}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "material_gramaje",
      size: 132,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Material
        </span>
      ),
      cell: ({ row }) => (
        <div
          className="w-fit min-w-0 max-w-[11rem] truncate px-1 py-0.5 text-[11px]"
          title={formatMaterialGramaje(
            row.original.material,
            row.original.gramaje
          )}
        >
          {formatMaterialGramaje(row.original.material, row.original.gramaje)}
        </div>
      ),
    },
    {
      accessorKey: "tamano_hoja",
      size: 76,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Formato
        </span>
      ),
      cell: ({ row }) => (
        <div className="w-fit min-w-[3.5rem] max-w-[5rem] truncate px-0.5 py-0.5 text-center text-[11px]">
          {row.original.tamano_hoja?.trim() ? row.original.tamano_hoja : "—"}
        </div>
      ),
    },
    {
      id: "hojas",
      size: 88,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Netas / Brutas
        </span>
      ),
      cell: ({ row }) => {
        const n = row.original.num_hojas_netas;
        const b = row.original.num_hojas_brutas;
        return (
          <div className="w-fit min-w-[4.5rem] whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums">
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
      id: "horas_et",
      size: 80,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          E / T
        </span>
      ),
      cell: ({ row }) => (
        <div
          className="w-fit min-w-[4.25rem] whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-800"
          title="Entrada / Tiraje"
        >
          {formatHorasEt(
            row.original.horas_entrada,
            row.original.horas_tiraje
          )}
        </div>
      ),
    },
    {
      accessorKey: "fecha_entrega_prevista",
      size: 86,
      sortingFn: (rowA, rowB) => {
        const av = rowA.original.fecha_entrega_prevista;
        const bv = rowB.original.fecha_entrega_prevista;
        const at = av ? new Date(av).getTime() : Number.NEGATIVE_INFINITY;
        const bt = bv ? new Date(bv).getTime() : Number.NEGATIVE_INFINITY;
        return at - bt;
      },
      header: ({ column }) => (
        <OtsDespachadasSortHeader
          column={column}
          label="Entrega prev."
          title="Ordenar por fecha de entrega prevista"
        />
      ),
      cell: ({ row }) => (
        <div className="w-fit min-w-[4.5rem] whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-700">
          {formatDateDDMMYY(row.original.fecha_entrega_prevista)}
        </div>
      ),
    },
    {
      accessorKey: "despachado_at",
      size: 86,
      sortingFn: (rowA, rowB) => {
        const av = rowA.original.despachado_at;
        const bv = rowB.original.despachado_at;
        const at = av ? new Date(av).getTime() : Number.NEGATIVE_INFINITY;
        const bt = bv ? new Date(bv).getTime() : Number.NEGATIVE_INFINITY;
        return at - bt;
      },
      header: ({ column }) => (
        <OtsDespachadasSortHeader
          column={column}
          label="Despacho"
          title="Ordenar por fecha de despacho"
        />
      ),
      cell: ({ row }) => (
        <div className="w-fit min-w-[4.5rem] whitespace-nowrap px-0.5 py-0.5 text-center text-[11px] tabular-nums text-slate-700">
          {formatDateDDMMYY(row.original.despachado_at)}
        </div>
      ),
    },
    {
      accessorKey: "estado_material",
      size: 172,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Estado material
        </span>
      ),
      cell: ({ row }) => {
        const { label, className } = estadoMaterialBadge(
          row.original.estado_material
        );
        const verCompra = mostrarBotonVerCompra(row.original.estado_material);
        return (
          <div className="flex min-w-0 items-center justify-start gap-1 px-0.5 py-0.5">
            <Badge
              variant="outline"
              className={cn(
                "max-w-[9rem] shrink truncate text-[10px] font-medium",
                className
              )}
            >
              {label}
            </Badge>
            {verCompra ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-slate-600 hover:text-[#002147]"
                aria-label={`Ver compra de material OT ${row.original.ot_numero}`}
                onClick={() => ctx.onVerCompra(row.original)}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "acciones",
      size: 52,
      enableSorting: false,
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Acc.
        </span>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center px-0.5 py-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-slate-600 hover:text-[#002147]"
            aria-label={`Editar despacho OT ${row.original.ot_numero}`}
            onClick={() => ctx.onEditarDespacho(row.original)}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];
}
