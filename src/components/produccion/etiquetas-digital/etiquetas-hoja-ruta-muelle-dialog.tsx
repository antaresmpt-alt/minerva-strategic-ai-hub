"use client";

import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MaquinaHojaRutaField } from "@/lib/etiquetas-hoja-ruta-maquina";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

type Props = {
  row: ProdEtiquetasHojaRutaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  togglingMaquina: string | null;
  savingEtiquetas: boolean;
  onToggleMaquina: (
    row: ProdEtiquetasHojaRutaRow,
    field: MaquinaHojaRutaField,
    next: boolean
  ) => void;
  onSaveEtiquetas: (row: ProdEtiquetasHojaRutaRow, etiquetas: number) => void;
  onEdit: (row: ProdEtiquetasHojaRutaRow) => void;
};

export function EtiquetasHojaRutaMuelleDialog({
  row,
  open,
  onOpenChange,
  togglingMaquina,
  savingEtiquetas,
  onToggleMaquina,
  onSaveEtiquetas,
  onEdit,
}: Props) {
  const [etqInput, setEtqInput] = useState("");

  useEffect(() => {
    if (row && open) {
      setEtqInput(row.etiquetas != null ? String(row.etiquetas) : "");
    }
  }, [row, open]);

  if (!row) return null;

  const handleSaveEtiquetas = () => {
    const n = Number.parseInt(etqInput.trim(), 10);
    if (!Number.isFinite(n) || n < 0) return;
    onSaveEtiquetas(row, n);
  };

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

        <div className="grid gap-2">
          <Label htmlFor="etq-muelle-etiquetas" className="text-xs">
            Etiquetas (para KPI al marcar impresión)
          </Label>
          <div className="flex gap-2">
            <Input
              id="etq-muelle-etiquetas"
              type="number"
              min={0}
              inputMode="numeric"
              value={etqInput}
              onChange={(e) => setEtqInput(e.target.value)}
              className="h-10"
              placeholder="Cantidad"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={savingEtiquetas || !etqInput.trim()}
              onClick={handleSaveEtiquetas}
            >
              {savingEtiquetas ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
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
