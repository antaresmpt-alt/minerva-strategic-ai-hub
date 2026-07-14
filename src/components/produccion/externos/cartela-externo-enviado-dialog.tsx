"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { CartelaCierreBlock } from "@/components/produccion/planificacion/cartela-cierre-block";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConsumoExternoEnviadoContext } from "@/lib/cartela-consumo-externos";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";

type CartelaExternoEnviadoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string;
  context: ConsumoExternoEnviadoContext | null;
  datosDraft: DatosProcesoGenerico;
  onDatosChange: (datos: DatosProcesoGenerico) => void;
  onConfirm: () => void;
  saving: boolean;
};

export function CartelaExternoEnviadoDialog({
  open,
  onOpenChange,
  otNumero,
  context,
  datosDraft,
  onDatosChange,
  onConfirm,
  saving,
}: CartelaExternoEnviadoDialogProps) {
  const [localDatos, setLocalDatos] = useState(datosDraft);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setLocalDatos(datosDraft);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cartela al enviar a externo</DialogTitle>
          <DialogDescription>
            OT {otNumero} · Impresión externa. Indica el palet consumido antes de
            marcar como Enviado; el stock se descuenta al confirmar.
          </DialogDescription>
        </DialogHeader>

        {context ? (
          <CartelaCierreBlock
            key={open ? "open" : "closed"}
            otNumero={otNumero}
            procesoId={context.procesoId}
            datosDraft={localDatos}
            onDatosChange={(datos) => {
              setLocalDatos(datos);
              onDatosChange(datos);
            }}
          />
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Confirmar envío y descontar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
