"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessageFromUnknown } from "@/lib/error-message";
import {
  fetchMaestroOtDetalle,
  labelItinerarioEtiquetas,
  type EtiquetasPoolOtDetalle,
} from "@/lib/etiquetas-pool-entrada";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function DetalleRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-slate-100 py-1.5 text-xs last:border-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

export function EtiquetasPoolOtDetailDialog({
  open,
  onOpenChange,
  otNumero,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<EtiquetasPoolOtDetalle | null>(null);

  useEffect(() => {
    if (!open || !otNumero) {
      setDetalle(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchMaestroOtDetalle(supabase, otNumero)
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setError(`No se encontró la OT ${otNumero} en maestro.`);
          setDetalle(null);
          return;
        }
        setDetalle(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessageFromUnknown(e, "No se pudo cargar el detalle."));
        setDetalle(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, otNumero, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-[#002147]">
            OT {otNumero ?? "—"}
          </DialogTitle>
          <DialogDescription>
            Datos del maestro Optimus (solo lectura).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {error}
          </p>
        ) : detalle ? (
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto pr-1">
            <DetalleRow label="Cliente" value={detalle.cliente?.trim() || "—"} />
            <DetalleRow label="Trabajo" value={detalle.trabajo?.trim() || "—"} />
            <DetalleRow
              label="Cantidad"
              value={
                detalle.cantidad != null
                  ? Number(detalle.cantidad).toLocaleString("es-ES")
                  : "—"
              }
            />
            <DetalleRow
              label="Entrega"
              value={
                detalle.fechaEntrega
                  ? formatFechaEsCorta(detalle.fechaEntrega)
                  : "—"
              }
            />
            <DetalleRow
              label="Apertura"
              value={
                detalle.fechaApertura
                  ? formatFechaEsCorta(detalle.fechaApertura)
                  : "—"
              }
            />
            <DetalleRow label="Estado" value={detalle.estadoDesc?.trim() || "—"} />
            <DetalleRow label="Tipo" value={detalle.tipoPedido?.trim() || "—"} />
            <DetalleRow label="Familia" value={detalle.familia?.trim() || "—"} />
            <DetalleRow label="Vendedor" value={detalle.vendedor?.trim() || "—"} />
            <DetalleRow
              label="Pedido cli."
              value={detalle.pedidoCliente?.trim() || "—"}
            />
            <DetalleRow
              label="Itinerario"
              value={
                <Badge variant="outline" className="h-5 text-[10px]">
                  {labelItinerarioEtiquetas(detalle.itinerario)}
                </Badge>
              }
            />
            <DetalleRow
              label="Despacho"
              value={
                detalle.despachada ? (
                  <span>
                    Despachada
                    {detalle.materialDespacho ? ` · ${detalle.materialDespacho}` : ""}
                  </span>
                ) : (
                  "Sin despachar"
                )
              }
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
