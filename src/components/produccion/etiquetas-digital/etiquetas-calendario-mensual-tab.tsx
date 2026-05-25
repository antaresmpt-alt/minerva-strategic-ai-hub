"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EtiquetasHojaRutaEditDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-edit-dialog";
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
import { NativeSelect, type Option } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import {
  APUNTE_PLANTILLAS,
  countFestivosEnRango,
  FESTIVO_CAPAS_DEFAULT,
  type FestivoCapasActivas,
  festivosPorDia,
} from "@/lib/etiquetas-calendario-festivo";
import {
  buildCalendarioResumenMes,
  CALENDARIO_FILTROS_DEFAULT,
  filtrarApuntesMap,
  filtrarEventosMap,
  type CalendarioFiltros,
} from "@/lib/etiquetas-calendario-filters";
import {
  apuntesPorDia,
  buildSemanasLaboralesMes,
  type CalendarioEventoAuto,
  countDiasLaborablesEnGrid,
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
import type { ProdCalendarioFestivoRow } from "@/types/prod-calendario-festivo";
import type { CalendarioFestivoAmbito } from "@/types/prod-calendario-festivo";
import type { ProdEtiquetasCalendarioApunteRow } from "@/types/prod-etiquetas-calendario-apunte";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type { ProdEtiquetasTroquelRow } from "@/types/prod-etiquetas-troqueles";
import { cn } from "@/lib/utils";

const TABLE_HR = "prod_etiquetas_hoja_ruta";
const TABLE_APUNTE = "prod_etiquetas_calendario_apunte";
const TABLE_FESTIVO = "prod_calendario_festivo";
const CATALOG_TABLE = "prod_etiquetas_catalogo";
const TROQUELES_TABLE = "prod_etiquetas_troqueles";

const MIGRATION_HINT_APUNTE =
  "Ejecuta la migraciÃ³n 20260517160000_prod_etiquetas_calendario_apunte.sql en Supabase.";
const MIGRATION_HINT_FESTIVO =
  "Ejecuta la migraciÃ³n 20260519120000_prod_calendario_festivo.sql en Supabase.";

const STORAGE_SHOW_SATURDAY = "etiquetas-cal-show-saturday";
const STORAGE_FESTIVO_CAPAS = "etq-cal-festivo-capas";

const TIPO_CLASS = {
  I: "font-semibold text-[#002147]",
  T: "font-medium text-slate-800",
  N: "font-medium text-slate-600",
} as const;

const AMBITO_OPTS: Option[] = [
  { value: "nacional", label: "Nacional (ES)" },
  { value: "autonomico", label: "AutonÃ³mico" },
  { value: "local", label: "Local" },
  { value: "empresa", label: "Empresa" },
];

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

function isMissingTable(msg: string, table: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes(table);
}

function readFestivoCapas(): FestivoCapasActivas {
  try {
    const raw = localStorage.getItem(STORAGE_FESTIVO_CAPAS);
    if (!raw) return { ...FESTIVO_CAPAS_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<FestivoCapasActivas>;
    return { ...FESTIVO_CAPAS_DEFAULT, ...parsed };
  } catch {
    return { ...FESTIVO_CAPAS_DEFAULT };
  }
}

function LineaContenido({
  linea,
  onOpenHojaRuta,
}: {
  linea: LineaDia;
  onOpenHojaRuta?: (id: string) => void;
}) {
  if (linea.kind === "evento") {
    return (
      <button
        type="button"
        className={cn(
          "w-full break-words text-left leading-tight underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#002147]/40",
          TIPO_CLASS[linea.ev.tipo]
        )}
        title={`${linea.ev.label} — abrir hoja de ruta`}
        onClick={() => onOpenHojaRuta?.(linea.ev.hojaRutaId)}
      >
        {linea.ev.label}
      </button>
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
  onOpenHojaRuta,
}: {
  eventos: CalendarioEventoAuto[];
  apuntes: ProdEtiquetasCalendarioApunteRow[];
  onOpenHojaRuta?: (id: string) => void;
}) {
  const items = lineasDia(eventos, apuntes);
  const { left, right } = splitLineasDosColumnas(items);
  const dosColumnas = right.length > 0;

  if (items.length === 0) {
    return <div className="min-h-[2rem] flex-1" />;
  }

  const renderList = (list: LineaDia[]) =>
    list.map((linea) => (
      <LineaContenido
        key={
          linea.kind === "evento"
            ? `${linea.ev.tipo}-${linea.ev.otNumero}-${linea.ev.hojaRutaId}`
            : linea.apunte.id
        }
        linea={linea}
        onOpenHojaRuta={onOpenHojaRuta}
      />
    ));

  if (!dosColumnas) {
    return (
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5 text-xs leading-snug">
        {renderList(items)}
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-1.5 overflow-y-auto p-1.5 text-xs leading-snug">
      <div className="space-y-0.5">{renderList(left)}</div>
      <div className="space-y-0.5">{renderList(right)}</div>
    </div>
  );
}

type DiaCeldaProps = {
  ymd: string;
  dayNum: number;
  eventos: CalendarioEventoAuto[];
  apuntes: ProdEtiquetasCalendarioApunteRow[];
  festivos: ProdCalendarioFestivoRow[];
  onEdit: () => void;
  onOpenHojaRuta: (id: string) => void;
};

function DiaCalendarioCelda({
  dayNum,
  eventos,
  apuntes,
  festivos,
  onEdit,
  onOpenHojaRuta,
}: DiaCeldaProps) {
  const esFestivo = festivos.length > 0;
  const previewApunte =
    apuntes.length > 0
      ? apuntes[0]!.texto.length > 48
        ? `${apuntes[0]!.texto.slice(0, 48)}…`
        : apuntes[0]!.texto
      : null;

  return (
    <div
      className={cn(
        "group relative flex min-h-[9rem] flex-col border border-slate-200/90",
        esFestivo ? "bg-slate-200/70" : "bg-white"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between px-2 py-1",
          esFestivo ? "bg-slate-500" : "bg-[#002147]"
        )}
      >
        <span className="min-w-0 truncate text-[10px] font-medium text-white/90">
          {esFestivo ? festivos.map((f) => f.nombre).join(" · ") : null}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-white">
          {dayNum}
        </span>
      </div>
      {previewApunte && eventos.length === 0 ? (
        <p className="border-b border-slate-200/60 bg-amber-50/80 px-1.5 py-0.5 text-[10px] leading-tight text-amber-950">
          {apuntes.length > 1 ? `(${apuntes.length}) ` : ""}
          {previewApunte}
        </p>
      ) : null}
      <ContenidoDia
        eventos={eventos}
        apuntes={apuntes}
        onOpenHojaRuta={onOpenHojaRuta}
      />
      <button
        type="button"
        className={cn(
          "absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full border border-slate-200/90 bg-white shadow-sm transition-colors",
          "text-[#002147] hover:border-[#002147]/30 hover:bg-slate-50",
          "opacity-70 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]/40"
        )}
        title="Apuntes del dÃ­a"
        aria-label={`Apuntes del dÃ­a ${dayNum}`}
        onClick={onEdit}
      >
        <Pencil className="size-3" aria-hidden />
        {apuntes.length > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white ring-1 ring-white"
            aria-hidden
          >
            {apuntes.length > 9 ? "9+" : apuntes.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}

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
  onPlantilla,
}: {
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
  onPlantilla: (texto: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apuntes del dÃ­a</DialogTitle>
          <DialogDescription>
            {ymd ? fechaDiaLabel(ymd) : ""} — varios apuntes por día
          </DialogDescription>
        </DialogHeader>

        {apuntes.length > 0 ? (
          <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/80 p-2 text-sm">
            {apuntes.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2 last:border-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{a.texto}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-red-600 hover:text-red-700"
                  disabled={saving}
                  aria-label="Borrar apunte"
                  onClick={() => onDeleteApunte(a.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sin apuntes en este dÃ­a.</p>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-slate-600">Plantillas rÃ¡pidas</Label>
          <div className="flex flex-wrap gap-1">
            {APUNTE_PLANTILLAS.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={saving}
                onClick={() => onPlantilla(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

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
          <Button type="button" disabled={saving || !draft.trim()} onClick={onAdd}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar apunte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CalendarioToolbarInline({
  filtros,
  festivoCapas,
  resumen,
  mesLabel,
  loading,
  otSearchId,
  onToggleFiltro,
  onToggleFestivoCapa,
  onOtSearchChange,
  onAddFestivo,
}: {
  filtros: CalendarioFiltros;
  festivoCapas: FestivoCapasActivas;
  resumen: ReturnType<typeof buildCalendarioResumenMes>;
  mesLabel: string;
  loading: boolean;
  otSearchId: string;
  onToggleFiltro: (key: "showI" | "showT" | "showN" | "showApuntes") => void;
  onToggleFestivoCapa: (key: keyof FestivoCapasActivas) => void;
  onOtSearchChange: (value: string) => void;
  onAddFestivo: () => void;
}) {
  const diaMax =
    resumen.diaMaxYmd && resumen.diaMaxTotal > 0
      ? ` \u00b7 Pico ${resumen.diaMaxYmd.slice(8, 10)}/${resumen.diaMaxYmd.slice(5, 7)} (${resumen.diaMaxTotal} líneas)`
      : "";

  const chipClass =
    "inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs leading-5";

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-slate-200/90 bg-slate-50/80 px-2.5 py-2 text-xs text-slate-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="shrink-0 font-medium text-slate-500">Filtros</span>
        {(
          [
            ["showI", "Konica"],
            ["showT", "Troquel"],
            ["showN", "Numeradora"],
            ["showApuntes", "Apuntes"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={chipClass}>
            <input
              type="checkbox"
              className="size-3"
              checked={filtros[key]}
              onChange={() => onToggleFiltro(key)}
            />
            {label}
          </label>
        ))}
        <div className="relative w-[9.5rem]">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            id={otSearchId}
            className="h-7 pl-7 text-xs"
            placeholder="Buscar OT…"
            value={filtros.otSearch}
            onChange={(e) => onOtSearchChange(e.target.value)}
          />
        </div>
      </div>

      <span className="hidden h-4 w-px shrink-0 bg-slate-300 sm:inline" aria-hidden />

      <div className="flex flex-wrap items-center gap-1">
        <span className="shrink-0 font-medium text-slate-500">Festivos</span>
        {(
          [
            ["nacional", "Nacional"],
            ["autonomico", "Cataluña"],
            ["local", "Local"],
            ["empresa", "Empresa"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={cn(chipClass, "bg-slate-50/90")}>
            <input
              type="checkbox"
              className="size-3"
              checked={festivoCapas[key]}
              onChange={() => onToggleFestivoCapa(key)}
            />
            {label}
          </label>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onAddFestivo}
        >
          <Plus className="size-3.5" />
          Añadir festivo
        </Button>
      </div>
      </div>

      {!loading ? (
        <div className="border-t border-slate-200/80 pt-1.5 text-slate-600">
          <span className="font-semibold text-[#002147]">Resumen {mesLabel}</span>
          <span className="text-slate-500">
            {" "}
            {"\u00b7"} Konica {resumen.totalI} {"\u00b7"} Troquel {resumen.totalT}{" "}
            {"\u00b7"} Numeradora {resumen.totalN} {"\u00b7"} Apuntes{" "}
            {resumen.totalApuntes} {"\u00b7"} Días activos {resumen.diasConActividad}{" "}
            {"\u00b7"} Festivos {resumen.festivosEnMes} de{" "}
            {resumen.diasLaborablesGrid} en rejilla
            {diaMax}
          </span>
        </div>
      ) : (
        <span className="border-t border-slate-200/80 pt-1.5 text-slate-400">
          Cargando resumen del mes…
        </span>
      )}
    </div>
  );
}

export function EtiquetasCalendarioMensualTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [hojaRuta, setHojaRuta] = useState<ProdEtiquetasHojaRutaRow[]>([]);
  const [catalog, setCatalog] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [troqueles, setTroqueles] = useState<ProdEtiquetasTroquelRow[]>([]);
  const [apuntes, setApuntes] = useState<ProdEtiquetasCalendarioApunteRow[]>([]);
  const [festivos, setFestivos] = useState<ProdCalendarioFestivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingYmd, setEditingYmd] = useState<string | null>(null);
  const [editingDayNum, setEditingDayNum] = useState(0);
  const [apunteDraft, setApunteDraft] = useState("");
  const [showSaturday, setShowSaturday] = useState(false);
  const [festivoCapas, setFestivoCapas] = useState<FestivoCapasActivas>(
    FESTIVO_CAPAS_DEFAULT
  );
  const [filtros, setFiltros] = useState<CalendarioFiltros>(
    CALENDARIO_FILTROS_DEFAULT
  );
  const [editingHr, setEditingHr] = useState<ProdEtiquetasHojaRutaRow | null>(null);
  const [festivoDialogOpen, setFestivoDialogOpen] = useState(false);
  const [festivoForm, setFestivoForm] = useState({
    fecha: "",
    nombre: "",
    ambito: "empresa" as CalendarioFestivoAmbito,
    codigo_ambito: "",
  });

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_SHOW_SATURDAY);
      if (v === "1") setShowSaturday(true);
      setFestivoCapas(readFestivoCapas());
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FESTIVO_CAPAS, JSON.stringify(festivoCapas));
    } catch {
      /* ignore */
    }
  }, [festivoCapas]);

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

  const eventosMapRaw = useMemo(() => {
    const enMes = filasHojaRutaEnMes(hojaRuta, start, end);
    return eventosAutoPorDiaDesdeHojaRuta(enMes);
  }, [hojaRuta, start, end]);

  const apuntesMapRaw = useMemo(() => apuntesPorDia(apuntes), [apuntes]);

  const festivosMapRaw = useMemo(
    () => festivosPorDia(festivos, festivoCapas),
    [festivos, festivoCapas]
  );

  const eventosMap = useMemo(
    () => filtrarEventosMap(eventosMapRaw, filtros),
    [eventosMapRaw, filtros]
  );

  const apuntesMap = useMemo(
    () => filtrarApuntesMap(apuntesMapRaw, filtros),
    [apuntesMapRaw, filtros]
  );

  const resumen = useMemo(
    () =>
      buildCalendarioResumenMes(eventosMapRaw, apuntesMapRaw, filtros, {
        festivosEnMes: countFestivosEnRango(festivosMapRaw, start, end),
        diasLaborablesGrid: countDiasLaborablesEnGrid(semanas),
      }),
    [
      eventosMapRaw,
      apuntesMapRaw,
      filtros,
      festivosMapRaw,
      start,
      end,
      semanas,
    ]
  );

  const hojaRutaById = useMemo(() => {
    const m = new Map<string, ProdEtiquetasHojaRutaRow>();
    for (const r of hojaRuta) m.set(r.id, r);
    return m;
  }, [hojaRuta]);

  const load = useCallback(async () => {
    setLoading(true);
    const [rHr, rAp, rFest, rCat, rTroqueles] = await Promise.all([
      supabase.from(TABLE_HR).select("*").order("ot_numero"),
      supabase
        .from(TABLE_APUNTE)
        .select("id, fecha, texto, orden, created_at, updated_at")
        .gte("fecha", start)
        .lte("fecha", end)
        .order("fecha")
        .order("orden")
        .order("created_at"),
      supabase
        .from(TABLE_FESTIVO)
        .select("id, fecha, nombre, ambito, codigo_ambito, activo, created_at, updated_at")
        .gte("fecha", start)
        .lte("fecha", end)
        .eq("activo", true)
        .order("fecha"),
      supabase.from(CATALOG_TABLE).select("*").order("orden"),
      supabase.from(TROQUELES_TABLE).select("*").order("codigo"),
    ]);
    setLoading(false);

    if (rHr.error) {
      setHojaRuta([]);
      toast.error("No se pudo cargar la hoja de ruta", {
        description: rHr.error.message,
      });
    } else {
      setHojaRuta((rHr.data ?? []) as ProdEtiquetasHojaRutaRow[]);
    }

    if (rAp.error) {
      setApuntes([]);
      if (isMissingTable(rAp.error.message, TABLE_APUNTE)) {
        toast.error("Falta la tabla de apuntes", {
          id: "etq-cal-apunte-missing",
          description: MIGRATION_HINT_APUNTE,
        });
      } else {
        toast.error("No se pudieron cargar los apuntes", {
          description: rAp.error.message,
        });
      }
    } else {
      setApuntes((rAp.data ?? []) as ProdEtiquetasCalendarioApunteRow[]);
    }

    if (rFest.error) {
      setFestivos([]);
      if (isMissingTable(rFest.error.message, TABLE_FESTIVO)) {
        toast.error("Falta la tabla de festivos", {
          id: "etq-cal-festivo-missing",
          description: MIGRATION_HINT_FESTIVO,
        });
      }
    } else {
      setFestivos((rFest.data ?? []) as ProdCalendarioFestivoRow[]);
    }

    if (!rCat.error) {
      setCatalog((rCat.data ?? []) as ProdEtiquetasCatalogRow[]);
    }

    if (!rTroqueles.error) {
      setTroqueles((rTroqueles.data ?? []) as ProdEtiquetasTroquelRow[]);
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

  const openHojaRuta = useCallback(
    (id: string) => {
      const row = hojaRutaById.get(id);
      if (!row) {
        toast.error("No se encontrÃ³ la fila en hoja de ruta");
        return;
      }
      setEditingHr(row);
    },
    [hojaRutaById]
  );

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
        orden: apuntesMapRaw.get(editingYmd)?.length ?? 0,
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
  }, [apunteDraft, apuntesMapRaw, editingYmd, supabase]);

  const deleteApunte = useCallback(
    async (id: string) => {
      if (!window.confirm("Â¿Borrar este apunte?")) return;
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

  const addFestivo = useCallback(async () => {
    const fecha = festivoForm.fecha.trim();
    const nombre = festivoForm.nombre.trim();
    if (!fecha || !nombre) {
      toast.error("Fecha y nombre son obligatorios");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from(TABLE_FESTIVO)
      .insert({
        fecha,
        nombre,
        ambito: festivoForm.ambito,
        codigo_ambito: festivoForm.codigo_ambito.trim() || null,
        activo: true,
      })
      .select("id, fecha, nombre, ambito, codigo_ambito, activo, created_at, updated_at")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = data as ProdCalendarioFestivoRow;
    if (row.fecha >= start && row.fecha <= end) {
      setFestivos((prev) => [...prev, row].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    }
    setFestivoForm((f) => ({ ...f, nombre: "", codigo_ambito: "" }));
    toast.success("Festivo aÃ±adido");
  }, [festivoForm, start, end, supabase]);

  const exportPdf = useCallback(() => {
    exportEtiquetasCalendarioMensualPdf({
      year,
      monthIndex,
      includeSaturday: showSaturday,
      semanas,
      eventosMap,
      apuntesMap,
      festivosMap: festivosMapRaw,
      filtros,
      resumen,
    });
    toast.success("PDF del mes descargado");
  }, [
    apuntesMap,
    eventosMap,
    festivosMapRaw,
    filtros,
    monthIndex,
    resumen,
    semanas,
    showSaturday,
    year,
  ]);

  const mesLabel = mesAnioLabel(year, monthIndex);
  const editingApuntes = editingYmd ? (apuntesMapRaw.get(editingYmd) ?? []) : [];

  const toggleFiltroTipo = (key: "showI" | "showT" | "showN" | "showApuntes") => {
    setFiltros((f) => ({ ...f, [key]: !f[key] }));
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">
            Calendario mensual
          </h2>
          <p className="text-xs text-slate-600">
            {showSaturday ? "Lun–sáb" : "Lun–vie"} · clic en{" "}
            <strong className="text-[#002147]">I/T/N</strong> abre hoja de ruta
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
            {mesLabel}
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

      <CalendarioToolbarInline
        filtros={filtros}
        festivoCapas={festivoCapas}
        resumen={resumen}
        mesLabel={mesLabel}
        loading={loading}
        otSearchId="etq-cal-ot-search"
        onToggleFiltro={toggleFiltroTipo}
        onToggleFestivoCapa={(key) =>
          setFestivoCapas((c) => ({ ...c, [key]: !c[key] }))
        }
        onOtSearchChange={(value) =>
          setFiltros((f) => ({ ...f, otSearch: value }))
        }
        onAddFestivo={() => {
          setFestivoForm((f) => ({ ...f, fecha: start }));
          setFestivoDialogOpen(true);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando calendario…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200/90 bg-slate-50/50 p-2 shadow-sm">
          <div
            className={cn(
              "grid gap-1",
              showSaturday ? "min-w-[860px]" : "min-w-[720px]"
            )}
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
                    festivos={festivosMapRaw.get(dia.ymd) ?? []}
                    onEdit={() => openApunteDialog(dia.ymd, dia.dayNum)}
                    onOpenHojaRuta={openHojaRuta}
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
        onPlantilla={(t) =>
          setApunteDraft((prev) => (prev.trim() ? `${prev.trim()}\n${t}` : t))
        }
      />

      <EtiquetasHojaRutaEditDialog
        open={editingHr != null}
        onOpenChange={(open) => !open && setEditingHr(null)}
        row={editingHr}
        catalog={catalog}
        troqueles={troqueles}
        onSaved={() => {
          setEditingHr(null);
          void load();
        }}
      />

      <Dialog open={festivoDialogOpen} onOpenChange={setFestivoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>AÃ±adir festivo</DialogTitle>
            <DialogDescription>
              Local o de empresa; nacional y autonÃ³micos vienen del seed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fest-fecha">Fecha</Label>
              <Input
                id="fest-fecha"
                type="date"
                value={festivoForm.fecha}
                onChange={(e) =>
                  setFestivoForm((f) => ({ ...f, fecha: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="fest-nombre">Nombre</Label>
              <Input
                id="fest-nombre"
                value={festivoForm.nombre}
                onChange={(e) =>
                  setFestivoForm((f) => ({ ...f, nombre: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="fest-ambito">Ãmbito</Label>
              <NativeSelect
                id="fest-ambito"
                value={festivoForm.ambito}
                options={AMBITO_OPTS}
                onChange={(e) =>
                  setFestivoForm((f) => ({
                    ...f,
                    ambito: e.target.value as CalendarioFestivoAmbito,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="fest-cod">CÃ³digo Ã¡mbito (opcional)</Label>
              <Input
                id="fest-cod"
                placeholder="Ej. municipio o empresa"
                value={festivoForm.codigo_ambito}
                onChange={(e) =>
                  setFestivoForm((f) => ({
                    ...f,
                    codigo_ambito: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFestivoDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void addFestivo()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-slate-500">
        Las lÃ­neas <strong>I-</strong>, <strong>T-</strong> y <strong>N-</strong>{" "}
        se generan al marcar Kon / Troq / Num en hoja de ruta. El PDF respeta los
        mismos filtros que la pantalla.
      </p>
    </div>
  );
}
