"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Package, Pencil, RotateCcw } from "lucide-react";
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
import { CartelaCierreBlock } from "@/components/produccion/planificacion/cartela-cierre-block";
import { DatosProcesoForm } from "@/components/produccion/hoja-ruta/datos-proceso-form";
import {
  procesoUsaCartela,
  type PasoItinerarioConsumo,
} from "@/lib/cartela-ejecucion";
import { parseCartelaConsumoFromDatos } from "@/lib/cartela-stock-consumo";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import {
  corregirCartelaPasoAdmin,
  editarDatosPasoAdmin,
  fetchPasosItinerarioAdmin,
  reabrirPasoAdmin,
  siguientePasoIniciado,
} from "@/lib/prod-paso-admin-client";
import {
  puedeCorregirCartelaPaso,
  puedeEditarPasoAdmin,
  puedeReabrirPasoAdmin,
} from "@/lib/prod-paso-admin-permisos";
import type { ProfileConPermisos } from "@/lib/prod-ot-cierre-permisos";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PasoAdminContext = {
  pasoId: string;
  otNumero: string;
  otId: string;
  procesoId: number | null;
  procesoNombre: string | null;
  estado: string;
  datosProceso: DatosProcesoGenerico;
  ejecucionId?: string | null;
  mesaTrabajoId?: string | null;
  horasReales?: number | null;
};

type PasoAdminActionsProps = {
  paso: PasoAdminContext;
  pasosItinerario?: PasoItinerarioConsumo[];
  profile: ProfileConPermisos | null;
  onSuccess?: () => void;
  /** Botones más compactos para hoja de ruta. */
  compact?: boolean;
};

