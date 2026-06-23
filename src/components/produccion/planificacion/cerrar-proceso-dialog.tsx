"use client";

import { Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import {
  formatHorasEjecucionLabel,
  getCerrarProcesoHourFields,
  roundHorasEjecucion,
  sumHorasDeclaradasDatosProceso,
} from "@/lib/planificacion-ejecucion-horas";

type CerrarProcesoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string;
  procesoNombre: string | null;
  procesoId: number | null;
  horasMesa: number | null;
  minutosPausa: number;
  datosDraft: DatosProcesoGenerico;
  onDatosChange: (datos: DatosProcesoGenerico) => void;
  onUsarTiempoMesa: () => void;
  onConfirm: () => void;
  saving: boolean;
};

export function CerrarProcesoDialog({
  open,
  onOpenChange,
  otNumero,
  procesoNombre,
  procesoId,
  horasMesa,
  minutosPausa,
  datosDraft,
  onDatosChange,
  onUsarTiempoMesa,
  onConfirm,
  saving,
}: CerrarProcesoDialogProps) {
  const fields = getCerrarProcesoHourFields(procesoId);
  const declaradas = sumHorasDeclaradasDatosProceso(procesoId, datosDraft);

  const updateField = (fieldId: string, raw: string) => {
    const parsed = Number(raw.replace(",", "."));
    const value = Number.isFinite(parsed) && parsed >= 0 ? roundHorasEjecucion(parsed) : undefined;
    onDatosChange({ ...datosDraft, [fieldId]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar proceso</DialogTitle>
          <DialogDescription>
            OT {otNumero}
            {procesoNombre ? ` · ${procesoNombre}` : ""}. Revisa las horas reales antes de
            finalizar el paso.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-[#002147]" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-[#002147]">Tiempo mesa (reloj)</p>
              <p className="text-slate-700">
                {formatHorasEjecucionLabel(horasMesa)}
                {minutosPausa > 0 ? (
                  <span className="text-slate-500"> · Pausas descontadas: {minutosPausa} min</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Calculado desde inicio real − pausas. No editable (auditoría).
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-semibold text-[#002147]">Horas reales declaradas</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={horasMesa == null || horasMesa <= 0}
              onClick={onUsarTiempoMesa}
            >
              Usar tiempo mesa
            </Button>
          </div>
          {fields.map((f) => (
            <div key={f.id}>
              <Label htmlFor={`cerrar-${f.id}`} className="text-xs text-slate-600">
                {f.label}
              </Label>
              <Input
                id={`cerrar-${f.id}`}
                type="number"
                min={0}
                step={0.05}
                className="mt-1"
                value={
                  datosDraft[f.id] != null && datosDraft[f.id] !== ""
                    ? String(datosDraft[f.id])
                    : ""
                }
                onChange={(e) => updateField(f.id, e.target.value)}
              />
            </div>
          ))}
          {declaradas != null ? (
            <p className="text-xs text-slate-600">
              Total declarado: <span className="font-semibold">{formatHorasEjecucionLabel(declaradas)}</span>
              {horasMesa != null && horasMesa > 0 && declaradas !== horasMesa ? (
                <span className="ml-1 text-amber-700">
                  (Δ reloj {declaradas >= horasMesa ? "+" : ""}
                  {formatHorasEjecucionLabel(Math.abs(declaradas - horasMesa))})
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving || declaradas == null || declaradas <= 0}
            onClick={onConfirm}
          >
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Confirmar y finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
