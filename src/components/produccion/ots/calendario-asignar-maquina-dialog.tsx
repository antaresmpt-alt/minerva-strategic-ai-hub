"use client";

import { Cpu, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  fetchDetalleDiaByCalendarioOtIds,
  fetchMaquinasForAmbito,
  quickAssignDetalleDiaMaquina,
  type CalendarioDetalleMaquina,
} from "@/lib/calendario-detalle-dia";
import { labelCalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CalendarioDetalleDiaTurno } from "@/types/prod-calendario-detalle-dia";

export type CalendarioAsignarMaquinaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linea: CalendarioProduccionLinea | null;
  dayYmd: string | null;
  onSaved?: () => void;
};

export function CalendarioAsignarMaquinaDialog({
  open,
  onOpenChange,
  linea,
  dayYmd,
  onSaved,
}: CalendarioAsignarMaquinaDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maquinas, setMaquinas] = useState<CalendarioDetalleMaquina[]>([]);
  const [maquinaId, setMaquinaId] = useState("");
  const [turno, setTurno] = useState<CalendarioDetalleDiaTurno>("manana");

  const load = useCallback(async () => {
    if (!open || !linea || !dayYmd) return;
    setLoading(true);
    try {
      const maqs = await fetchMaquinasForAmbito(supabase, linea.ambito);
      setMaquinas(maqs);
      const existing = (
        await fetchDetalleDiaByCalendarioOtIds(supabase, [linea.id])
      )[0];
      const savedMaquina = String(existing?.maquina_id ?? "").trim();
      const savedTurno =
        existing?.turno === "tarde" ? "tarde" : ("manana" as const);
      if (savedMaquina && maqs.some((m) => m.id === savedMaquina)) {
        setMaquinaId(savedMaquina);
        setTurno(savedTurno);
      } else if (maqs.length === 1) {
        setMaquinaId(maqs[0]!.id);
        setTurno("manana");
      } else {
        setMaquinaId("");
        setTurno("manana");
      }
    } catch (e) {
      toast.error(
        errorMessageFromUnknown(e, "No se pudieron cargar las máquinas."),
      );
      setMaquinas([]);
    } finally {
      setLoading(false);
    }
  }, [open, linea, dayYmd, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGuardar = async () => {
    if (!linea || !dayYmd || !maquinaId) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await quickAssignDetalleDiaMaquina(supabase, {
        fechaYmd: dayYmd,
        calendarioOtId: linea.id,
        otNumero: linea.otNumero,
        ambito: linea.ambito,
        maquinaId,
        turno,
        createdBy: user?.id ?? null,
      });
      const mq = maquinas.find((m) => m.id === maquinaId);
      toast.success(
        `OT ${linea.otNumero} → ${mq?.nombre ?? "máquina"} · ${turno === "tarde" ? "tarde" : "mañana"}`,
      );
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo guardar la asignación."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="size-5 text-[#002147]" aria-hidden />
            Asignar máquina · OT {linea?.otNumero ?? "…"}
          </DialogTitle>
          <DialogDescription>
            {dayYmd ? `${dayYmd.slice(0, 10)} · ` : ""}
            {linea ? labelCalendarioAmbito(linea.ambito) : ""}. Sin abrir la
            vista mesa completa.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </div>
        ) : maquinas.length === 0 ? (
          <p className="py-4 text-sm text-slate-600">
            No hay máquinas activas para este ámbito.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cal-asignar-maq">Máquina</Label>
              <select
                id="cal-asignar-maq"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={maquinaId}
                onChange={(e) => setMaquinaId(e.target.value)}
                disabled={saving}
              >
                <option value="">— Selecciona —</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cal-asignar-turno">Turno</Label>
              <select
                id="cal-asignar-turno"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={turno}
                onChange={(e) =>
                  setTurno(e.target.value === "tarde" ? "tarde" : "manana")
                }
                disabled={saving}
              >
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#002147] hover:bg-[#003366]"
            disabled={saving || loading || !maquinaId}
            onClick={() => void handleGuardar()}
          >
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
