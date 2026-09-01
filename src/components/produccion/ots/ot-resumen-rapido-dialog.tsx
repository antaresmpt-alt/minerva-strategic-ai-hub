"use client";

import { Loader2, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { HojaRutaOtDialog } from "@/components/produccion/hoja-ruta/hoja-ruta-ot-dialog";
import { STEP_BADGE_STYLES } from "@/components/produccion/hoja-ruta/hoja-ruta-step-styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { fetchOtResumenRapido } from "@/lib/ot-resumen-rapido";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CalendarioProduccionOtDetalle } from "@/types/prod-calendario-produccion-ot";
import { cn } from "@/lib/utils";

type Props = {
  otNumero: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Enlace opcional a hoja de ruta completa (como en calendario). */
  showHojaRutaLink?: boolean;
};

export function OtResumenRapidoDialog({
  otNumero,
  open,
  onOpenChange,
  showHojaRutaLink = true,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [detalle, setDetalle] = useState<CalendarioProduccionOtDetalle | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [hojaRutaOpen, setHojaRutaOpen] = useState(false);
  const [hojaRutaOt, setHojaRutaOt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ot = String(otNumero ?? "").trim();
    if (!ot) {
      setDetalle(null);
      return;
    }
    setLoading(true);
    setDetalle(null);
    try {
      const data = await fetchOtResumenRapido(supabase, ot);
      setDetalle(data);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el resumen."));
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [supabase, otNumero, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  return (
    <>
      <HojaRutaOtDialog
        otNumero={hojaRutaOt}
        open={hojaRutaOpen}
        onOpenChange={setHojaRutaOpen}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              OT{" "}
              <span className="font-mono text-[#002147]">
                {detalle?.otNumero ?? otNumero ?? "…"}
              </span>
            </DialogTitle>
            <DialogDescription>
              Resumen rápido · itinerario con colores de estado.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Cargando…
            </div>
          ) : detalle ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-sm font-semibold text-slate-800">
                  {detalle.cliente ?? "—"} · {detalle.trabajo ?? "—"}
                </div>
                <div className="mt-1.5 grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
                  <div>
                    <span className="font-medium">Cantidad:</span>{" "}
                    {detalle.cantidad != null
                      ? detalle.cantidad.toLocaleString("es-ES")
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Entrega:</span>{" "}
                    {detalle.fechaEntrega
                      ? formatFechaEsCorta(detalle.fechaEntrega)
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Estado OT:</span>{" "}
                    {detalle.estadoOt ?? "—"}
                  </div>
                </div>
                {(detalle.material || detalle.tamanoHoja) && (
                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    {detalle.material ? (
                      <span>
                        <span className="font-medium">Material:</span>{" "}
                        {detalle.material}
                        {detalle.gramaje != null
                          ? ` ${detalle.gramaje}g`
                          : ""}
                      </span>
                    ) : null}
                    {detalle.tamanoHoja ? (
                      <span className={detalle.material ? " ml-3" : undefined}>
                        <span className="font-medium">Formato:</span>{" "}
                        {detalle.tamanoHoja}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {detalle.pasos.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Itinerario
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {detalle.pasos.map((p, i) => (
                      <span
                        key={`${p.orden}-${i}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          STEP_BADGE_STYLES[p.estado] ??
                            STEP_BADGE_STYLES.pendiente,
                        )}
                        title={`${p.orden} · ${p.nombre} · ${p.estado}`}
                      >
                        <Route className="size-3" aria-hidden />
                        {p.orden} · {p.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Sin itinerario en Minerva (OT no despachada o sin pasos).
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos.</p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {showHojaRutaLink ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!detalle?.otNumero}
                onClick={() => {
                  if (!detalle?.otNumero) return;
                  setHojaRutaOt(detalle.otNumero);
                  onOpenChange(false);
                  setHojaRutaOpen(true);
                }}
              >
                Ver hoja de ruta
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
