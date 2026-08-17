"use client";

import { Loader2, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DespachoItinerarioPicker,
  type DespachoItinerarioSlot,
} from "@/components/produccion/ots/despacho-itinerario-picker";
import { formatSupabaseErrorMessage } from "@/lib/despacho-wizard-shared";
import {
  fetchProdOtGeneralIdByNumPedido,
  fetchProdOtPasosVista,
  insertarPasosEnColaViva,
  pasosVistaToItinerarioSlots,
  type ProdOtPasoVista,
} from "@/lib/prod-ot-itinerario-client";
import { cn } from "@/lib/utils";

const ESTADOS_EDITABLES = new Set(["pendiente", "disponible"]);

function estadoLabel(e: string): string {
  switch (e.toLowerCase()) {
    case "finalizado":
      return "Finalizado";
    case "en_marcha":
      return "En curso";
    case "pausado":
      return "Pausado";
    case "disponible":
      return "Disponible";
    default:
      return "Pendiente";
  }
}

function estadoRowClass(e: string): string {
  switch (e.toLowerCase()) {
    case "finalizado":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "en_marcha":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "pausado":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export type AjustarItinerarioDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string | null;
  supabase: SupabaseClient;
  onGuardado?: () => void;
};

export function AjustarItinerarioDialog({
  open,
  onOpenChange,
  otNumero,
  supabase,
  onGuardado,
}: AjustarItinerarioDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [otId, setOtId] = useState<string | null>(null);
  const [pasosBloqueados, setPasosBloqueados] = useState<ProdOtPasoVista[]>([]);
  const [editableSlots, setEditableSlots] = useState<DespachoItinerarioSlot[]>([]);

  useEffect(() => {
    if (!open || !otNumero) return;
    let cancelled = false;
    setLoading(true);
    setOtId(null);
    setPasosBloqueados([]);
    setEditableSlots([]);

    void (async () => {
      try {
        const id = await fetchProdOtGeneralIdByNumPedido(supabase, otNumero);
        if (cancelled) return;
        setOtId(id);
        if (!id) {
          toast.error(`No existe la OT ${otNumero} en maestro.`);
          return;
        }
        const pasos = await fetchProdOtPasosVista(supabase, id);
        if (cancelled) return;
        const bloqueados = pasos.filter(
          (p) =>
            !ESTADOS_EDITABLES.has(String(p.estado ?? "").trim().toLowerCase()),
        );
        const editables = pasos.filter((p) =>
          ESTADOS_EDITABLES.has(String(p.estado ?? "").trim().toLowerCase()),
        );
        setPasosBloqueados(bloqueados);
        setEditableSlots(pasosVistaToItinerarioSlots(editables));
      } catch (e) {
        if (!cancelled)
          toast.error(e instanceof Error ? e.message : "Error cargando pasos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, otNumero, supabase]);

  const handleGuardar = useCallback(async () => {
    if (!otId) return;
    setSaving(true);
    try {
      // Re-fetch to get the freshest state before writing
      const allPasos = await fetchProdOtPasosVista(supabase, otId);
      await insertarPasosEnColaViva(
        supabase,
        otId,
        allPasos,
        editableSlots,
        otNumero,
      );
      toast.success("Itinerario actualizado.");
      onOpenChange(false);
      onGuardado?.();
    } catch (e) {
      toast.error(
        formatSupabaseErrorMessage(e, "Error guardando el itinerario."),
      );
    } finally {
      setSaving(false);
    }
  }, [editableSlots, onGuardado, onOpenChange, otId, otNumero, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,800px)] max-w-[min(96vw,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="text-base">
            Ajustar itinerario{" "}
            <span className="font-mono text-sm font-semibold text-[#002147]">
              {otNumero ?? ""}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Los pasos ya iniciados o finalizados son de solo lectura. Puedes
            reordenar, quitar o añadir procesos en la cola pendiente (los nuevos
            se insertan al inicio de esa cola — justo después de lo hecho).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Cargando pasos…
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>A tu cuenta y riesgo.</strong> Los cambios en la cola
                pendiente afectan al itinerario en producción de forma
                inmediata.
              </p>

              {pasosBloqueados.length > 0 && (
                <div className="grid gap-1.5">
                  <p className="text-xs font-semibold text-slate-600">
                    Pasos bloqueados
                  </p>
                  {pasosBloqueados.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-2 rounded border px-2 py-1.5 text-xs",
                        estadoRowClass(p.estado),
                      )}
                    >
                      <Lock className="size-3 shrink-0 opacity-50" aria-hidden />
                      <span className="font-medium">
                        {p.orden}. {p.procesoNombre}
                      </span>
                      <span className="ml-auto opacity-60">
                        {estadoLabel(p.estado)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-1.5">
                <p className="text-xs font-semibold text-slate-600">
                  Cola pendiente (editable)
                </p>
                {otId ? (
                  <DespachoItinerarioPicker
                    open={open}
                    supabase={supabase}
                    disabled={saving}
                    slots={editableSlots}
                    onSlotsChange={setEditableSlots}
                    addPosition="prepend"
                    embedded
                  />
                ) : (
                  <p className="text-xs text-slate-500">
                    OT no encontrada en maestro.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:px-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || loading || !otId}
            className="gap-2 bg-[#002147] text-white hover:bg-[#001a38]"
            onClick={() => void handleGuardar()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
