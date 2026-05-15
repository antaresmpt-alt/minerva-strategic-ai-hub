"use client";

import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  apuntesPorDia,
  buildSemanasLaboralesMes,
  type CalendarioEventoAuto,
  DIAS_LABORABLES,
  eventosAutoPorDiaDesdeHojaRuta,
  filasHojaRutaEnMes,
  mesAnioLabel,
  monthRangeYmd,
} from "@/lib/etiquetas-calendario-mensual";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCalendarioApunteRow } from "@/types/prod-etiquetas-calendario-apunte";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import { cn } from "@/lib/utils";

const TABLE_HR = "prod_etiquetas_hoja_ruta";
const TABLE_APUNTE = "prod_etiquetas_calendario_apunte";

const MIGRATION_HINT =
  "Ejecuta la migración 20260517160000_prod_etiquetas_calendario_apunte.sql en Supabase.";

const TIPO_CLASS = {
  I: "font-semibold text-[#002147]",
  T: "font-medium text-slate-800",
  N: "font-medium text-slate-600",
} as const;

function isMissingApunteTable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_etiquetas_calendario_apunte");
}

type DiaEditorProps = {
  ymd: string;
  dayNum: number;
  eventos: CalendarioEventoAuto[];
  apuntes: ProdEtiquetasCalendarioApunteRow[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onDeleteApunte: (id: string) => void;
  saving: boolean;
};

function DiaCalendarioCelda({
  ymd,
  dayNum,
  eventos,
  apuntes,
  draft,
  onDraftChange,
  onAdd,
  onDeleteApunte,
  saving,
}: DiaEditorProps) {
  return (
    <div className="flex min-h-[7.5rem] flex-col border border-slate-200/90 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-1.5 py-0.5">
        <span className="text-[11px] font-bold tabular-nums text-[#002147]">
          {dayNum}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1 text-[10px] leading-snug">
        {eventos.map((ev) => (
          <div
            key={`${ev.tipo}-${ev.otNumero}-${ev.hojaRutaId}`}
            className={cn("truncate", TIPO_CLASS[ev.tipo])}
            title={`${ev.label} (hoja de ruta)`}
          >
            {ev.label}
          </div>
        ))}
        {apuntes.map((a) => (
          <div
            key={a.id}
            className="group flex items-start gap-0.5 text-slate-700"
          >
            <span className="min-w-0 flex-1 break-words">{a.texto}</span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              title="Borrar apunte"
              disabled={saving}
              onClick={() => onDeleteApunte(a.id)}
            >
              <Trash2 className="size-2.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-1">
        <form
          className="flex gap-0.5"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd();
          }}
        >
          <Input
            className="h-6 min-h-0 flex-1 px-1 text-[10px]"
            placeholder="Apunte…"
            value={draft}
            disabled={saving}
            onChange={(e) => onDraftChange(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-6 px-1.5 text-[10px]"
            disabled={saving || !draft.trim()}
          >
            +
          </Button>
        </form>
      </div>
    </div>
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
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { start, end } = useMemo(
    () => monthRangeYmd(year, monthIndex),
    [year, monthIndex]
  );

  const semanas = useMemo(
    () => buildSemanasLaboralesMes(year, monthIndex),
    [year, monthIndex]
  );

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

  const shiftMonth = useCallback(
    (delta: number) => {
      setDrafts({});
      const d = new Date(year, monthIndex + delta, 1);
      setYear(d.getFullYear());
      setMonthIndex(d.getMonth());
    },
    [monthIndex, year]
  );

  const addApunte = useCallback(
    async (ymd: string) => {
      const texto = (drafts[ymd] ?? "").trim();
      if (!texto) return;
      setSaving(true);
      const { data, error } = await supabase
        .from(TABLE_APUNTE)
        .insert({ fecha: ymd, texto, orden: apuntesMap.get(ymd)?.length ?? 0 })
        .select("id, fecha, texto, orden, created_at, updated_at")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setApuntes((prev) => [...prev, data as ProdEtiquetasCalendarioApunteRow]);
      setDrafts((d) => ({ ...d, [ymd]: "" }));
    },
    [apuntesMap, drafts, supabase]
  );

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">
            Calendario mensual
          </h2>
          <p className="text-xs text-slate-600">
            Lun–vie · <strong className="text-[#002147]">I/T/N</strong> desde
            hoja de ruta · apuntes libres por día
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            className="grid min-w-[640px] gap-1"
            style={{
              gridTemplateColumns: `repeat(${DIAS_LABORABLES.length}, minmax(0, 1fr))`,
            }}
          >
            {DIAS_LABORABLES.map((d) => (
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
                    draft={drafts[dia.ymd] ?? ""}
                    onDraftChange={(v) =>
                      setDrafts((d) => ({ ...d, [dia.ymd]: v }))
                    }
                    onAdd={() => void addApunte(dia.ymd)}
                    onDeleteApunte={(id) => void deleteApunte(id)}
                    saving={saving}
                  />
                ) : (
                  <div
                    key={`empty-${wi}-${di}`}
                    className="min-h-[7.5rem] border border-dashed border-slate-200/60 bg-slate-100/40"
                  />
                )
              )
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Las líneas <strong>I-</strong>, <strong>T-</strong> y <strong>N-</strong>{" "}
        se generan al marcar Kon / Troq / Num en hoja de ruta. Los apuntes son
        solo de este calendario.
      </p>
    </div>
  );
}
