"use client";

import { useState } from "react";
import { Archive, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export type CierrePrevioChecklistData = {
  pasosFinalizados: boolean;
  cantidadProducida: boolean;
  horasCoherentes: boolean;
  incidenciasRevisadas: boolean;
  embalajeInformado: boolean;
};

export type CierreOtFormData = {
  observacionesRevision: string;
  excluidoDePromedios: boolean;
  motivoExclusion: string;
};

export function CierreOtDialog({
  open,
  onOpenChange,
  otNumero,
  checklist,
  onConfirm,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string;
  checklist: CierrePrevioChecklistData;
  onConfirm: (form: CierreOtFormData) => void | Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<CierreOtFormData>({
    observacionesRevision: "",
    excluidoDePromedios: false,
    motivoExclusion: "",
  });

  const handleConfirm = () => {
    void onConfirm(form);
  };

  const reset = () => {
    setForm({
      observacionesRevision: "",
      excluidoDePromedios: false,
      motivoExclusion: "",
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !saving) reset();
    onOpenChange(next);
  };

  const hasWarnings =
    !checklist.horasCoherentes ||
    !checklist.incidenciasRevisadas ||
    !checklist.embalajeInformado;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="size-5" />
            Cerrar y enviar a histórico
          </DialogTitle>
          <DialogDescription>
            OT <span className="font-mono font-semibold text-slate-700">{otNumero}</span> · Revisión
            previa al cierre
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Checklist */}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-sm font-semibold text-slate-700">Checklist de revisión</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Checkbox checked={checklist.pasosFinalizados} disabled />
                <span className={checklist.pasosFinalizados ? "text-slate-600" : "text-red-600"}>
                  Todos los procesos finalizados
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={checklist.cantidadProducida} disabled />
                <span
                  className={checklist.cantidadProducida ? "text-slate-600" : "text-amber-600"}
                >
                  Cantidad producida final informada
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={checklist.horasCoherentes} disabled />
                <span className={checklist.horasCoherentes ? "text-slate-600" : "text-amber-600"}>
                  Horas reales coherentes (aviso)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={checklist.incidenciasRevisadas} disabled />
                <span
                  className={checklist.incidenciasRevisadas ? "text-slate-600" : "text-amber-600"}
                >
                  Incidencias revisadas (aviso)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={checklist.embalajeInformado} disabled />
                <span
                  className={checklist.embalajeInformado ? "text-slate-600" : "text-amber-600"}
                >
                  Embalaje informado si aplica (aviso)
                </span>
              </div>
            </div>
            {hasWarnings ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Algunos checks son informativos. Puedes cerrar igualmente si los datos son
                  correctos.
                </span>
              </div>
            ) : null}
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label htmlFor="obs-revision" className="text-sm">
              Observaciones de revisión (opcional)
            </Label>
            <Textarea
              id="obs-revision"
              value={form.observacionesRevision}
              onChange={(e) => setForm((f) => ({ ...f, observacionesRevision: e.target.value }))}
              placeholder="Comentarios sobre el cierre..."
              className="min-h-[60px] text-sm"
              disabled={saving}
            />
          </div>

          {/* Excluir de promedios */}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="excluir-promedios"
                checked={form.excluidoDePromedios}
                onCheckedChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    excluidoDePromedios: checked === true,
                    motivoExclusion: checked === true ? f.motivoExclusion : "",
                  }))
                }
                disabled={saving}
              />
              <Label
                htmlFor="excluir-promedios"
                className="cursor-pointer text-sm font-medium text-slate-700"
              >
                Excluir de promedios futuros
              </Label>
            </div>
            <p className="text-xs text-slate-500">
              Marcar si esta OT tuvo una producción anómala (avería, cantidad atípica, reproceso…)
            </p>
            {form.excluidoDePromedios ? (
              <div className="mt-2 space-y-1">
                <Label htmlFor="motivo-exclusion" className="text-xs text-slate-600">
                  Motivo de exclusión
                </Label>
                <Input
                  id="motivo-exclusion"
                  value={form.motivoExclusion}
                  onChange={(e) => setForm((f) => ({ ...f, motivoExclusion: e.target.value }))}
                  placeholder="Ej: avería grave en máquina"
                  className="text-xs"
                  disabled={saving}
                />
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !checklist.pasosFinalizados}
            className="gap-2 bg-[#002147] hover:bg-[#001a38]"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cerrando...
              </>
            ) : (
              <>
                <Archive className="size-4" />
                Confirmar cierre
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
