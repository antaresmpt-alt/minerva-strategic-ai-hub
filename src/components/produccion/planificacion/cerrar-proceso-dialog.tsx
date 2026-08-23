"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { CartelaCierreBlock } from "@/components/produccion/planificacion/cartela-cierre-block";
import {
  nombreProcesoConsumoMaterial,
  procesoEsCandidatoConsumoMaterial,
  procesoUsaCartela,
  resolvePrimerProcesoConsumoMaterial,
  type PasoItinerarioConsumo,
} from "@/lib/cartela-ejecucion";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import {
  formatHorasEjecucionLabel,
  getCerrarProcesoHourFields,
  roundHorasEjecucion,
  sumHorasDeclaradasDatosProceso,
} from "@/lib/planificacion-ejecucion-horas";
import { cartelaConsumoCompleto } from "@/lib/cartela-stock-consumo";

type CerrarProcesoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string;
  procesoNombre: string | null;
  procesoId: number | null;
  pasosItinerario?: PasoItinerarioConsumo[] | null;
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
  pasosItinerario,
  horasMesa,
  minutosPausa,
  datosDraft,
  onDatosChange,
  onUsarTiempoMesa,
  onConfirm,
  saving,
}: CerrarProcesoDialogProps) {
  const [cartelasOtCount, setCartelasOtCount] = useState(0);
  const fields = getCerrarProcesoHourFields(procesoId);
  const declaradas = sumHorasDeclaradasDatosProceso(procesoId, datosDraft);
  const muestraCartela = procesoUsaCartela(procesoId, pasosItinerario);
  const cartelaObligatoria = muestraCartela && cartelasOtCount > 0;
  const cartelaCompleta = cartelaConsumoCompleto(datosDraft);
  const faltaCartela = cartelaObligatoria && !cartelaCompleta;
  const primerConsumoId = resolvePrimerProcesoConsumoMaterial(pasosItinerario ?? []);
  const esCandidatoSinConsumo =
    procesoEsCandidatoConsumoMaterial(procesoId) &&
    !muestraCartela &&
    primerConsumoId != null &&
    primerConsumoId !== procesoId;

  const updateField = (fieldId: string, n: number | undefined) => {
    const value =
      n != null && Number.isFinite(n) && n >= 0
        ? roundHorasEjecucion(n)
        : undefined;
    onDatosChange({ ...datosDraft, [fieldId]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
                Calculado desde inicio real − pausas. Referencia de auditoría.
                Usa «Usar tiempo mesa» solo si quieres copiar el reloj a las horas
                declaradas.
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
              <DecimalInput
                id={`cerrar-${f.id}`}
                min={0}
                step={0.05}
                className="mt-1"
                value={
                  typeof datosDraft[f.id] === "number" &&
                  Number.isFinite(datosDraft[f.id] as number)
                    ? (datosDraft[f.id] as number)
                    : undefined
                }
                onValueChange={(n) => updateField(f.id, n)}
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

        {esCandidatoSinConsumo ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            El consumo de material se registra al cerrar{" "}
            <span className="font-semibold text-slate-800">
              {nombreProcesoConsumoMaterial(primerConsumoId)}
            </span>
            . No repitas cartela en este paso.
          </p>
        ) : null}

        {muestraCartela ? (
          <>
            {faltaCartela ? (
              <p className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <strong>Cartela obligatoria.</strong> Esta OT tiene{" "}
                  {cartelasOtCount === 1 ? "una cartela asignada" : `${cartelasOtCount} cartelas asignadas`}.
                  Indica ID Stock y hojas consumidas antes de cerrar; si no, no se descontará stock
                  y tendrás que corregirlo después desde la hoja de ruta.
                </span>
              </p>
            ) : null}
            <CartelaCierreBlock
              key={open ? "open" : "closed"}
              otNumero={otNumero}
              procesoId={procesoId}
              datosDraft={datosDraft}
              onDatosChange={onDatosChange}
              obligatorio={cartelaObligatoria}
              onCartelasOtCount={setCartelasOtCount}
            />
          </>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving || declaradas == null || declaradas <= 0 || faltaCartela}
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
