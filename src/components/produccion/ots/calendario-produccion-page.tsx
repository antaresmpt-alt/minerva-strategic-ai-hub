"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Route,
  Scissors,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { HojaRutaOtDialog } from "@/components/produccion/hoja-ruta/hoja-ruta-ot-dialog";
import { STEP_BADGE_STYLES } from "@/components/produccion/hoja-ruta/hoja-ruta-step-styles";
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
import {
  buildSemanaLaboral,
  buildSemanasLaboralesMes,
  entradasPorDia,
  fechaDiaLabel,
  filtrarEntradasPorTexto,
  mesAnioLabel,
  mondayOfWeek,
  monthRangeYmd,
  numColumnasCalendario,
  semanaLabelEs,
  weekRangeYmd,
  type CalendarioProduccionLinea,
} from "@/lib/calendario-produccion";
import {
  exportCalendarioProduccionDiaPdf,
  exportCalendarioProduccionListadoPdf,
  exportCalendarioProduccionMensualPdf,
  exportCalendarioProduccionSemanaPdf,
} from "@/lib/calendario-produccion-export";
import { parseProgramacioPlanificadorExcel } from "@/lib/calendario-produccion-import";
import {
  fetchPasosResumenOt,
  fetchProgresoByOtNumeros,
  PROGRESO_PILL_STYLES,
  type CalendarioOtProgreso,
} from "@/lib/calendario-produccion-progreso";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { resolveEstadoOtLabel } from "@/lib/hoja-ruta/hoja-ruta-query";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type {
  CalendarioProduccionOtDetalle,
  ProdCalendarioProduccionOtRow,
} from "@/types/prod-calendario-produccion-ot";

const TABLE = "prod_calendario_produccion_ot";
const TABLE_MAESTRO = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

const MIGRATION_HINT =
  "Ejecuta la migración 20260717140000_prod_calendario_produccion_ot.sql en Supabase.";

const STORAGE_SHOW_SATURDAY = "cal-prod-show-saturday";
const STORAGE_VISTA = "cal-prod-vista";

type VistaCalendario = "mes" | "semana";

type PortapapelesOt = {
  id: string;
  otNumero: string;
  fromFecha: string;
  label: string;
};

function isMissingTable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_calendario_produccion_ot");
}

type OtSearchHit = {
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
};

