"use client";

import { Loader2, Sun, Sunrise } from "lucide-react";
import { useState } from "react";

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
import { formatFechaEsLarga } from "@/lib/produccion-date-format";
import type { TurnoKey } from "@/types/planificacion-mesa";

interface EditCapacidadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fecha: string | null;
  turno: TurnoKey | null;
  initialHoras: number;
  initialMotivo: string | null;
  saving: boolean;
  onSave: (horas: number, motivo: string | null) => Promise<void> | void;
}

function turnoLabel(t: TurnoKey | null): string {
  if (!t) return "—";
  return t === "manana" ? "Mañana" : "Tarde";
}

/**
 * Cuerpo del dialog. Se monta cada vez que se abre el dialog (forzado por
 * `key` desde el padre) para que `useState` reciba los valores iniciales
 * frescos sin necesidad de `setState` dentro de un `useEffect`.
 */
function DialogBody({
  fecha,
  turno,
  initialHoras,
  initialMotivo,
  saving,
  onCancel,
  onSave,
}: Pick<
  EditCapacidadDialogProps,
  "fecha" | "turno" | "initialHoras" | "initialMotivo" | "saving" | "onSave"
> & { onCancel: () => void }) {
  const [horas, setHoras] = useState<string>(
    Number.isFinite(initialHoras) ? String(initialHoras) : "8",
  );
  const [motivo, setMotivo] = useState<string>(initialMotivo ?? "");

  const numericHoras = Number(horas.replace(",", "."));
  const isValid = Number.isFinite(numericHoras) && numericHoras >= 0;

  const handleSave = async () => {
    if (!isValid) return;
    const motivoFinal = motivo.trim().length > 0 ? motivo.trim() : null;
    await onSave(numericHoras, motivoFinal);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="inline-flex items-center gap-2">
          {turno === "manana" ? (
            <Sunrise className="size-4 text-amber-600" />
          ) : (
            <Sun className="size-4 text-orange-600" />
          )}
          Capacidad · {turnoLabel(turno)}
        </DialogTitle>
        <DialogDescription>
          {fecha ? formatFechaEsLarga(fecha) : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 px-6 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="capacidad-horas" className="text-xs">
            Horas disponibles (0–12)
          </Label>
          <Input
            id="capacidad-horas"
            inputMode="decimal"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            placeholder="8"
          />
          {!isValid ? (
            <p className="text-[11px] text-red-600">
              Introduce un número &gt;= 0 (admite decimales).
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacidad-motivo" className="text-xs">
            Motivo del ajuste (opcional)
          </Label>
          <Input
            id="capacidad-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Baja maquinista"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="bg-[#002147] text-white hover:bg-[#001735]"
          disabled={saving || !isValid}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditCapacidadDialog({
  open,
  onOpenChange,
  fecha,
  turno,
  initialHoras,
  initialMotivo,
  saving,
  onSave,
}: EditCapacidadDialogProps) {
  // Reinicia el estado interno del cuerpo cada vez que se abre con
  // distintos parámetros, sin recurrir a `setState` dentro de `useEffect`.
  const bodyKey = `${open ? "open" : "closed"}::${fecha ?? "-"}::${turno ?? "-"}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <DialogBody
            key={bodyKey}
            fecha={fecha}
            turno={turno}
            initialHoras={initialHoras}
            initialMotivo={initialMotivo}
            saving={saving}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
