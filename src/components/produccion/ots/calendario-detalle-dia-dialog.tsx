"use client";

import {
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteDetalleDiaByCalendarioOtId,
  fetchDetalleDiaByCalendarioOtIds,
  fetchMaquinasForAmbito,
  persistDetalleDiaOrden,
  sortDetalleBySlot,
  type CalendarioDetalleMaquina,
} from "@/lib/calendario-detalle-dia";
import {
  labelCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { errorMessageFromUnknown } from "@/lib/error-message";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import type {
  CalendarioDetalleDiaTurno,
  ProdCalendarioDetalleDiaRow,
} from "@/types/prod-calendario-detalle-dia";

export type CalendarioDetalleDiaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayYmd: string;
  dayLabel: string;
  ambito: CalendarioAmbito;
  /** Pastillas del día en el ámbito activo (ids reales de calendario). */
  lineas: CalendarioProduccionLinea[];
  canEdit: boolean;
};

export function CalendarioDetalleDiaDialog({
  open,
  onOpenChange,
  dayYmd,
  dayLabel,
  ambito,
  lineas,
  canEdit,
}: CalendarioDetalleDiaDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maquinas, setMaquinas] = useState<CalendarioDetalleMaquina[]>([]);
  const [maquinaId, setMaquinaId] = useState<string>("");
  const [turno, setTurno] = useState<CalendarioDetalleDiaTurno>("manana");
  const [detalleRows, setDetalleRows] = useState<ProdCalendarioDetalleDiaRow[]>(
    [],
  );

  const load = useCallback(async () => {
    if (!open || !dayYmd) return;
    setLoading(true);
    try {
      const maqs = await fetchMaquinasForAmbito(supabase, ambito);
      setMaquinas(maqs);
      setMaquinaId((prev) => {
        if (prev && maqs.some((m) => m.id === prev)) return prev;
        return maqs[0]?.id ?? "";
      });
      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setDetalleRows(sortDetalleBySlot(rows));
    } catch (e) {
      console.error(e);
      toast.error(
        errorMessageFromUnknown(e, "No se pudo cargar el detalle del día."),
      );
      setDetalleRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, dayYmd, ambito, lineas, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const secuencia = useMemo(() => {
    const mid = maquinaId.trim();
    return sortDetalleBySlot(
      detalleRows.filter(
        (r) =>
          (r.maquina_id ?? "") === mid &&
          (r.turno ?? "manana") === turno &&
          lineas.some((l) => l.id === r.calendario_ot_id),
      ),
    );
  }, [detalleRows, maquinaId, turno, lineas]);

  const sinSecuencia = useMemo(() => {
    const inSeq = new Set(secuencia.map((r) => r.calendario_ot_id));
    return lineas.filter((l) => !inSeq.has(l.id));
  }, [lineas, secuencia]);

  const trabajoByOt = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lineas) {
      m.set(l.otNumero, (l.trabajo ?? "").trim() || "—");
    }
    return m;
  }, [lineas]);

  const persistSecuencia = async (
    nextOrdered: {
      calendarioOtId: string;
      otNumero: string;
    }[],
  ) => {
    if (!canEdit || !maquinaId) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await persistDetalleDiaOrden(
        supabase,
        nextOrdered.map((it) => ({
          calendarioOtId: it.calendarioOtId,
          ambito,
          otNumero: it.otNumero,
          maquinaId,
          turno,
        })),
        user?.id ?? null,
      );
      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setDetalleRows(sortDetalleBySlot(rows));
    } catch (e) {
      console.error(e);
      toast.error(errorMessageFromUnknown(e, "No se pudo guardar el orden."));
    } finally {
      setSaving(false);
    }
  };

  const addToSecuencia = async (linea: CalendarioProduccionLinea) => {
    if (!canEdit || !maquinaId) {
      toast.error("Elige una máquina.");
      return;
    }
    const next = [
      ...secuencia.map((r) => ({
        calendarioOtId: r.calendario_ot_id,
        otNumero: r.ot_numero,
      })),
      { calendarioOtId: linea.id, otNumero: linea.otNumero },
    ];
    await persistSecuencia(next);
    toast.success(`OT ${linea.otNumero} en secuencia.`);
  };

  const removeFromSecuencia = async (calendarioOtId: string, otNumero: string) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await deleteDetalleDiaByCalendarioOtId(supabase, calendarioOtId);
      const rest = secuencia
        .filter((r) => r.calendario_ot_id !== calendarioOtId)
        .map((r) => ({
          calendarioOtId: r.calendario_ot_id,
          otNumero: r.ot_numero,
        }));
      if (rest.length > 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await persistDetalleDiaOrden(
          supabase,
          rest.map((it) => ({
            calendarioOtId: it.calendarioOtId,
            ambito,
            otNumero: it.otNumero,
            maquinaId,
            turno,
          })),
          user?.id ?? null,
        );
      }
      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setDetalleRows(sortDetalleBySlot(rows));
      toast.message(`OT ${otNumero} fuera de secuencia (sigue en calendario).`);
    } catch (e) {
      console.error(e);
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar de la secuencia."));
    } finally {
      setSaving(false);
    }
  };

  const moveInSecuencia = async (calendarioOtId: string, dir: -1 | 1) => {
    const idx = secuencia.findIndex((r) => r.calendario_ot_id === calendarioOtId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= secuencia.length) return;
    const next = secuencia.map((r) => ({
      calendarioOtId: r.calendario_ot_id,
      otNumero: r.ot_numero,
    }));
    const tmp = next[idx]!;
    next[idx] = next[j]!;
    next[j] = tmp;
    await persistSecuencia(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <ListOrdered className="size-5" aria-hidden />
            Organizar detalle del día
          </DialogTitle>
          <DialogDescription>
            {dayLabel} · {labelCalendarioAmbito(ambito)}. Orden fino por máquina —
            no lanza ejecución. El contenedor usará este orden en el grupo «Hoy».
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <Label className="text-xs">Máquina</Label>
              <Select
                value={maquinaId || undefined}
                onValueChange={setMaquinaId}
                disabled={!canEdit || loading || maquinas.length === 0}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue
                    placeholder={
                      maquinas.length === 0
                        ? "Sin máquinas en este ámbito"
                        : "Elegir máquina"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {maquinas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[8.5rem]">
              <Label className="text-xs">Turno</Label>
              <Select
                value={turno}
                onValueChange={(v) =>
                  setTurno(v === "tarde" ? "tarde" : "manana")
                }
                disabled={!canEdit || loading}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!canEdit ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Solo lectura en este ámbito.
            </p>
          ) : null}

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  En calendario · sin secuencia ({sinSecuencia.length})
                </h3>
                {sinSecuencia.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-500">
                    Todas las OTs del día están en secuencia, o no hay pastillas.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {sinSecuencia.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-semibold text-[#002147]">
                            {l.otNumero}
                          </p>
                          <p className="truncate text-[11px] text-slate-600">
                            {l.trabajo?.trim() || "—"}
                          </p>
                        </div>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 gap-1 px-2 text-xs"
                            disabled={saving || !maquinaId}
                            title="Añadir a secuencia"
                            onClick={() => void addToSecuencia(l)}
                          >
                            <Plus className="size-3.5" />
                            Secuencia
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-[#002147]/20 bg-white p-2 shadow-sm">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#002147]">
                  Secuencia {turno === "tarde" ? "tarde" : "mañana"} (
                  {secuencia.length})
                </h3>
                {secuencia.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-500">
                    Añade OTs desde la izquierda. Ese orden verán los maquinistas
                    en «Hoy».
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {secuencia.map((r, idx) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1.5"
                      >
                        <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-500">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-semibold text-[#002147]">
                            {r.ot_numero}
                          </p>
                          <p className="truncate text-[11px] text-slate-600">
                            {trabajoByOt.get(r.ot_numero) ?? "—"}
                          </p>
                        </div>
                        {canEdit ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={saving || idx === 0}
                              title="Subir"
                              onClick={() =>
                                void moveInSecuencia(r.calendario_ot_id, -1)
                              }
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={saving || idx >= secuencia.length - 1}
                              title="Bajar"
                              onClick={() =>
                                void moveInSecuencia(r.calendario_ot_id, 1)
                              }
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-700"
                              disabled={saving}
                              title="Quitar de secuencia"
                              onClick={() =>
                                void removeFromSecuencia(
                                  r.calendario_ot_id,
                                  r.ot_numero,
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
