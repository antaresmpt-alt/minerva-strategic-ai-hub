"use client";

import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import type { OtsDespachadasTableRow } from "@/types/prod-ots-despachadas";

export type CompraDetalleVista = {
  proveedor: string;
  num_compra: string;
  fecha_solicitud: string | null;
  fecha_prevista: string | null;
  albaran: string | null;
  estado: string | null;
};

function detalleField(label: string, value: string) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm leading-snug text-foreground">{value}</span>
    </div>
  );
}

function formatGramajeG(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(Number(g))) return "—";
  const n = Number(g);
  const s = Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
  return `${s}g`;
}

function formatCantidadBruta(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Math.trunc(Number(n))} hojas`;
}

type DetallesCompraDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compraOt: string;
  /** Etiqueta de tabla para la descripción (p. ej. `prod_compra_material`). */
  tablaCompraMaterial: string;
  compraLoading: boolean;
  compraDetalle: CompraDetalleVista | null;
  /** Fila de despacho al abrir el diálogo (material, gramaje, formato, brutas). */
  despachoRow: OtsDespachadasTableRow | null;
};

export function DetallesCompraDialog({
  open,
  onOpenChange,
  compraOt,
  tablaCompraMaterial,
  compraLoading,
  compraDetalle,
  despachoRow,
}: DetallesCompraDialogProps) {
  const tecnico = despachoRow ? (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 py-3 sm:px-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#002147]">
        Datos técnicos del pedido
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
        {detalleField(
          "Material solicitado",
          despachoRow.material?.trim() ? despachoRow.material.trim() : "—"
        )}
        {detalleField("Gramaje", formatGramajeG(despachoRow.gramaje))}
        {detalleField(
          "Formato",
          despachoRow.tamano_hoja?.trim() ? despachoRow.tamano_hoja.trim() : "—"
        )}
        {detalleField(
          "Cantidad Bruta",
          formatCantidadBruta(despachoRow.num_hojas_brutas)
        )}
      </div>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="text-base">Detalles de Compra</DialogTitle>
          <DialogDescription className="text-xs">
            OT{" "}
            <span className="font-mono font-semibold text-[#002147]">
              {compraOt || "—"}
            </span>{" "}
            · {tablaCompraMaterial}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,480px)] overflow-y-auto px-4 py-3 sm:px-5">
          {compraLoading ? (
            <div className="space-y-4">
              <div className="flex justify-center py-6">
                <Loader2 className="size-8 animate-spin text-slate-400" />
              </div>
              {tecnico}
            </div>
          ) : !compraDetalle ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm leading-snug">
                No hay registro de compra de material para esta OT.
              </p>
              {tecnico}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Pedido comercial
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {detalleField("Proveedor", compraDetalle.proveedor)}
                  {detalleField("Nº Compra", compraDetalle.num_compra)}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Envío y recepción
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {detalleField(
                    "Fecha solicitud",
                    compraDetalle.fecha_solicitud
                      ? formatFechaEsCorta(compraDetalle.fecha_solicitud)
                      : "—"
                  )}
                  {detalleField(
                    "Fecha prevista",
                    compraDetalle.fecha_prevista
                      ? formatFechaEsCorta(compraDetalle.fecha_prevista)
                      : "—"
                  )}
                  {detalleField(
                    "Albarán",
                    compraDetalle.albaran?.trim()
                      ? compraDetalle.albaran
                      : "—"
                  )}
                  {detalleField(
                    "Estado",
                    compraDetalle.estado?.trim()
                      ? compraDetalle.estado
                      : "—"
                  )}
                </div>
              </div>

              {tecnico}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
