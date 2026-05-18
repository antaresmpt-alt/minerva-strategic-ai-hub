"use client";

import { Pencil } from "lucide-react";

import { EtiquetasHojaRutaMaquinaButtons } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-maquina-buttons";
import { EntregaPlazoSemaforo } from "@/components/produccion/etiquetas-digital/entrega-plazo-semaforo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MaquinaHojaRutaField } from "@/lib/etiquetas-hoja-ruta-maquina";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

type Props = {
  row: ProdEtiquetasHojaRutaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  togglingMaquina: string | null;
  onToggleMaquina: (
    row: ProdEtiquetasHojaRutaRow,
    field: MaquinaHojaRutaField,
    next: boolean
  ) => void;
  onEdit: (row: ProdEtiquetasHojaRutaRow) => void;
};

export function EtiquetasHojaRutaMuelleDialog({
  row,
  open,
  onOpenChange,
  togglingMaquina,
  onToggleMaquina,
  onEdit,
}: Props) {
  if (!row) return null;

  const cantidadLabel =
    row.cantidad != null && Number(row.cantidad) > 0
      ? Number(row.cantidad).toLocaleString("es-ES")
      : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-heading text-[#002147]">
            <span>OT {row.ot_numero}</span>
            <EntregaPlazoSemaforo
              fechaEntregaOt={row.fecha_entrega_ot}
              urgente={row.urgencia === "urgente"}
            />
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-foreground">
            {row.trabajo?.trim() || row.cliente?.trim() || "Sin descripción"}
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-slate-600">
          Cantidad OT (indicadores):{" "}
          <span className="font-semibold tabular-nums text-[#002147]">
            {cantidadLabel}
          </span>
        </p>

        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600">Pasos de producción</p>
          <EtiquetasHojaRutaMaquinaButtons
            rowId={row.id}
            konica={Boolean(row.konica)}
            troqueladora={Boolean(row.troqueladora)}
            numeradora={Boolean(row.numeradora)}
            togglingMaquina={togglingMaquina}
            onToggle={(field, next) => onToggleMaquina(row, field, next)}
          />
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              onOpenChange(false);
              onEdit(row);
            }}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edición completa
          </Button>
          <Button type="button" variant="default" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
