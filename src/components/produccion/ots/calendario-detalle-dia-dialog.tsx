"use client";

import {
  ChevronDown,
  ChevronUp,
  FileDown,
  ListOrdered,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";

import { CalendarioDetalleDiaPrintTemplate } from "@/components/produccion/ots/calendario-detalle-dia-print";
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
  draftFromDetalleRows,
  fetchDetalleDiaByCalendarioOtIds,
  fetchMaquinasForAmbito,
  renumberDraftTurno,
  saveDetalleDiaDraftForMaquina,
  seedDraftFromCalendarioLineas,
  syncCalendarioOrdenFromDraft,
  type CalendarioDetalleMaquina,
  type DetalleDiaDraftSlot,
} from "@/lib/calendario-detalle-dia";
import {
  labelCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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
  lineas: CalendarioProduccionLinea[];
  canEdit: boolean;
  /** Tras Guardar (sync orden calendario) — p. ej. reload del grid. */
  onSaved?: () => void;
};

function isLineaHecha(l: CalendarioProduccionLinea): boolean {
  return Boolean(l.hechoVisual ?? l.marcadoHecho);
}

export function CalendarioDetalleDiaDialog({
  open,
  onOpenChange,
  dayYmd,
  dayLabel,
  ambito,
  lineas,
  canEdit,
  onSaved,
}: CalendarioDetalleDiaDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maquinas, setMaquinas] = useState<CalendarioDetalleMaquina[]>([]);
  const [maquinaId, setMaquinaId] = useState("");
  const [savedRows, setSavedRows] = useState<ProdCalendarioDetalleDiaRow[]>([]);
  const [draft, setDraft] = useState<DetalleDiaDraftSlot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [hechasOpen, setHechasOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const pendingLineas = useMemo(
    () => lineas.filter((l) => !isLineaHecha(l)),
    [lineas],
  );
  const hechasLineas = useMemo(
    () => lineas.filter((l) => isLineaHecha(l)),
    [lineas],
  );

  const trabajoByOt = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lineas) {
      m.set(l.otNumero, (l.trabajo ?? "").trim() || "—");
    }
    return m;
  }, [lineas]);

  const maquinaNombre = useMemo(() => {
    return maquinas.find((m) => m.id === maquinaId)?.nombre ?? "—";
  }, [maquinas, maquinaId]);

  const load = useCallback(async () => {
    if (!open || !dayYmd) return;
    setLoading(true);
    setDirty(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);

      const maqs = await fetchMaquinasForAmbito(supabase, ambito);
      setMaquinas(maqs);
      const mid =
        maquinaId && maqs.some((m) => m.id === maquinaId)
          ? maquinaId
          : (maqs[0]?.id ?? "");
      setMaquinaId(mid);

      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setSavedRows(rows);

      if (!mid) {
        setDraft([]);
        return;
      }
      const forMaq = draftFromDetalleRows(rows, mid);
      if (forMaq.length > 0) {
        setDraft(forMaq);
      } else {
        setDraft(seedDraftFromCalendarioLineas(lineas, pendingLineas));
        setDirty(pendingLineas.length > 0 || lineas.length > 0);
      }
    } catch (e) {
      console.error(e);
      toast.error(
        errorMessageFromUnknown(e, "No se pudo cargar el detalle del día."),
      );
      setDraft([]);
      setSavedRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, dayYmd, ambito, lineas, pendingLineas, maquinaId, supabase]);

  useEffect(() => {
    void load();
    // Solo al abrir / cambiar día·ámbito·lineas — no cada maquinaId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayYmd, ambito, lineas]);

  useEffect(() => {
    if (!open || loading || !maquinaId) return;
    const forMaq = draftFromDetalleRows(savedRows, maquinaId);
    if (forMaq.length > 0) {
      setDraft(forMaq);
      setDirty(false);
    } else {
      setDraft(seedDraftFromCalendarioLineas(lineas, pendingLineas));
      setDirty(pendingLineas.length > 0 || lineas.length > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquinaId]);

  const draftManana = useMemo(
    () =>
      draft
        .filter((d) => d.turno === "manana")
        .sort((a, b) => a.slotOrden - b.slotOrden),
    [draft],
  );
  const draftTarde = useMemo(
    () =>
      draft
        .filter((d) => d.turno === "tarde")
        .sort((a, b) => a.slotOrden - b.slotOrden),
    [draft],
  );

  const inDraftIds = useMemo(
    () => new Set(draft.map((d) => d.calendarioOtId)),
    [draft],
  );

  const sinSecuencia = useMemo(
    () => pendingLineas.filter((l) => !inDraftIds.has(l.id)),
    [pendingLineas, inDraftIds],
  );

  const tryClose = (nextOpen: boolean) => {
    if (!nextOpen && dirty && canEdit) {
      const ok = window.confirm(
        "Hay cambios sin guardar. ¿Salir sin guardar?",
      );
      if (!ok) return;
    }
    onOpenChange(nextOpen);
  };

  const addToTurno = (linea: CalendarioProduccionLinea, turno: CalendarioDetalleDiaTurno) => {
    if (!canEdit || !maquinaId) return;
    setDraft((prev) => {
      const without = prev.filter((d) => d.calendarioOtId !== linea.id);
      const same = without.filter((d) => d.turno === turno);
      const nextSlot =
        same.length === 0
          ? 1
          : Math.max(...same.map((d) => d.slotOrden)) + 1;
      return renumberDraftTurno(
        [
          ...without,
          {
            calendarioOtId: linea.id,
            otNumero: linea.otNumero,
            turno,
            slotOrden: nextSlot,
          },
        ],
        turno,
      );
    });
    setDirty(true);
  };

  const removeFromDraft = (calendarioOtId: string) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const removed = prev.find((d) => d.calendarioOtId === calendarioOtId);
      const rest = prev.filter((d) => d.calendarioOtId !== calendarioOtId);
      if (!removed) return prev;
      return renumberDraftTurno(rest, removed.turno);
    });
    setDirty(true);
  };

  const moveInTurno = (
    calendarioOtId: string,
    turno: CalendarioDetalleDiaTurno,
    dir: -1 | 1,
  ) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const list = prev
        .filter((d) => d.turno === turno)
        .sort((a, b) => a.slotOrden - b.slotOrden);
      const idx = list.findIndex((d) => d.calendarioOtId === calendarioOtId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= list.length) return prev;
      const next = [...list];
      const tmp = next[idx]!;
      next[idx] = next[j]!;
      next[j] = tmp;
      const renumbered = next.map((d, i) => ({ ...d, slotOrden: i + 1 }));
      const other = prev.filter((d) => d.turno !== turno);
      return [...other, ...renumbered];
    });
    setDirty(true);
  };

  const moveToOtherTurno = (
    calendarioOtId: string,
    to: CalendarioDetalleDiaTurno,
  ) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const item = prev.find((d) => d.calendarioOtId === calendarioOtId);
      if (!item || item.turno === to) return prev;
      const without = prev.filter((d) => d.calendarioOtId !== calendarioOtId);
      const dest = without.filter((d) => d.turno === to);
      const nextSlot =
        dest.length === 0
          ? 1
          : Math.max(...dest.map((d) => d.slotOrden)) + 1;
      let next = renumberDraftTurno(
        [
          ...without,
          { ...item, turno: to, slotOrden: nextSlot },
        ],
        item.turno,
      );
      next = renumberDraftTurno(next, to);
      return next;
    });
    setDirty(true);
  };

  const handleGuardar = async () => {
    if (!canEdit || !maquinaId) {
      toast.error("Elige una máquina.");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const prevForMaq = savedRows.filter(
        (r) => (r.maquina_id ?? "") === maquinaId,
      );
      await saveDetalleDiaDraftForMaquina(supabase, {
        ambito,
        maquinaId,
        draft,
        previousRowsForMaquina: prevForMaq,
        createdBy: user?.id ?? null,
      });
      const unseq = lineas
        .filter((l) => !inDraftIds.has(l.id))
        .map((l) => l.id);
      await syncCalendarioOrdenFromDraft(supabase, draft, unseq);

      const ids = lineas.map((l) => l.id);
      const rows = await fetchDetalleDiaByCalendarioOtIds(supabase, ids);
      setSavedRows(rows);
      setDraft(draftFromDetalleRows(rows, maquinaId));
      setDirty(false);
      toast.success("Orden del día guardado.");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(errorMessageFromUnknown(e, "No se pudo guardar el orden."));
    } finally {
      setSaving(false);
    }
  };

  const handleAtras = () => {
    tryClose(false);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Plan-${ambito}-${dayYmd}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

  const renderTurnoList = (
    turno: CalendarioDetalleDiaTurno,
    items: DetalleDiaDraftSlot[],
  ) => (
    <section className="rounded-lg border border-[#002147]/20 bg-white p-2 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#002147]">
        {turno === "tarde" ? "Tarde" : "Mañana"} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-xs text-slate-500">
          Vacío. Añade desde la izquierda o mueve desde el otro turno.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((r, idx) => (
            <li
              key={r.calendarioOtId}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1.5"
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-500">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold text-[#002147]">
                  {r.otNumero}
                </p>
                <p className="truncate text-[11px] text-slate-600">
                  {trabajoByOt.get(r.otNumero) ?? "—"}
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-[10px]"
                    disabled={saving}
                    title={
                      turno === "manana" ? "Mover a tarde" : "Mover a mañana"
                    }
                    onClick={() =>
                      moveToOtherTurno(
                        r.calendarioOtId,
                        turno === "manana" ? "tarde" : "manana",
                      )
                    }
                  >
                    {turno === "manana" ? "→ T" : "→ M"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={saving || idx === 0}
                    title="Subir"
                    onClick={() => moveInTurno(r.calendarioOtId, turno, -1)}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={saving || idx >= items.length - 1}
                    title="Bajar"
                    onClick={() => moveInTurno(r.calendarioOtId, turno, 1)}
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
                    onClick={() => removeFromDraft(r.calendarioOtId)}
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
  );

  return (
    <Dialog open={open} onOpenChange={tryClose}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <ListOrdered className="size-5" aria-hidden />
            Organizar detalle del día
            {dirty ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                Sin guardar
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {dayLabel} · {labelCalendarioAmbito(ambito)}. Edita en borrador →{" "}
            <strong>Guardar orden</strong>. No lanza ejecución.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <Label className="text-xs" htmlFor="detalle-maq">
                Máquina
              </Label>
              <select
                id="detalle-maq"
                className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-[#002147]"
                value={maquinaId}
                disabled={!canEdit || loading || maquinas.length === 0}
                onChange={(e) => {
                  if (dirty && canEdit) {
                    const ok = window.confirm(
                      "Cambiar de máquina descarta el borrador actual. ¿Continuar?",
                    );
                    if (!ok) return;
                  }
                  setMaquinaId(e.target.value);
                }}
              >
                {maquinas.length === 0 ? (
                  <option value="">Sin máquinas</option>
                ) : (
                  maquinas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))
                )}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={draft.length === 0}
              onClick={() => handlePrint()}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-2">
                <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Sin secuencia ({sinSecuencia.length})
                  </h3>
                  {sinSecuencia.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-500">
                      Todas las pendientes están en secuencia.
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
                            <div className="flex shrink-0 flex-col gap-0.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 gap-0.5 px-1.5 text-[10px]"
                                disabled={saving || !maquinaId}
                                onClick={() => addToTurno(l, "manana")}
                              >
                                <Plus className="size-3" /> M
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 gap-0.5 px-1.5 text-[10px]"
                                disabled={saving || !maquinaId}
                                onClick={() => addToTurno(l, "tarde")}
                              >
                                <Plus className="size-3" /> T
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {hechasLineas.length > 0 ? (
                  <section className="rounded-lg border border-slate-200 bg-white p-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      onClick={() => setHechasOpen((v) => !v)}
                    >
                      Hechas ({hechasLineas.length})
                      <ChevronDown
                        className={`size-3.5 transition ${hechasOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {hechasOpen ? (
                      <ul className="mt-2 space-y-1">
                        {hechasLineas.map((l) => (
                          <li
                            key={l.id}
                            className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 opacity-70"
                          >
                            <p className="font-mono text-xs font-semibold text-slate-600 line-through">
                              {l.otNumero}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {l.trabajo?.trim() || "—"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ) : null}
              </div>

              <div className="space-y-2">
                {renderTurnoList("manana", draftManana)}
                {renderTurnoList("tarde", draftTarde)}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={handleAtras}
          >
            Atrás
          </Button>
          <div className="flex gap-2">
            {canEdit ? (
              <Button
                type="button"
                className="bg-[#002147] hover:bg-[#003366]"
                disabled={saving || loading || !maquinaId}
                onClick={() => void handleGuardar()}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : null}
                Guardar orden
              </Button>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <CalendarioDetalleDiaPrintTemplate
        ref={printRef}
        dayYmd={dayYmd}
        dayLabel={dayLabel}
        ambito={ambito}
        maquinaNombre={maquinaNombre}
        draft={draft}
        trabajoByOt={trabajoByOt}
        generadoPor={userEmail}
      />
    </Dialog>
  );
}