function DiaCelda({
  dayNum,
  lineas,
  onEditDay,
  onOpenOt,
  progresoByOt,
  variant = "mes",
}: {
  dayNum: number;
  lineas: CalendarioProduccionLinea[];
  onEditDay: () => void;
  onOpenOt: (otNumero: string) => void;
  progresoByOt: Map<string, CalendarioOtProgreso>;
  /** Semana: tipografía mayor y más altura de celda. */
  variant?: "mes" | "semana";
}) {
  const isSemana = variant === "semana";

  return (
    <div
      className={
        isSemana
          ? "group relative flex min-h-[min(70vh,42rem)] flex-col border border-slate-200/90 bg-white"
          : "group relative flex min-h-[11rem] flex-col border border-slate-200/90 bg-white"
      }
    >
      <div className="flex shrink-0 items-center justify-between bg-[#002147] px-2 py-1.5">
        <button
          type="button"
          className="rounded px-1 text-[10px] font-medium text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-white/10"
          onClick={onEditDay}
          title="Añadir / editar OTs del día"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className={
            isSemana
              ? "shrink-0 text-base font-bold tabular-nums text-white hover:underline"
              : "shrink-0 text-sm font-bold tabular-nums text-white hover:underline"
          }
          onClick={onEditDay}
          title="Editar día"
        >
          {dayNum}
        </button>
      </div>
      {lineas.length === 0 ? (
        <button
          type="button"
          className={
            isSemana
              ? "min-h-[3rem] flex-1 p-2.5 text-left text-sm text-slate-400 hover:bg-slate-50"
              : "min-h-[2rem] flex-1 p-1.5 text-left text-[10px] text-slate-400 hover:bg-slate-50"
          }
          onClick={onEditDay}
        >
          + OT
        </button>
      ) : (
        <div
          className={
            isSemana
              ? "min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
              : "min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5"
          }
        >
          {lineas.map((l) => {
            const progreso =
              progresoByOt.get(l.otNumero) ?? "sin_itinerario";
            const styles = PROGRESO_PILL_STYLES[progreso];
            return (
              <button
                key={l.id}
                type="button"
                title={`${l.label} — ${styles.title}`}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md border border-slate-200/90 bg-white text-left shadow-xs",
                  "border-l-[3px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#002147]/40",
                  styles.border,
                  isSemana ? "px-2 py-1.5" : "px-1.5 py-1",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenOt(l.otNumero);
                }}
              >
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 font-mono font-bold tabular-nums",
                    styles.otBadge,
                    isSemana ? "text-[13px]" : "text-[12px]",
                  )}
                >
                  {l.otNumero}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium text-[#002147]",
                    isSemana
                      ? "text-[13px] leading-snug"
                      : "text-[11px] leading-tight",
                  )}
                >
                  {l.trabajo?.trim() || "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CalendarioProduccionPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeek(now));
  const [vista, setVista] = useState<VistaCalendario>("mes");
  const [showSaturday, setShowSaturday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ProdCalendarioProduccionOtRow[]>([]);
  const [tituloByOt, setTituloByOt] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [filtro, setFiltro] = useState("");
  const [saving, setSaving] = useState(false);
  const [portapapeles, setPortapapeles] = useState<PortapapelesOt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayYmd, setDayYmd] = useState<string | null>(null);
  const [otQuery, setOtQuery] = useState("");
  const [otHits, setOtHits] = useState<OtSearchHit[]>([]);
  const [searchingOt, setSearchingOt] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalle, setDetalle] = useState<CalendarioProduccionOtDetalle | null>(
    null,
  );
  const [progresoByOt, setProgresoByOt] = useState<
    Map<string, CalendarioOtProgreso>
  >(() => new Map());
  const [hojaRutaOt, setHojaRutaOt] = useState<string | null>(null);
  const [hojaRutaOpen, setHojaRutaOpen] = useState(false);

  useEffect(() => {
    try {
      setShowSaturday(localStorage.getItem(STORAGE_SHOW_SATURDAY) === "1");
      const v = localStorage.getItem(STORAGE_VISTA);
      if (v === "semana" || v === "mes") setVista(v);
    } catch {
      /* ignore */
    }
  }, []);

  const semanasMes = useMemo(
    () => buildSemanasLaboralesMes(year, monthIndex, { includeSaturday: showSaturday }),
    [year, monthIndex, showSaturday],
  );
  const semanaActual = useMemo(
    () => buildSemanaLaboral(weekMonday, { includeSaturday: showSaturday }),
    [weekMonday, showSaturday],
  );
  const cols = numColumnasCalendario(showSaturday);
  const range = useMemo(() => {
    if (vista === "semana") {
      return weekRangeYmd(weekMonday, showSaturday);
    }
    return monthRangeYmd(year, monthIndex);
  }, [vista, weekMonday, showSaturday, year, monthIndex]);

  const entradasByDay = useMemo(() => {
    const all = entradasPorDia(rows, tituloByOt);
    return filtrarEntradasPorTexto(all, filtro);
  }, [rows, tituloByOt, filtro]);

  const dayLineas = useMemo(() => {
    if (!dayYmd) return [];
    return entradasByDay.get(dayYmd) ?? [];
  }, [dayYmd, entradasByDay]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, fecha, ot_numero, orden, notas, created_by, created_at, updated_at")
        .gte("fecha", range.start)
        .lte("fecha", range.end)
        .order("fecha", { ascending: true })
        .order("orden", { ascending: true });

      if (error) {
        if (isMissingTable(error.message)) {
          toast.error(MIGRATION_HINT);
          setRows([]);
          return;
        }
        throw error;
      }

      const list = (data ?? []) as ProdCalendarioProduccionOtRow[];
      setRows(list);

      const ots = [
        ...new Set(list.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean)),
      ];
      if (ots.length === 0) {
        setTituloByOt(new Map());
        setProgresoByOt(new Map());
        return;
      }

      const { data: maestros, error: mErr } = await supabase
        .from(TABLE_MAESTRO)
        .select("num_pedido, titulo")
        .in("num_pedido", ots);
      if (mErr) throw mErr;

      const map = new Map<string, string | null>();
      for (const m of maestros ?? []) {
        const n = String((m as { num_pedido?: string }).num_pedido ?? "").trim();
        if (n) map.set(n, (m as { titulo?: string | null }).titulo ?? null);
      }
      setTituloByOt(map);

      try {
        const progreso = await fetchProgresoByOtNumeros(supabase, ots);
        setProgresoByOt(progreso);
      } catch (progErr) {
        console.warn("[calendario] progreso itinerario", progErr);
        setProgresoByOt(new Map());
      }
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el calendario."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, range.start, range.end]);

  useEffect(() => {
    void load();
  }, [load]);

  const setVistaPersist = (v: VistaCalendario) => {
    setVista(v);
    try {
      localStorage.setItem(STORAGE_VISTA, v);
    } catch {
      /* ignore */
    }
    if (v === "semana") {
      setWeekMonday(mondayOfWeek(new Date(year, monthIndex, 15)));
    } else {
      setYear(weekMonday.getFullYear());
      setMonthIndex(weekMonday.getMonth());
    }
  };

  const shiftPeriod = (delta: number) => {
    if (vista === "semana") {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + delta * 7);
      setWeekMonday(mondayOfWeek(d));
      setYear(d.getFullYear());
      setMonthIndex(d.getMonth());
      return;
    }
    const d = new Date(year, monthIndex + delta, 1);
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  };

  const goHoy = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonthIndex(t.getMonth());
    setWeekMonday(mondayOfWeek(t));
  };

  const importExcel = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseProgramacioPlanificadorExcel(buffer);
      if (parsed.length === 0) {
        toast.message(
          "No se encontraron OTs en la pestaña «planificador».",
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const chunkSize = 80;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize).map((r) => ({
          fecha: r.fecha,
          ot_numero: r.ot_numero,
          orden: r.orden,
          created_by: user?.id ?? null,
        }));
        const { error } = await supabase.from(TABLE).upsert(chunk, {
          onConflict: "fecha,ot_numero",
        });
        if (error) throw error;
      }

      const first = parsed[0]!;
      const [y, m] = first.fecha.split("-").map(Number);
      const anchor = new Date(y!, (m ?? 1) - 1, Number(first.fecha.slice(8, 10)), 12);
      setYear(anchor.getFullYear());
      setMonthIndex(anchor.getMonth());
      setWeekMonday(mondayOfWeek(anchor));
      setVista("semana");
      try {
        localStorage.setItem(STORAGE_VISTA, "semana");
      } catch {
        /* ignore */
      }

      toast.success(`${parsed.length} OTs importadas desde Excel.`);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo importar el Excel."));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openDay = (ymd: string) => {
    setDayYmd(ymd);
    setOtQuery("");
    setOtHits([]);
    setDayOpen(true);
  };

  const searchOts = useCallback(
    async (q: string) => {
      const needle = q.trim().replace(/[%_,]/g, " ").trim();
      if (needle.length < 2) {
        setOtHits([]);
        return;
      }
      setSearchingOt(true);
      try {
        const { data, error } = await supabase
          .from(TABLE_MAESTRO)
          .select("num_pedido, cliente, titulo, cantidad")
          .or(
            `num_pedido.ilike.%${needle}%,titulo.ilike.%${needle}%,cliente.ilike.%${needle}%`,
          )
          .order("num_pedido", { ascending: false })
          .limit(12);
        if (error) throw error;
        setOtHits(
          ((data ?? []) as OtSearchHit[]).filter((h) =>
            String(h.num_pedido ?? "").trim(),
          ),
        );
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo buscar la OT."));
        setOtHits([]);
      } finally {
        setSearchingOt(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!dayOpen) return;
    const t = window.setTimeout(() => void searchOts(otQuery), 280);
    return () => window.clearTimeout(t);
  }, [otQuery, dayOpen, searchOts]);

  const addOtToDay = async (hit: OtSearchHit) => {
    if (!dayYmd) return;
    const ot = String(hit.num_pedido ?? "").trim();
    if (!ot) return;
    setSaving(true);
    try {
      const existing = rows.filter((r) => r.fecha.slice(0, 10) === dayYmd);
      const nextOrden =
        existing.length === 0
          ? 0
          : Math.max(...existing.map((r) => r.orden)) + 1;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from(TABLE).insert({
        fecha: dayYmd,
        ot_numero: ot,
        orden: nextOrden,
        created_by: user?.id ?? null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.message(`La OT ${ot} ya está en este día.`);
          return;
        }
        throw error;
      }

      setTituloByOt((prev) => {
        const next = new Map(prev);
        next.set(ot, hit.titulo ?? null);
        return next;
      });
      toast.success(`OT ${ot} añadida.`);
      setOtQuery("");
      setOtHits([]);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo añadir la OT."));
    } finally {
      setSaving(false);
    }
  };

  const removeEntrada = async (id: string) => {
    setSaving(true);
    try {
      const { error, count } = await supabase
        .from(TABLE)
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if (count === 0) {
        toast.error(
          "No se pudo quitar (permiso o ya no existe). Recarga e inténtalo.",
        );
        return;
      }
      if (portapapeles?.id === id) setPortapapeles(null);
      toast.success("OT quitada del planificador.");
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar la OT."));
    } finally {
      setSaving(false);
    }
  };

  const cortarEntrada = (linea: CalendarioProduccionLinea) => {
    if (!dayYmd) return;
    setPortapapeles({
      id: linea.id,
      otNumero: linea.otNumero,
      fromFecha: dayYmd,
      label: linea.label,
    });
    toast.message(`OT ${linea.otNumero} cortada. Abre otro día y pega.`);
  };

  const pegarEnDia = async () => {
    if (!dayYmd || !portapapeles) return;
    if (portapapeles.fromFecha === dayYmd) {
      toast.message("Ya está en este día.");
      setPortapapeles(null);
      return;
    }
    setSaving(true);
    try {
      const existing = rows.filter((r) => r.fecha.slice(0, 10) === dayYmd);
      const nextOrden =
        existing.length === 0
          ? 0
          : Math.max(...existing.map((r) => r.orden)) + 1;

      const { error } = await supabase
        .from(TABLE)
        .update({ fecha: dayYmd, orden: nextOrden })
        .eq("id", portapapeles.id);
      if (error) {
        if (error.code === "23505") {
          toast.error(
            `La OT ${portapapeles.otNumero} ya está en este día. Quítala del origen o elige otro.`,
          );
          return;
        }
        throw error;
      }
      toast.success(
        `OT ${portapapeles.otNumero} movida a ${fechaDiaLabel(dayYmd)}.`,
      );
      setPortapapeles(null);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo pegar la OT."));
    } finally {
      setSaving(false);
    }
  };

  const openDetalle = async (otNumero: string) => {
    setDetalleOpen(true);
    setDetalle(null);
    setDetalleLoading(true);
    try {
      const ot = otNumero.trim();
      const [
        { data: maestro, error: mErr },
        { data: despacho, error: dErr },
        pasos,
      ] = await Promise.all([
        supabase
          .from(TABLE_MAESTRO)
          .select(
            "num_pedido, cliente, titulo, cantidad, fecha_entrega, despachado, estado_desc",
          )
          .eq("num_pedido", ot)
          .maybeSingle(),
        supabase
          .from(TABLE_DESPACHADAS)
          .select(
            "material, gramaje, tamano_hoja, tintas, acabado_pral, troquel, poses, num_hojas_brutas, num_hojas_netas",
          )
          .eq("ot_numero", ot)
          .maybeSingle(),
        fetchPasosResumenOt(supabase, ot).catch(() => []),
      ]);
      if (mErr) throw mErr;
      if (dErr) throw dErr;

      const m = maestro as {
        cliente?: string | null;
        titulo?: string | null;
        cantidad?: number | null;
        fecha_entrega?: string | null;
        despachado?: boolean | null;
        estado_desc?: string | null;
      } | null;
      const d = despacho as {
        material?: string | null;
        gramaje?: number | null;
        tamano_hoja?: string | null;
        tintas?: string | null;
        acabado_pral?: string | null;
        troquel?: string | null;
        poses?: number | null;
        num_hojas_brutas?: number | null;
        num_hojas_netas?: number | null;
      } | null;

      setDetalle({
        otNumero: ot,
        cliente: m?.cliente ?? null,
        trabajo: m?.titulo ?? null,
        cantidad: m?.cantidad ?? null,
        fechaEntrega: m?.fecha_entrega ?? null,
        despachado: Boolean(m?.despachado),
        estadoOt: resolveEstadoOtLabel(m?.estado_desc ?? null, pasos),
        material: d?.material ?? null,
        gramaje: d?.gramaje ?? null,
        tamanoHoja: d?.tamano_hoja ?? null,
        tintas: d?.tintas ?? null,
        acabadoPral: d?.acabado_pral ?? null,
        troquel: d?.troquel ?? null,
        poses: d?.poses ?? null,
        hojasBrutas: d?.num_hojas_brutas ?? null,
        hojasNetas: d?.num_hojas_netas ?? null,
        pasos,
      });
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el detalle."));
      setDetalleOpen(false);
    } finally {
      setDetalleLoading(false);
    }
  };

  const exportMes = () => {
    exportCalendarioProduccionMensualPdf({
      year,
      monthIndex,
      semanas: semanasMes,
      entradasByDay,
      includeSaturday: showSaturday,
      filtroTexto: filtro,
    });
  };

  const exportSemana = () => {
    exportCalendarioProduccionSemanaPdf({
      weekMonday,
      semana: semanaActual,
      entradasByDay,
      includeSaturday: showSaturday,
      filtroTexto: filtro,
      tituloSemana: semanaLabelEs(weekMonday, showSaturday),
    });
  };

  const exportListado = () => {
    if (vista === "semana") {
      const dias = semanaActual
        .filter((c): c is { ymd: string; dayNum: number } => c != null)
        .map((c) => ({ ymd: c.ymd, titulo: fechaDiaLabel(c.ymd) }));
      const ymd = `${weekMonday.getFullYear()}-${String(weekMonday.getMonth() + 1).padStart(2, "0")}-${String(weekMonday.getDate()).padStart(2, "0")}`;
      exportCalendarioProduccionListadoPdf({
        titulo: "Calendario Producción — Listado semana",
        subtitulo: semanaLabelEs(weekMonday, showSaturday),
        dias,
        entradasByDay,
        filtroTexto: filtro,
        filenameStem: `calendario-produccion-semana-${ymd}`,
      });
      return;
    }
    const dias: { ymd: string; titulo: string }[] = [];
    for (const semana of semanasMes) {
      for (const celda of semana) {
        if (!celda) continue;
        dias.push({ ymd: celda.ymd, titulo: fechaDiaLabel(celda.ymd) });
      }
    }
    exportCalendarioProduccionListadoPdf({
      titulo: "Calendario Producción — Listado mes",
      subtitulo: mesAnioLabel(year, monthIndex),
      dias,
      entradasByDay,
      filtroTexto: filtro,
      filenameStem: `calendario-produccion-${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    });
  };

  const exportDia = () => {
    if (!dayYmd) return;
    exportCalendarioProduccionDiaPdf({
      ymd: dayYmd,
      tituloDia: fechaDiaLabel(dayYmd),
      lineas: dayLineas,
    });
  };

  const cabecera = useMemo(() => {
    const base = ["Lun", "Mar", "Mié", "Jue", "Vie"];
    return showSaturday ? [...base, "Sáb"] : base;
  }, [showSaturday]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">
            Calendario Producción
          </h2>
          <p className="text-xs text-slate-600">
            Coloca OTs por día. Vista mes o semana (como el Excel de
            programación). Pastilla = OT + trabajo; clic para resumen e
            itinerario.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            <Button
              type="button"
              variant={vista === "mes" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVistaPersist("mes")}
            >
              Mes
            </Button>
            <Button
              type="button"
              variant={vista === "semana" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVistaPersist("semana")}
            >
              Semana
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shiftPeriod(-1)}
            aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[11rem] text-center text-sm font-semibold text-[#002147]">
            {vista === "semana"
              ? semanaLabelEs(weekMonday, showSaturday)
              : mesAnioLabel(year, monthIndex)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shiftPeriod(1)}
            aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goHoy}>
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importExcel(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            title="Importar pestaña planificador del Excel de programación"
          >
            {importing ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1 size-4" />
            )}
            Importar Excel
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={
                vista === "mes"
                  ? "PDF grid del mes (como pantalla)"
                  : "PDF grid de la semana (como pantalla)"
              }
              onClick={() => {
                if (vista === "mes") exportMes();
                else exportSemana();
              }}
            >
              <FileDown className="mr-1 size-4" />
              PDF grid
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="PDF listado por día (legible en papel)"
              onClick={exportListado}
            >
              <FileDown className="mr-1 size-4" />
              PDF listado
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Filtrar OT / trabajo / cliente…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300"
            checked={showSaturday}
            onChange={(e) => {
              const v = e.target.checked;
              setShowSaturday(v);
              try {
                localStorage.setItem(STORAGE_SHOW_SATURDAY, v ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          />
          Mostrar sábado
        </label>
      </div>

      {portapapeles ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="min-w-0">
            <span className="font-semibold">Cortada:</span> OT{" "}
            {portapapeles.otNumero} · de {fechaDiaLabel(portapapeles.fromFecha)}.
            Abre otro día y pulsa Pegar.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => setPortapapeles(null)}
          >
            <X className="mr-1 size-3.5" />
            Cancelar
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Cargando calendario…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50">
          <div
            className="grid min-w-[640px] gap-px bg-slate-200"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {cabecera.map((d) => (
              <div
                key={d}
                className="bg-slate-100 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                {d}
              </div>
            ))}
            {vista === "semana"
              ? semanaActual.map((celda, ci) =>
                  celda ? (
                    <DiaCelda
                      key={celda.ymd}
                      dayNum={celda.dayNum}
                      lineas={entradasByDay.get(celda.ymd) ?? []}
                      onEditDay={() => openDay(celda.ymd)}
                      onOpenOt={(ot) => void openDetalle(ot)}
                      variant="semana"
                      progresoByOt={progresoByOt}
                    />
                  ) : (
                    <div
                      key={`empty-w-${ci}`}
                      className="min-h-[min(70vh,42rem)] bg-slate-100/60"
                    />
                  ),
                )
              : semanasMes.map((semana, si) =>
                  semana.map((celda, ci) =>
                    celda ? (
                      <DiaCelda
                        key={celda.ymd}
                        dayNum={celda.dayNum}
                        lineas={entradasByDay.get(celda.ymd) ?? []}
                        onEditDay={() => openDay(celda.ymd)}
                        onOpenOt={(ot) => void openDetalle(ot)}
                        variant="mes"
                        progresoByOt={progresoByOt}
                      />
                    ) : (
                      <div
                        key={`empty-${si}-${ci}`}
                        className="min-h-[11rem] bg-slate-100/60"
                      />
                    ),
                  ),
                )}
          </div>
        </div>
      )}

      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>OTs del día</DialogTitle>
            <DialogDescription>
              {dayYmd ? fechaDiaLabel(dayYmd) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {portapapeles && dayYmd && portapapeles.fromFecha !== dayYmd ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full"
                disabled={saving}
                onClick={() => void pegarEnDia()}
              >
                <ClipboardPaste className="mr-1.5 size-4" />
                Pegar OT {portapapeles.otNumero} aquí
              </Button>
            ) : null}

            <div>
              <Label className="text-xs">Añadir OT</Label>
              <Input
                className="mt-1"
                placeholder="Buscar nº OT, cliente o trabajo…"
                value={otQuery}
                onChange={(e) => setOtQuery(e.target.value)}
              />
              {searchingOt ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" /> Buscando…
                </p>
              ) : null}
              {otHits.length > 0 ? (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                  {otHits.map((h) => (
                    <li key={h.num_pedido}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                        disabled={saving}
                        onClick={() => void addOtToDay(h)}
                      >
                        <span className="font-semibold text-[#002147]">
                          {h.num_pedido}
                        </span>
                        <span className="line-clamp-1 text-xs text-slate-600">
                          {h.cliente ?? "—"} · {h.titulo ?? "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">
                En este día ({dayLineas.length}) — cortar para mover, papelera
                para quitar
              </p>
              {dayLineas.length === 0 ? (
                <p className="text-sm text-slate-500">Ninguna OT todavía.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {dayLineas.map((l) => (
                    <li
                      key={l.id}
                      className={`flex items-start justify-between gap-2 rounded-md border bg-white px-2 py-1.5 ${
                        portapapeles?.id === l.id
                          ? "border-amber-400 bg-amber-50/80"
                          : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm hover:underline"
                        onClick={() => void openDetalle(l.otNumero)}
                      >
                        <span className="font-semibold text-[#002147]">
                          {l.otNumero}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-600">
                          {l.trabajo ?? "—"}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#002147]"
                          disabled={saving}
                          title="Cortar (mover a otro día)"
                          onClick={() => cortarEntrada(l)}
                        >
                          <Scissors className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-700"
                          disabled={saving}
                          title="Quitar del planificador"
                          onClick={() => void removeEntrada(l.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dayYmd}
              onClick={exportDia}
            >
              <FileDown className="mr-1 size-4" />
              PDF día
            </Button>
            <Button type="button" size="sm" onClick={() => setDayOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              OT{" "}
              <span className="font-mono text-[#002147]">
                {detalle?.otNumero ?? "…"}
              </span>
            </DialogTitle>
            <DialogDescription>
              Resumen rápido · itinerario con colores de estado.
            </DialogDescription>
          </DialogHeader>
          {detalleLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          ) : detalle ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-sm font-semibold text-slate-800">
                  {detalle.cliente ?? "—"} · {detalle.trabajo ?? "—"}
                </div>
                <div className="mt-1.5 grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
                  <div>
                    <span className="font-medium">Cantidad:</span>{" "}
                    {detalle.cantidad != null
                      ? detalle.cantidad.toLocaleString("es-ES")
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Entrega:</span>{" "}
                    {detalle.fechaEntrega
                      ? formatFechaEsCorta(detalle.fechaEntrega)
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Estado OT:</span>{" "}
                    {detalle.estadoOt ?? "—"}
                  </div>
                </div>
                {(detalle.material || detalle.tamanoHoja) && (
                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    {detalle.material ? (
                      <span>
                        <span className="font-medium">Material:</span>{" "}
                        {detalle.material}
                        {detalle.gramaje != null
                          ? ` ${detalle.gramaje}g`
                          : ""}
                      </span>
                    ) : null}
                    {detalle.tamanoHoja ? (
                      <span className={detalle.material ? " ml-3" : undefined}>
                        <span className="font-medium">Formato:</span>{" "}
                        {detalle.tamanoHoja}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {detalle.pasos.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Itinerario
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {detalle.pasos.map((p, i) => (
                      <span
                        key={`${p.orden}-${i}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          STEP_BADGE_STYLES[p.estado] ??
                            STEP_BADGE_STYLES.pendiente,
                        )}
                        title={`${p.orden} · ${p.nombre} · ${p.estado}`}
                      >
                        <Route className="size-3" />
                        {p.orden} · {p.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Sin itinerario en Minerva (OT no despachada o sin pasos).
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos.</p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!detalle?.otNumero}
              onClick={() => {
                if (!detalle?.otNumero) return;
                setHojaRutaOt(detalle.otNumero);
                setDetalleOpen(false);
                setHojaRutaOpen(true);
              }}
            >
              Ver hoja de ruta
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setDetalleOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HojaRutaOtDialog
        otNumero={hojaRutaOt}
        open={hojaRutaOpen}
        onOpenChange={setHojaRutaOpen}
      />
    </div>
  );
}
