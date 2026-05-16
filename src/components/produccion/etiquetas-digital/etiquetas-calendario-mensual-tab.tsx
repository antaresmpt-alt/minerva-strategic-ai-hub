"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  apuntesPorDia,
  buildSemanasLaboralesMes,
  type CalendarioEventoAuto,
  diasLaborablesCabecera,
  eventosAutoPorDiaDesdeHojaRuta,
  fechaDiaLabel,
  filasHojaRutaEnMes,
  mesAnioLabel,
  monthRangeYmd,
  numColumnasCalendario,
  splitLineasDosColumnas,
} from "@/lib/etiquetas-calendario-mensual";
import { exportEtiquetasCalendarioMensualPdf } from "@/lib/etiquetas-calendario-mensual-export";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCalendarioApunteRow } from "@/types/prod-etiquetas-calendario-apunte";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import { cn } from "@/lib/utils";

const TABLE_HR = "prod_etiquetas_hoja_ruta";
const TABLE_APUNTE = "prod_etiquetas_calendario_apunte";

const MIGRATION_HINT =
  "Ejecuta la migración 20260517160000_prod_etiquetas_calendario_apunte.sql en Supabase.";

const STORAGE_SHOW_SATURDAY = "etiquetas-cal-show-saturday";

const TIPO_CLASS = {
  I: "font-semibold text-[#002147]",
  T: "font-medium text-slate-800",
  N: "font-medium text-slate-600",
} as const;

type LineaDia =
  | { kind: "evento"; ev: CalendarioEventoAuto }
  | { kind: "apunte"; apunte: ProdEtiquetasCalendarioApunteRow };

function lineasDia(
  eventos: CalendarioEventoAuto[],
  apuntes: ProdEtiquetasCalendarioApunteRow[]
): LineaDia[] {
  return [
    ...eventos.map((ev) => ({ kind: "evento" as const, ev })),
    ...apuntes.map((apunte) => ({ kind: "apunte" as const, apunte })),
  ];
}

function isMissingApunteTable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_etiquetas_calendario_apunte");
}

function LineaContenido({ linea }: { linea: LineaDia }) {
  if (linea.kind === "evento") {
    return (
      <div
        className={cn("break-words leading-tight", TIPO_CLASS[linea.ev.tipo])}
        title={`${linea.ev.label} (hoja de ruta)`}
      >
        {linea.ev.label}
      </div>
    );
  }
  return (
    <div className="break-words leading-tight text-slate-700">
      {linea.apunte.texto}
    </div>
  );
}

