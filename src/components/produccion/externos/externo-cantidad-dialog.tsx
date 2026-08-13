"use client";

import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import type { ExternoCantidadModo, ExternoEnvioBrief } from "@/lib/externos-envio-brief";

type ExternoCantidadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: ExternoCantidadModo;
  otNumero: string;
  procesoNombre?: string | null;
  proveedorNombre?: string | null;
  acabadoNombre?: string | null;
  brief: ExternoEnvioBrief | null;
  briefLoading: boolean;
  hojas: string;
  palets: string;
  observaciones: string;
  onHojasChange: (v: string) => void;
  onPaletsChange: (v: string) => void;
  onObservacionesChange: (v: string) => void;
  onConfirm: () => void;
  saving: boolean;
};

export function ExternoCantidadDialog({
  open,
  onOpenChange,
  modo,
  otNumero,
  procesoNombre,
  proveedorNombre,
  acabadoNombre,
  brief,
  briefLoading,
  hojas,
  palets,
  observaciones,
  onHojasChange,
  onPaletsChange,
  onObservacionesChange,
  onConfirm,
  saving,
}: ExternoCantidadDialogProps) {
  const isEnvio = modo === "enviado";
  const title = isEnvio ? "Confirmar envío a externo" : "Confirmar recepción";
  const hojasLabel = isEnvio ? "Hojas enviadas" : "Hojas recibidas";

  const meta = [procesoNombre, proveedorNombre, acabadoNombre].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            OT {otNumero}
            {meta ? ` · ${meta}` : ""}
          </DialogDescription>
        </DialogHeader>

        {briefLoading ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" />
            Cargando datos de la OT…
          </p>
        ) : brief && (brief.formato || brief.material || brief.tintas) ? (
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
            <p className="mb-1 font-semibold text-[#002147]">Datos del envío</p>
            {brief.formato ? (
              <p>
                <span className="font-medium">Formato:</span> {brief.formato}
                {brief.formatoOrigen ? (
                  <span className="text-slate-500"> · {brief.formatoOrigen}</span>
                ) : null}
              </p>
            ) : null}
            {brief.material ? (
              <p>
                <span className="font-medium">Papel:</span> {brief.material}
              </p>
            ) : null}
            {brief.tintas ? (
              <p>
                <span className="font-medium">Tintas:</span> {brief.tintas}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ext-cant-hojas">{hojasLabel} *</Label>
            <Input
              id="ext-cant-hojas"
              inputMode="numeric"
              value={hojas}
              onChange={(e) => onHojasChange(e.target.value)}
              placeholder="ej. 1100"
              autoFocus
            />
            {brief?.hojasSugeridas != null && brief.hojasSugeridasOrigen ? (
              <p className="text-[11px] text-slate-500">
                Sugerido: {brief.hojasSugeridas.toLocaleString("es-ES")} (
                {brief.hojasSugeridasOrigen})
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-cant-palets">Palets (opcional)</Label>
            <Input
              id="ext-cant-palets"
              inputMode="numeric"
              value={palets}
              onChange={(e) => onPaletsChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-cant-obs">Observaciones (opcional)</Label>
            <Textarea
              id="ext-cant-obs"
              value={observaciones}
              onChange={(e) => onObservacionesChange(e.target.value)}
              className="min-h-[56px]"
              placeholder={isEnvio ? "Notas de envío…" : "Merma, incidencias…"}
            />
          </div>
        </div>

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
            {isEnvio ? "Confirmar envío" : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
