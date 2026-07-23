"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, Ban, Loader2, RotateCcw, Save } from "lucide-react";

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
import {
  HojaRutaHeader,
  HojaRutaPasosDetail,
} from "@/components/produccion/hoja-ruta/hoja-ruta-ot-view";
import { fmtCantidad, fmtDate } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type { HojaRutaData } from "@/lib/hoja-ruta/hoja-ruta-query";
import {
  reabrirOtProducida,
  updateProducidaRevisionMeta,
} from "@/lib/prod-ot-cierre";
import {
  puedeCerrarOt,
  puedeReabrirOt,
  type ProfileConPermisos,
} from "@/lib/prod-ot-cierre-permisos";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

function parseSnapshot(raw: unknown): HojaRutaData | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.pasos)) return null;
  return raw as HojaRutaData;
}

export function ProducidaSnapshotDialog({
  row,
  open,
  onOpenChange,
  onRowUpdated,
}: {
  row: ProdOtProducidaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback tras mutar metadatos / reapertura (refrescar listado). */
  onRowUpdated?: (row: ProdOtProducidaRow) => void;
}) {
  const snapshot = row ? parseSnapshot(row.snapshot) : null;
  const [profile, setProfile] = useState<ProfileConPermisos | null>(null);
  const [excluido, setExcluido] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setExcluido(row.excluido_de_promedios);
    setMotivo(row.motivo_exclusion ?? "");
    setObs(row.observaciones_revision ?? "");
  }, [open, row]);

  useEffect(() => {
    if (!open) return;
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, puede_cerrar_ot, puede_reabrir_ot")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof as ProfileConPermisos | null);
    })();
  }, [open]);

  const canEditMeta = puedeCerrarOt(profile) || puedeReabrirOt(profile);
  const canReabrir =
    puedeReabrirOt(profile) && !!row && !row.reabierta_at;
  const yaReabierta = !!row?.reabierta_at;

  const handleSaveMeta = async () => {
    if (!row) return;
    setSavingMeta(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await updateProducidaRevisionMeta(supabase, row.id, {
        excluido_de_promedios: excluido,
        motivo_exclusion: motivo.trim() || null,
        observaciones_revision: obs.trim() || null,
      });
      const updated: ProdOtProducidaRow = {
        ...row,
        excluido_de_promedios: excluido,
        motivo_exclusion: excluido ? motivo.trim() || null : null,
        observaciones_revision: obs.trim() || null,
      };
      onRowUpdated?.(updated);
      toast.success("Metadatos de revisión actualizados.");
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudieron guardar los metadatos."));
    } finally {
      setSavingMeta(false);
    }
  };

  const handleReabrir = async () => {
    if (!row || !profile) return;
    const ok = window.confirm(
      `¿Reabrir OT ${row.ot_numero} (v${row.version})?\n\n` +
        "La OT dejará de estar archivada: podrá revisarse y cerrarse de nuevo " +
        "(generará version + 1). El snapshot actual se conserva.",
    );
    if (!ok) return;

    setReabriendo(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");
      await reabrirOtProducida(supabase, row.id, user.id);
      const updated: ProdOtProducidaRow = {
        ...row,
        reabierta_at: new Date().toISOString(),
        reabierta_por: user.id,
      };
      onRowUpdated?.(updated);
      toast.success(`OT ${row.ot_numero} reabierta. Ya no está archivada.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo reabrir la OT."));
    } finally {
      setReabriendo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94vh,880px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <Archive className="size-4 text-emerald-700" />
            Producida · OT{" "}
            <span className="font-mono text-sm font-semibold text-[#002147]">
              {row?.ot_numero ?? ""}
            </span>
            {row?.version != null ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                v{row.version}
              </span>
            ) : null}
            {row?.excluido_de_promedios ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                <Ban className="size-3" />
                Excluida de promedios
              </span>
            ) : null}
            {yaReabierta ? (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                <RotateCcw className="size-3" />
                Reabierta
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Snapshot inmutable del cierre
            {row?.cerrada_at ? ` · ${fmtDate(row.cerrada_at)}` : ""}.
            {yaReabierta
              ? ` Reabierta ${fmtDate(row?.reabierta_at ?? null)}.`
              : " Metadatos de revisión editables; snapshot no."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {!row ? (
            <p className="py-8 text-center text-sm text-slate-500">Sin datos.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-slate-700">
                <p className="mb-2 text-[11px] font-semibold text-emerald-900">
                  Datos indexados (columnas planas)
                </p>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-slate-500">Cant. pedida:</span>{" "}
                    <span className="font-medium">{fmtCantidad(row.cantidad_pedida)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cant. producida:</span>{" "}
                    <span className="font-medium">{fmtCantidad(row.cantidad_producida)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Horas total:</span>{" "}
                    <span className="font-medium">
                      {row.horas_total_reales != null ? `${row.horas_total_reales} h` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Impresión prep/tiraje:</span>{" "}
                    <span className="font-medium">
                      {row.horas_prep_impresion_reales ?? "—"} /{" "}
                      {row.horas_tiraje_impresion_reales ?? "—"} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Troquel prep/tiraje:</span>{" "}
                    <span className="font-medium">
                      {row.horas_prep_troquelado_reales ?? "—"} /{" "}
                      {row.horas_tiraje_troquelado_reales ?? "—"} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">CTP / Guillo / Desbroce:</span>{" "}
                    <span className="font-medium">
                      {row.horas_ctp_reales ?? "—"} / {row.horas_guillotina_reales ?? "—"} /{" "}
                      {row.horas_desbroce_reales ?? "—"} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Embalaje:</span>{" "}
                    <span className="font-medium">
                      {row.codigo_caja_embalaje ?? "—"}
                      {row.estuches_por_bulto != null
                        ? ` · ${row.estuches_por_bulto} un/bulto`
                        : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Merma hojas:</span>{" "}
                    <span className="font-medium">{fmtCantidad(row.merma_total)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Referencia:</span>{" "}
                    <span className="font-medium">
                      {row.referencia_minerva ?? "—"}
                      {row.referencia_cliente ? ` / ${row.referencia_cliente}` : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadatos editables */}
              {canEditMeta ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Revisión (editable)
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="prod-obs" className="text-xs">
                      Observaciones de revisión
                    </Label>
                    <Textarea
                      id="prod-obs"
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      className="min-h-[56px] text-sm"
                      disabled={savingMeta}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="prod-excl"
                      checked={excluido}
                      onCheckedChange={(c) => setExcluido(c === true)}
                      disabled={savingMeta}
                    />
                    <Label htmlFor="prod-excl" className="cursor-pointer text-sm">
                      Excluir de promedios futuros
                    </Label>
                  </div>
                  {excluido ? (
                    <div className="space-y-1">
                      <Label htmlFor="prod-motivo" className="text-xs">
                        Motivo de exclusión
                      </Label>
                      <Input
                        id="prod-motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="text-sm"
                        disabled={savingMeta}
                        placeholder="Avería, cantidad atípica, reproceso…"
                      />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={savingMeta}
                    onClick={() => void handleSaveMeta()}
                  >
                    {savingMeta ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Guardar metadatos
                  </Button>
                </div>
              ) : null}

              {snapshot ? (
                <>
                  <HojaRutaHeader data={snapshot} />
                  <HojaRutaPasosDetail data={snapshot} showProximamente={false} />
                </>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  El snapshot no tiene el formato esperado de hoja de ruta.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:px-5">
          <div>
            {canReabrir ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-50"
                disabled={reabriendo}
                onClick={() => void handleReabrir()}
              >
                {reabriendo ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Reabrir OT
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001a38]"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