export function PasoAdminActions({
  paso,
  pasosItinerario,
  profile,
  onSuccess,
  compact = false,
}: PasoAdminActionsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [editOpen, setEditOpen] = useState(false);
  const [cartelaOpen, setCartelaOpen] = useState(false);
  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [datosEdit, setDatosEdit] = useState<DatosProcesoGenerico>(paso.datosProceso);
  const [datosCartela, setDatosCartela] = useState<DatosProcesoGenerico>(paso.datosProceso);
  const [puedeReabrir, setPuedeReabrir] = useState<boolean | null>(null);

  const esFinalizado = paso.estado === "finalizado";
  const showEditar = esFinalizado && puedeEditarPasoAdmin(profile);
  const showCartela =
    esFinalizado &&
    puedeCorregirCartelaPaso(profile) &&
    procesoUsaCartela(paso.procesoId, pasosItinerario);
  const showReabrirBtn = esFinalizado && puedeReabrirPasoAdmin(profile);

  const cartelaIncompleta = useMemo(() => {
    const parsed = parseCartelaConsumoFromDatos(paso.datosProceso);
    return !(parsed.idStock != null && parsed.hojas != null && parsed.hojas > 0);
  }, [paso.datosProceso]);

  const checkReabrir = useCallback(async () => {
    if (!showReabrirBtn) return;
    try {
      const pasos = await fetchPasosItinerarioAdmin(supabase, paso.otId);
      setPuedeReabrir(!siguientePasoIniciado(pasos, paso.pasoId));
    } catch {
      setPuedeReabrir(false);
    }
  }, [showReabrirBtn, supabase, paso.otId, paso.pasoId]);

  if (!showEditar && !showCartela && !showReabrirBtn) return null;

  const btnClass = compact ? "h-7 gap-1 px-2 text-[11px]" : "h-8 gap-1.5 text-xs";

  const handleEditar = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");
      await editarDatosPasoAdmin(supabase, {
        pasoId: paso.pasoId,
        datos: datosEdit,
        userId: user.id,
        ejecucionId: paso.ejecucionId,
        horasReales: paso.horasReales,
      });
      toast.success("Paso actualizado.");
      setEditOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo editar el paso.");
    } finally {
      setSaving(false);
    }
  };

  const handleCorregirCartela = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");
      const { hojas, consumido } = await corregirCartelaPasoAdmin(supabase, {
        pasoId: paso.pasoId,
        otNumero: paso.otNumero,
        otId: paso.otId,
        procesoId: paso.procesoId,
        datosActuales: paso.datosProceso,
        datosCartela,
        pasosItinerario,
        userId: user.id,
      });
      toast.success(
        consumido
          ? `Cartela registrada: ${hojas.toLocaleString("es-ES")} h descontadas del palet.`
          : "Cartela guardada en el paso.",
      );
      setCartelaOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo corregir la cartela.");
    } finally {
      setSaving(false);
    }
  };

  const handleReabrir = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");
      await reabrirPasoAdmin(supabase, {
        pasoId: paso.pasoId,
        otId: paso.otId,
        ejecucionId: paso.ejecucionId,
        mesaTrabajoId: paso.mesaTrabajoId,
        userId: user.id,
      });
      toast.success("Paso reabierto. Vuelve a estar disponible en planta.");
      setReabrirOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reabrir el paso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {showCartela && cartelaIncompleta ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${btnClass} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`}
            onClick={() => {
              setDatosCartela(paso.datosProceso);
              setCartelaOpen(true);
            }}
          >
            <Package className="size-3.5" />
            Corregir cartela
          </Button>
        ) : null}
        {showEditar ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={btnClass}
            onClick={() => {
              setDatosEdit(paso.datosProceso);
              setEditOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
            Editar paso
          </Button>
        ) : null}
        {showReabrirBtn ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={btnClass}
            onClick={() => {
              void checkReabrir();
              setReabrirOpen(true);
            }}
          >
            <RotateCcw className="size-3.5" />
            Reabrir paso
          </Button>
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar paso (admin)</DialogTitle>
            <DialogDescription>
              OT {paso.otNumero}
              {paso.procesoNombre ? ` · ${paso.procesoNombre}` : ""}. El paso sigue finalizado;
              solo se corrigen datos registrados.
            </DialogDescription>
          </DialogHeader>
          {paso.procesoId != null ? (
            <DatosProcesoForm
              procesoId={paso.procesoId}
              procesoNombre={paso.procesoNombre ?? undefined}
              datosInicial={datosEdit}
              onChange={setDatosEdit}
            />
          ) : (
            <p className="text-sm text-slate-600">Este paso no tiene proceso asociado.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#002147] text-white hover:bg-[#001735]"
              disabled={saving || paso.procesoId == null}
              onClick={() => void handleEditar()}
            >
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cartelaOpen} onOpenChange={setCartelaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Corregir cartela</DialogTitle>
            <DialogDescription>
              OT {paso.otNumero}
              {paso.procesoNombre ? ` · ${paso.procesoNombre}` : ""}. Registra el consumo que faltó
              al cerrar el paso; se descontará del palet al confirmar.
            </DialogDescription>
          </DialogHeader>
          <CartelaCierreBlock
            otNumero={paso.otNumero}
            procesoId={paso.procesoId}
            datosDraft={datosCartela}
            onDatosChange={setDatosCartela}
            obligatorio
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setCartelaOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#002147] text-white hover:bg-[#001735]"
              disabled={saving}
              onClick={() => void handleCorregirCartela()}
            >
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Confirmar y descontar stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reabrirOpen} onOpenChange={setReabrirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir paso</DialogTitle>
            <DialogDescription>
              OT {paso.otNumero}
              {paso.procesoNombre ? ` · ${paso.procesoNombre}` : ""}. Solo admin/gerencia. El paso
              volverá a estar disponible para ejecutarse de nuevo.
            </DialogDescription>
          </DialogHeader>
          {puedeReabrir === false ? (
            <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              No se puede reabrir: un paso posterior ya está en marcha o finalizado.
            </p>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Los pasos siguientes que estuvieran disponibles volverán a pendiente. Usa esta acción
              solo si hace falta repetir la ejecución.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setReabrirOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving || puedeReabrir === false}
              onClick={() => void handleReabrir()}
            >
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Reabrir paso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