function ContenidoDia({
  eventos,
  apuntes,
}: {
  eventos: CalendarioEventoAuto[];
  apuntes: ProdEtiquetasCalendarioApunteRow[];
}) {
  const items = lineasDia(eventos, apuntes);
  const { left, right } = splitLineasDosColumnas(items);
  const dosColumnas = right.length > 0;

  if (items.length === 0) {
    return <div className="min-h-[2rem] flex-1" />;
  }

  if (!dosColumnas) {
    return (
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5 text-xs leading-snug">
        {items.map((linea) => (
          <LineaContenido
            key={
              linea.kind === "evento"
                ? `${linea.ev.tipo}-${linea.ev.otNumero}-${linea.ev.hojaRutaId}`
                : linea.apunte.id
            }
            linea={linea}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-1.5 overflow-y-auto p-1.5 text-xs leading-snug">
      <div className="space-y-0.5">
        {left.map((linea) => (
          <LineaContenido
            key={
              linea.kind === "evento"
                ? `${linea.ev.tipo}-${linea.ev.otNumero}-${linea.ev.hojaRutaId}`
                : linea.apunte.id
            }
            linea={linea}
          />
        ))}
      </div>
      <div className="space-y-0.5">
        {right.map((linea) => (
          <LineaContenido
            key={
              linea.kind === "evento"
                ? `${linea.ev.tipo}-${linea.ev.otNumero}-${linea.ev.hojaRutaId}`
                : linea.apunte.id
            }
            linea={linea}
          />
        ))}
      </div>
    </div>
  );
}

type DiaCeldaProps = {
  ymd: string;
  dayNum: number;
  eventos: CalendarioEventoAuto[];
  apuntes: ProdEtiquetasCalendarioApunteRow[];
  onEdit: () => void;
};

function DiaCalendarioCelda({
  dayNum,
  eventos,
  apuntes,
  onEdit,
}: DiaCeldaProps) {
  const tieneApuntes = apuntes.length > 0;

  return (
    <div className="group relative flex min-h-[9rem] flex-col border border-slate-200/90 bg-white">
      <div className="flex shrink-0 items-center justify-end bg-[#002147] px-2 py-1">
        <span className="text-sm font-bold tabular-nums text-white">{dayNum}</span>
      </div>
      <ContenidoDia eventos={eventos} apuntes={apuntes} />
      <button
        type="button"
        className={cn(
          "absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full border border-slate-200/90 bg-white shadow-sm transition-colors",
          "text-[#002147] hover:border-[#002147]/30 hover:bg-slate-50",
          "opacity-70 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]/40"
        )}
        title="Apuntes del día"
        aria-label={`Apuntes del día ${dayNum}`}
        onClick={onEdit}
      >
        <Pencil className="size-3" aria-hidden />
        {tieneApuntes ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500 ring-1 ring-white"
            aria-hidden
          />
        ) : null}
      </button>
    </div>
  );
}

type ApunteDialogProps = {
  open: boolean;
  ymd: string | null;
  dayNum: number;
  apuntes: ProdEtiquetasCalendarioApunteRow[];
  draft: string;
  saving: boolean;
  onDraftChange: (v: string) => void;
  onClose: () => void;
  onAdd: () => void;
  onDeleteApunte: (id: string) => void;
};

function ApunteDiaDialog({
  open,
  ymd,
  dayNum,
  apuntes,
  draft,
  saving,
  onDraftChange,
  onClose,
  onAdd,
  onDeleteApunte,
}: ApunteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#002147]">
            Día {dayNum}
            {ymd ? ` · ${fechaDiaLabel(ymd)}` : ""}
          </DialogTitle>
          <DialogDescription>
            Apuntes libres de este calendario. Las líneas I/T/N vienen de la hoja
            de ruta.
          </DialogDescription>
        </DialogHeader>

        {apuntes.length > 0 ? (
          <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200/90 bg-slate-50/50 p-2 text-sm">
            {apuntes.map((a) => (
              <li
                key={a.id}
                className="group flex items-start justify-between gap-2"
              >
                <span className="min-w-0 flex-1 whitespace-pre-wrap text-slate-800">
                  {a.texto}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Borrar apunte"
                  disabled={saving}
                  onClick={() => onDeleteApunte(a.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sin apuntes en este día.</p>
        )}

        <Textarea
          placeholder="Nuevo apunte…"
          value={draft}
          disabled={saving}
          rows={4}
          className="text-sm"
          onChange={(e) => onDraftChange(e.target.value)}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            disabled={saving || !draft.trim()}
            onClick={onAdd}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Guardar apunte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EtiquetasCalendarioMensualTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [hojaRuta, setHojaRuta] = useState<
    Pick<
      ProdEtiquetasHojaRutaRow,
      | "id"
      | "ot_numero"
      | "fecha_fin_konica"
      | "fecha_fin_troqueladora"
      | "fecha_fin_numeradora"
    >[]
  >([]);
  const [apuntes, setApuntes] = useState<ProdEtiquetasCalendarioApunteRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingYmd, setEditingYmd] = useState<string | null>(null);
  const [editingDayNum, setEditingDayNum] = useState(0);
  const [apunteDraft, setApunteDraft] = useState("");
  const [showSaturday, setShowSaturday] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_SHOW_SATURDAY);
      if (v === "1") setShowSaturday(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SHOW_SATURDAY, showSaturday ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [showSaturday]);

  const { start, end } = useMemo(
    () => monthRangeYmd(year, monthIndex),
    [year, monthIndex]
  );

  const semanas = useMemo(
    () => buildSemanasLaboralesMes(year, monthIndex, { includeSaturday: showSaturday }),
    [year, monthIndex, showSaturday]
  );

  const diasCabecera = useMemo(
    () => diasLaborablesCabecera(showSaturday),
    [showSaturday]
  );

  const numCols = numColumnasCalendario(showSaturday);

  const eventosMap = useMemo(() => {
    const enMes = filasHojaRutaEnMes(hojaRuta, start, end);
    return eventosAutoPorDiaDesdeHojaRuta(enMes);
  }, [hojaRuta, start, end]);

  const apuntesMap = useMemo(() => apuntesPorDia(apuntes), [apuntes]);

  const load = useCallback(async () => {
    setLoading(true);
    const [rHr, rAp] = await Promise.all([
      supabase
        .from(TABLE_HR)
        .select(
          "id, ot_numero, fecha_fin_konica, fecha_fin_troqueladora, fecha_fin_numeradora"
        ),
      supabase
        .from(TABLE_APUNTE)
        .select("id, fecha, texto, orden, created_at, updated_at")
        .gte("fecha", start)
        .lte("fecha", end)
        .order("fecha")
        .order("orden")
        .order("created_at"),
    ]);
    setLoading(false);

    if (rHr.error) {
      setHojaRuta([]);
      toast.error("No se pudo cargar la hoja de ruta", {
        description: rHr.error.message,
      });
    } else {
      setHojaRuta(rHr.data ?? []);
    }

    if (rAp.error) {
      setApuntes([]);
      if (isMissingApunteTable(rAp.error.message)) {
        toast.error("Falta la tabla de apuntes", {
          id: "etq-cal-apunte-missing",
          description: MIGRATION_HINT,
        });
      } else {
        toast.error("No se pudieron cargar los apuntes", {
          description: rAp.error.message,
        });
      }
    } else {
      setApuntes((rAp.data ?? []) as ProdEtiquetasCalendarioApunteRow[]);
    }
  }, [end, start, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeApunteDialog = useCallback(() => {
    setEditingYmd(null);
    setApunteDraft("");
  }, []);

  const openApunteDialog = useCallback((ymd: string, dayNum: number) => {
    setEditingYmd(ymd);
    setEditingDayNum(dayNum);
    setApunteDraft("");
  }, []);

  const shiftMonth = useCallback(
    (delta: number) => {
      closeApunteDialog();
      const d = new Date(year, monthIndex + delta, 1);
      setYear(d.getFullYear());
      setMonthIndex(d.getMonth());
    },
    [closeApunteDialog, monthIndex, year]
  );

  const addApunte = useCallback(async () => {
    if (!editingYmd) return;
    const texto = apunteDraft.trim();
    if (!texto) return;
    setSaving(true);
    const { data, error } = await supabase
      .from(TABLE_APUNTE)
      .insert({
        fecha: editingYmd,
        texto,
        orden: apuntesMap.get(editingYmd)?.length ?? 0,
      })
      .select("id, fecha, texto, orden, created_at, updated_at")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApuntes((prev) => [...prev, data as ProdEtiquetasCalendarioApunteRow]);
    setApunteDraft("");
    toast.success("Apunte guardado");
  }, [apunteDraft, apuntesMap, editingYmd, supabase]);

  const deleteApunte = useCallback(
    async (id: string) => {
      if (!window.confirm("¿Borrar este apunte?")) return;
      setSaving(true);
      const { data, error } = await supabase
        .from(TABLE_APUNTE)
        .delete()
        .eq("id", id)
        .select("id");
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data?.length) {
        toast.error("No se pudo borrar el apunte.");
        return;
      }
      setApuntes((prev) => prev.filter((a) => a.id !== id));
    },
    [supabase]
  );

  const exportPdf = useCallback(() => {
    exportEtiquetasCalendarioMensualPdf({
      year,
      monthIndex,
      includeSaturday: showSaturday,
      semanas,
      eventosMap,
      apuntesMap,
    });
    toast.success("PDF del mes descargado");
  }, [apuntesMap, eventosMap, monthIndex, semanas, showSaturday, year]);

  const editingApuntes = editingYmd
    ? (apuntesMap.get(editingYmd) ?? [])
    : [];

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">
            Calendario mensual
          </h2>
          <p className="text-xs text-slate-600">
            {showSaturday ? "Lun–sáb" : "Lun–vie"} ·{" "}
            <strong className="text-[#002147]">I/T/N</strong> desde hoja de ruta
            · lápiz para apuntes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={showSaturday}
              onChange={(e) => setShowSaturday(e.target.checked)}
              aria-label="Mostrar sábado"
            />
            Mostrar sábado
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[8rem] text-center text-sm font-semibold text-[#002147]">
            {mesAnioLabel(year, monthIndex)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualizar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={exportPdf}
          >
            <FileDown className="size-4" />
            PDF mes
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando calendario…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-slate-50/50 p-2 shadow-sm">
          <div
            className={cn("grid gap-1", showSaturday ? "min-w-[860px]" : "min-w-[720px]")}
            style={{
              gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
            }}
          >
            {diasCabecera.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-xs font-semibold text-[#002147]"
              >
                {d}
              </div>
            ))}
            {semanas.map((semana, wi) =>
              semana.map((dia, di) =>
                dia ? (
                  <DiaCalendarioCelda
                    key={dia.ymd}
                    ymd={dia.ymd}
                    dayNum={dia.dayNum}
                    eventos={eventosMap.get(dia.ymd) ?? []}
                    apuntes={apuntesMap.get(dia.ymd) ?? []}
                    onEdit={() => openApunteDialog(dia.ymd, dia.dayNum)}
                  />
                ) : (
                  <div
                    key={`empty-${wi}-${di}`}
                    className="min-h-[9rem] border border-dashed border-slate-200/60 bg-slate-100/40"
                  />
                )
              )
            )}
          </div>
        </div>
      )}

      <ApunteDiaDialog
        open={editingYmd != null}
        ymd={editingYmd}
        dayNum={editingDayNum}
        apuntes={editingApuntes}
        draft={apunteDraft}
        saving={saving}
        onDraftChange={setApunteDraft}
        onClose={closeApunteDialog}
        onAdd={() => void addApunte()}
        onDeleteApunte={(id) => void deleteApunte(id)}
      />

      <p className="text-[11px] text-slate-500">
        Las líneas <strong>I-</strong>, <strong>T-</strong> y <strong>N-</strong>{" "}
        se generan al marcar Kon / Troq / Num en hoja de ruta. Los apuntes son
        solo de este calendario.
      </p>
    </div>
  );
}
