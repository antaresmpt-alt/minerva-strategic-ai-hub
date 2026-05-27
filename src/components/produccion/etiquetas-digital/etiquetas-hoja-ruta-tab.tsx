"use client";

import { Loader2, Pencil, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntregaPlazoSemaforo } from "@/components/produccion/etiquetas-digital/entrega-plazo-semaforo";
import { EtiquetasEntradaExpressDialog } from "@/components/produccion/etiquetas-digital/etiquetas-entrada-express-dialog";
import { EtiquetasHojaRutaEditDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-edit-dialog";
import { EtiquetasHojaRutaMuelleDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-muelle-dialog";
import { EtiquetasHojaRutaMuelleView } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-muelle-view";
import { EtiquetasMetrosImpresionDialog } from "@/components/produccion/etiquetas-digital/etiquetas-metros-impresion-dialog";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportEtiquetasHojaRutaExcel,
  exportEtiquetasHojaRutaPdf,
} from "@/lib/etiquetas-hoja-ruta-export";
import {
  catalogLabels,
  ETIQUETAS_CATALOG_PAPEL,
  mergeCatalogAndUsedLabels,
} from "@/lib/etiquetas-catalogo";
import {
  buildEtiquetasHojaRutaKpis,
  cantidadEtiquetasKpi,
  formatEtiquetasKpi,
  formatMetrosKpi,
} from "@/lib/etiquetas-hoja-ruta-kpis";
import {
  buildMaquinaPatch,
  type MaquinaHojaRutaField,
  type MaquinaPatchExtras,
  mergeMaquinaIntoRow,
} from "@/lib/etiquetas-hoja-ruta-maquina";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type { ProdEtiquetasTroquelRow } from "@/types/prod-etiquetas-troqueles";
import { resolveTroquelDisplay } from "@/lib/etiquetas-troqueles-display";
import { cn } from "@/lib/utils";

const TABLE = "prod_etiquetas_hoja_ruta";
const CATALOG_TABLE = "prod_etiquetas_catalogo";
const TROQUELES_TABLE = "prod_etiquetas_troqueles";
const STORAGE_COMPACT = "etiquetas-hr-compact";
const STORAGE_EXPORT = "etiquetas-hr-export-modal";

const ORDEN_OPTIONS: Option[] = [
  { value: "fecha_entrega_ot_asc", label: "Fecha entrega OT (asc)" },
  { value: "fecha_entrega_ot_desc", label: "Fecha entrega OT (desc)" },
  { value: "fecha_entrada_asc", label: "Fecha entrada depto (asc)" },
  { value: "fecha_entrada_desc", label: "Fecha entrada depto (desc)" },
  { value: "ot_asc", label: "OT (asc)" },
  { value: "ot_desc", label: "OT (desc)" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const MAQUINA_COLS: { field: MaquinaHojaRutaField; label: string; title: string }[] =
  [
    { field: "konica", label: "Kon", title: "Konica (imprimir)" },
    { field: "troqueladora", label: "Troq", title: "Troqueladora" },
    { field: "numeradora", label: "Num", title: "Numeradora" },
  ];

type ExportFormat = "excel" | "pdf";
type ExportMode = "screen" | "date";
type ExportDateField =
  | "fecha_entrada_depto"
  | "fecha_entrega_ot"
  | "fecha_fin_konica"
  | "fecha_fin_troqueladora"
  | "fecha_fin_numeradora"
  | "any_process";
type ExportPreset =
  | "today"
  | "this_week"
  | "last_week"
  | "current_month"
  | "previous_month"
  | "custom";

type StoredExportPrefs = Partial<{
  mode: ExportMode;
  dateField: ExportDateField;
  preset: ExportPreset;
  from: string;
  to: string;
}>;

const EXPORT_DATE_FIELD_OPTIONS: Option[] = [
  { value: "fecha_entrada_depto", label: "F. entrada depto." },
  { value: "fecha_entrega_ot", label: "F. entrega OT" },
  { value: "fecha_fin_konica", label: "F. fin Konica (I)" },
  { value: "fecha_fin_troqueladora", label: "F. fin Troqueladora (T)" },
  { value: "fecha_fin_numeradora", label: "F. fin Numeradora (N)" },
  { value: "any_process", label: "Algún proceso (I, T o N)" },
];

const EXPORT_PRESET_OPTIONS: Option[] = [
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Última semana" },
  { value: "current_month", label: "Mes actual" },
  { value: "previous_month", label: "Mes anterior" },
  { value: "custom", label: "Personalizado" },
];

function ymdLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymdLocal(d);
}

function monthRangeYmd(offsetMonths = 0): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1, 12);
  const last = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0, 12);
  return { start: ymdLocal(first), end: ymdLocal(last) };
}

function weekRangeYmd(offsetWeeks = 0): { start: string; end: string } {
  const today = new Date(`${ymdLocal()}T12:00:00`);
  const dow = today.getDay() === 0 ? 7 : today.getDay();
  today.setDate(today.getDate() - dow + 1 + offsetWeeks * 7);
  const start = ymdLocal(today);
  return { start, end: addDaysYmd(start, 6) };
}

function presetRange(preset: ExportPreset): { start: string; end: string } {
  const today = ymdLocal();
  if (preset === "today") return { start: today, end: today };
  if (preset === "this_week") return weekRangeYmd(0);
  if (preset === "last_week") {
    const end = today;
    return { start: addDaysYmd(end, -6), end };
  }
  if (preset === "previous_month") return monthRangeYmd(-1);
  return monthRangeYmd(0);
}

function ymdKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function dateInRange(value: string | null | undefined, start: string, end: string): boolean {
  const k = ymdKey(value);
  return k != null && k >= start && k <= end;
}

function rowInExportDateRange(
  row: ProdEtiquetasHojaRutaRow,
  field: ExportDateField,
  start: string,
  end: string
): boolean {
  if (field === "any_process") {
    return (
      dateInRange(row.fecha_fin_konica, start, end) ||
      dateInRange(row.fecha_fin_troqueladora, start, end) ||
      dateInRange(row.fecha_fin_numeradora, start, end)
    );
  }
  return dateInRange(row[field], start, end);
}

function readStoredExportPrefs(): StoredExportPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_EXPORT);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredExportPrefs;
    const out: StoredExportPrefs = {};
    if (parsed.mode === "screen" || parsed.mode === "date") out.mode = parsed.mode;
    if (
      parsed.dateField === "fecha_entrada_depto" ||
      parsed.dateField === "fecha_entrega_ot" ||
      parsed.dateField === "fecha_fin_konica" ||
      parsed.dateField === "fecha_fin_troqueladora" ||
      parsed.dateField === "fecha_fin_numeradora" ||
      parsed.dateField === "any_process"
    ) {
      out.dateField = parsed.dateField;
    }
    if (
      parsed.preset === "today" ||
      parsed.preset === "this_week" ||
      parsed.preset === "last_week" ||
      parsed.preset === "current_month" ||
      parsed.preset === "previous_month" ||
      parsed.preset === "custom"
    ) {
      out.preset = parsed.preset;
    }
    if (parsed.from) out.from = parsed.from;
    if (parsed.to) out.to = parsed.to;
    return out;
  } catch {
    return {};
  }
}

function readStoredCompactMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_COMPACT) === "1";
  } catch {
    return false;
  }
}

export function EtiquetasHojaRutaTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [initialExportPrefs] = useState(readStoredExportPrefs);
  const [rows, setRows] = useState<ProdEtiquetasHojaRutaRow[]>([]);
  const [catalog, setCatalog] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [troqueles, setTroqueles] = useState<ProdEtiquetasTroquelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroPapel, setFiltroPapel] = useState("");
  const [ocultarFinalizadas, setOcultarFinalizadas] = useState(true);
  const [orden, setOrden] = useState<string>("fecha_entrega_ot_asc");
  const [expressOpen, setExpressOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProdEtiquetasHojaRutaRow | null>(
    null
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingMaquina, setTogglingMaquina] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(readStoredCompactMode);
  const [muelleDetailRow, setMuelleDetailRow] =
    useState<ProdEtiquetasHojaRutaRow | null>(null);
  const [pendingKonicaRow, setPendingKonicaRow] =
    useState<ProdEtiquetasHojaRutaRow | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormatHint, setExportFormatHint] = useState<ExportFormat>("pdf");
  const [exportMode, setExportMode] = useState<ExportMode>(
    initialExportPrefs.mode ?? "screen"
  );
  const [exportDateField, setExportDateField] =
    useState<ExportDateField>(
      initialExportPrefs.dateField ?? "fecha_entrada_depto"
    );
  const [exportPreset, setExportPreset] = useState<ExportPreset>(
    initialExportPrefs.preset ?? "current_month"
  );
  const currentMonth = monthRangeYmd(0);
  const [exportFrom, setExportFrom] = useState(
    initialExportPrefs.from ?? currentMonth.start
  );
  const [exportTo, setExportTo] = useState(
    initialExportPrefs.to ?? currentMonth.end
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COMPACT, compactMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [compactMode]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_EXPORT,
        JSON.stringify({
          mode: exportMode,
          dateField: exportDateField,
          preset: exportPreset,
          from: exportFrom,
          to: exportTo,
        })
      );
    } catch {
      /* ignore */
    }
  }, [exportDateField, exportFrom, exportMode, exportPreset, exportTo]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const [rRows, rCat, rTroqueles] = await Promise.all([
      supabase
        .from(TABLE)
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from(CATALOG_TABLE)
        .select("id, categoria, grupo, label, activo, orden")
        .order("categoria")
        .order("grupo")
        .order("orden")
        .order("label"),
      supabase
        .from(TROQUELES_TABLE)
        .select("*")
        .order("codigo", { ascending: true }),
    ]);
    setLoading(false);
    if (rRows.error) {
      toast.error("No se pudo cargar la hoja de ruta", {
        description: rRows.error.message,
      });
      setRows([]);
    } else {
      setRows((rRows.data ?? []) as ProdEtiquetasHojaRutaRow[]);
    }
    if (rCat.error) {
      console.warn("[etiquetas catalog hoja ruta]", rCat.error.message);
      setCatalog([]);
    } else {
      setCatalog((rCat.data ?? []) as ProdEtiquetasCatalogRow[]);
    }
    if (rTroqueles.error) {
      console.warn("[etiquetas troqueles hoja ruta]", rTroqueles.error.message);
      setTroqueles([]);
    } else {
      setTroqueles((rTroqueles.data ?? []) as ProdEtiquetasTroquelRow[]);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const papelesUnicos = useMemo(() => {
    const fromRows: string[] = [];
    for (const r of rows) {
      const p = (r.papel ?? "").trim();
      if (p) fromRows.push(p);
    }
    return mergeCatalogAndUsedLabels(
      catalogLabels(catalog, ETIQUETAS_CATALOG_PAPEL),
      fromRows
    );
  }, [catalog, rows]);

  const papelOptions: Option[] = useMemo(
    () => [
      { value: "", label: "— Todos los papeles —" },
      ...papelesUnicos.map((p) => ({ value: p, label: p })),
    ],
    [papelesUnicos]
  );

  const filtradas = useMemo(() => {
    let list = [...rows];
    const q = filtroTexto.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const ot = (r.ot_numero ?? "").toLowerCase();
        const cl = (r.cliente ?? "").toLowerCase();
        const tr = (r.trabajo ?? "").toLowerCase();
        return ot.includes(q) || cl.includes(q) || tr.includes(q);
      });
    }
    const fp = filtroPapel.trim();
    if (fp) {
      list = list.filter((r) => (r.papel ?? "").trim() === fp);
    }
    if (ocultarFinalizadas) {
      list = list.filter((r) => !r.finalizado);
    }
    const cmpStr = (a: string | null, b: string | null, asc: boolean) => {
      const av = a ?? "";
      const bv = b ?? "";
      const c = av.localeCompare(bv, "es", { numeric: true });
      return asc ? c : -c;
    };
    switch (orden) {
      case "fecha_entrega_ot_desc":
        list.sort((a, b) => cmpStr(a.fecha_entrega_ot, b.fecha_entrega_ot, false));
        break;
      case "fecha_entrada_asc":
        list.sort((a, b) => cmpStr(a.fecha_entrada_depto, b.fecha_entrada_depto, true));
        break;
      case "fecha_entrada_desc":
        list.sort((a, b) => cmpStr(a.fecha_entrada_depto, b.fecha_entrada_depto, false));
        break;
      case "ot_asc":
        list.sort((a, b) =>
          (a.ot_numero ?? "").localeCompare(b.ot_numero ?? "", "es", { numeric: true })
        );
        break;
      case "ot_desc":
        list.sort(
          (a, b) =>
            -((a.ot_numero ?? "").localeCompare(b.ot_numero ?? "", "es", { numeric: true }))
        );
        break;
      default:
        list.sort((a, b) => cmpStr(a.fecha_entrega_ot, b.fecha_entrega_ot, true));
    }
    return list;
  }, [rows, filtroTexto, filtroPapel, ocultarFinalizadas, orden]);

  const ordenLabel = useMemo(() => {
    return ORDEN_OPTIONS.find((o) => o.value === orden)?.label ?? orden;
  }, [orden]);

  const exportFilters = useMemo(
    () => ({
      buscar: filtroTexto,
      papel: filtroPapel,
      ocultarFinalizadas,
      ordenLabel,
    }),
    [filtroTexto, filtroPapel, ocultarFinalizadas, ordenLabel]
  );

  const kpis = useMemo(() => buildEtiquetasHojaRutaKpis(rows), [rows]);

  const etiquetasOts = useMemo(
    () =>
      filtradas.reduce((total, row) => {
        const qty = cantidadEtiquetasKpi(row.cantidad);
        return total + (qty ?? 0);
      }, 0),
    [filtradas]
  );

  const troquelesById = useMemo(() => {
    return new Map(troqueles.map((troquel) => [troquel.id, troquel]));
  }, [troqueles]);

  const exportOptions = useMemo(
    () => ({
      includeKpis: !compactMode,
      kpis,
      troquelesById,
    }),
    [compactMode, kpis, troquelesById]
  );

  const exportHint = compactMode
    ? "Elegir selección de exportación (sin indicadores)"
    : "Elegir selección de exportación + indicadores en resumen";

  const exportRange = useMemo(() => {
    if (exportPreset === "custom") {
      return {
        start: exportFrom || ymdLocal(),
        end: exportTo || exportFrom || ymdLocal(),
      };
    }
    return presetRange(exportPreset);
  }, [exportFrom, exportPreset, exportTo]);

  const exportDateFieldLabel = useMemo(
    () =>
      EXPORT_DATE_FIELD_OPTIONS.find((o) => o.value === exportDateField)?.label ??
      exportDateField,
    [exportDateField]
  );

  const exportPresetLabel = useMemo(
    () => EXPORT_PRESET_OPTIONS.find((o) => o.value === exportPreset)?.label ?? exportPreset,
    [exportPreset]
  );

  const exportSelectedRows = useMemo(() => {
    if (exportMode === "screen") return filtradas;
    const start = exportRange.start <= exportRange.end ? exportRange.start : exportRange.end;
    const end = exportRange.start <= exportRange.end ? exportRange.end : exportRange.start;
    return rows
      .filter((row) => rowInExportDateRange(row, exportDateField, start, end))
      .sort((a, b) => {
        const av = a.ot_numero ?? "";
        const bv = b.ot_numero ?? "";
        return av.localeCompare(bv, "es", { numeric: true });
      });
  }, [exportDateField, exportMode, exportRange.end, exportRange.start, filtradas, rows]);

  const exportSelectionLabel = useMemo(() => {
    if (exportMode === "screen") {
      return "En pantalla (filtros aplicados)";
    }
    const start = exportRange.start <= exportRange.end ? exportRange.start : exportRange.end;
    const end = exportRange.start <= exportRange.end ? exportRange.end : exportRange.start;
    return `Rango: ${exportDateFieldLabel} · ${exportPresetLabel} · ${fmtDate(start)} → ${fmtDate(end)}`;
  }, [exportDateFieldLabel, exportMode, exportPresetLabel, exportRange.end, exportRange.start]);

  const exportFiltersForDialog = useMemo(
    () => ({
      ...exportFilters,
      selectionLabel: exportSelectionLabel,
      ...(exportMode === "date"
        ? {
            buscar: "",
            papel: "",
            ocultarFinalizadas: false,
            ordenLabel: `${exportDateFieldLabel} (${exportPresetLabel})`,
          }
        : null),
    }),
    [
      exportDateFieldLabel,
      exportFilters,
      exportMode,
      exportPresetLabel,
      exportSelectionLabel,
    ]
  );

  const commitMaquinaPatch = useCallback(
    async (
      r: ProdEtiquetasHojaRutaRow,
      field: MaquinaHojaRutaField,
      next: boolean,
      extras: MaquinaPatchExtras = {}
    ) => {
      const toggleKey = `${r.id}:${field}`;
      setTogglingMaquina(toggleKey);
      const prev = { ...r };
      const optimistic = mergeMaquinaIntoRow(r, field, next, extras);
      setRows((list) => list.map((x) => (x.id === r.id ? optimistic : x)));
      const { error } = await supabase
        .from(TABLE)
        .update(buildMaquinaPatch(field, next, extras))
        .eq("id", r.id);
      setTogglingMaquina(null);
      if (error) {
        setRows((list) => list.map((x) => (x.id === r.id ? prev : x)));
        toast.error("No se pudo actualizar la máquina", {
          description: error.message,
        });
      }
    },
    [supabase]
  );

  const toggleMaquina = useCallback(
    async (r: ProdEtiquetasHojaRutaRow, field: MaquinaHojaRutaField, next: boolean) => {
      if (
        field === "konica" &&
        next &&
        cantidadEtiquetasKpi(r.cantidad) == null
      ) {
        toast.message("Sin cantidad en la OT", {
          description:
            "Esta fila no tiene cantidad; no sumará en los indicadores hasta que la completes en edición o entrada express.",
        });
      }
      // Konica + marcar → pedir metros antes de persistir.
      if (field === "konica" && next) {
        setPendingKonicaRow(r);
        return;
      }
      await commitMaquinaPatch(r, field, next);
    },
    [commitMaquinaPatch]
  );

  const handleMetrosConfirm = useCallback(
    async (metros: number | null) => {
      const r = pendingKonicaRow;
      if (!r) {
        setPendingKonicaRow(null);
        return;
      }
      await commitMaquinaPatch(r, "konica", true, { metros_impresion: metros });
      setPendingKonicaRow(null);
    },
    [commitMaquinaPatch, pendingKonicaRow]
  );

  const toggleFinalizado = useCallback(
    async (r: ProdEtiquetasHojaRutaRow, next: boolean) => {
      setTogglingId(r.id);
      const prev = r.finalizado;
      setRows((list) =>
        list.map((x) => (x.id === r.id ? { ...x, finalizado: next } : x))
      );
      const { error } = await supabase
        .from(TABLE)
        .update({ finalizado: next })
        .eq("id", r.id);
      setTogglingId(null);
      if (error) {
        setRows((list) =>
          list.map((x) => (x.id === r.id ? { ...x, finalizado: prev } : x))
        );
        toast.error("No se pudo actualizar el estado", {
          description: error.message,
        });
        return;
      }
      toast.success(next ? "Marcada como finalizada." : "Reabierta.");
    },
    [supabase]
  );

  const openExportDialog = useCallback((format: ExportFormat) => {
    setExportFormatHint(format);
    setExportDialogOpen(true);
  }, []);

  const runExport = useCallback(
    (format: ExportFormat) => {
      if (exportSelectedRows.length === 0) {
        toast.message("Sin datos", {
          description: "No hay filas que coincidan con la selección de exportación.",
        });
        return;
      }
      if (format === "excel") {
        exportEtiquetasHojaRutaExcel(
          exportSelectedRows,
          exportFiltersForDialog,
          exportOptions
        );
        toast.success(
          exportOptions.includeKpis
            ? "Excel descargado (con indicadores)"
            : "Excel descargado"
        );
      } else {
        exportEtiquetasHojaRutaPdf(
          exportSelectedRows,
          exportFiltersForDialog,
          exportOptions
        );
        toast.success(
          exportOptions.includeKpis
            ? "PDF descargado (con indicadores)"
            : "PDF descargado"
        );
      }
      setExportDialogOpen(false);
    },
    [exportFiltersForDialog, exportOptions, exportSelectedRows]
  );

  const handleExportExcel = useCallback(() => {
    if (rows.length === 0) {
      toast.message("Sin datos", {
        description: "No hay filas cargadas para exportar.",
      });
      return;
    }
    openExportDialog("excel");
  }, [openExportDialog, rows.length]);

  const handleExportPdf = useCallback(() => {
    if (rows.length === 0) {
      toast.message("Sin datos", {
        description: "No hay filas cargadas para exportar.",
      });
      return;
    }
    openExportDialog("pdf");
  }, [openExportDialog, rows.length]);

  return (
    <div className="flex w-full min-w-0 max-w-[100vw] flex-col gap-3">
      <EtiquetasEntradaExpressDialog
        open={expressOpen}
        onOpenChange={setExpressOpen}
        catalog={catalog}
        troqueles={troqueles}
        onSaved={() => void loadRows()}
        onAbrirExistente={(row) => {
          setExpressOpen(false);
          setEditingRow(row);
        }}
      />
      <EtiquetasHojaRutaEditDialog
        open={editingRow != null}
        onOpenChange={(o) => {
          if (!o) setEditingRow(null);
        }}
        row={editingRow}
        catalog={catalog}
        troqueles={troqueles}
        onSaved={() => void loadRows()}
      />
      <EtiquetasHojaRutaMuelleDialog
        row={muelleDetailRow}
        open={muelleDetailRow != null}
        onOpenChange={(o) => {
          if (!o) setMuelleDetailRow(null);
        }}
        togglingMaquina={togglingMaquina}
        onToggleMaquina={toggleMaquina}
        onEdit={(row) => {
          setMuelleDetailRow(null);
          setEditingRow(row);
        }}
      />
      <EtiquetasMetrosImpresionDialog
        open={pendingKonicaRow != null}
        onOpenChange={(o) => {
          if (!o) setPendingKonicaRow(null);
        }}
        otNumero={pendingKonicaRow?.ot_numero ?? null}
        valorInicial={pendingKonicaRow?.metros_impresion ?? null}
        onConfirmar={(metros) => {
          void handleMetrosConfirm(metros);
        }}
      />
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent
          className="max-w-lg"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (exportSelectedRows.length > 0) runExport(exportFormatHint);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-[#002147]">Exportar hoja de ruta</DialogTitle>
            <DialogDescription>
              Elige si quieres exportar la vista actual o un rango de fechas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-medium text-slate-700">Qué exportar</p>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
                <input
                  type="radio"
                  name="etq-export-mode"
                  className="mt-0.5"
                  checked={exportMode === "screen"}
                  onChange={() => setExportMode("screen")}
                />
                <span>
                  <span className="font-medium text-[#002147]">
                    En pantalla (según filtros aplicados)
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Usa buscador, papel, ocultar finalizadas y orden actual.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm">
                <input
                  type="radio"
                  name="etq-export-mode"
                  className="mt-0.5"
                  checked={exportMode === "date"}
                  onChange={() => setExportMode("date")}
                />
                <span>
                  <span className="font-medium text-[#002147]">Rango de fechas</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Para entradas, entregas o procesos I/T/N.
                  </span>
                </span>
              </label>
            </div>

            {exportMode === "date" ? (
              <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
                <div className="grid gap-1 sm:col-span-2">
                  <Label className="text-xs">Fecha a consultar</Label>
                  <NativeSelect
                    value={exportDateField}
                    onChange={(e) =>
                      setExportDateField(e.target.value as ExportDateField)
                    }
                    options={EXPORT_DATE_FIELD_OPTIONS}
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label className="text-xs">Rango rápido</Label>
                  <NativeSelect
                    value={exportPreset}
                    onChange={(e) => {
                      const next = e.target.value as ExportPreset;
                      setExportPreset(next);
                      if (next !== "custom") {
                        const r = presetRange(next);
                        setExportFrom(r.start);
                        setExportTo(r.end);
                      }
                    }}
                    options={EXPORT_PRESET_OPTIONS}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={exportPreset === "custom" ? exportFrom : exportRange.start}
                    disabled={exportPreset !== "custom"}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={exportPreset === "custom" ? exportTo : exportRange.end}
                    disabled={exportPreset !== "custom"}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="rounded-md bg-[#002147]/5 px-3 py-2 text-sm text-[#002147]">
              Vas a exportar{" "}
              <span className="font-semibold tabular-nums">
                {exportSelectedRows.length.toLocaleString("es-ES")}
              </span>{" "}
              filas.
              <p className="mt-0.5 text-xs text-slate-600">{exportSelectionLabel}</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
            >
              Cancelar
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={exportFormatHint === "excel" ? "default" : "outline"}
                className={exportFormatHint === "excel" ? "bg-[#002147]" : undefined}
                disabled={exportSelectedRows.length === 0}
                onClick={() => runExport("excel")}
              >
                Exportar Excel
              </Button>
              <Button
                type="button"
                variant={exportFormatHint === "pdf" ? "default" : "outline"}
                className={exportFormatHint === "pdf" ? "bg-[#002147]" : undefined}
                disabled={exportSelectedRows.length === 0}
                onClick={() => runExport("pdf")}
              >
                Exportar PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">Hoja de ruta</h2>
          <p className="text-xs text-slate-600">
            Seguimiento de OT en departamento de etiquetas digital. Los datos se
            guardan en <code className="rounded bg-slate-100 px-1">{TABLE}</code>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            title={exportHint}
          >
            Exportar Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            title={exportHint}
          >
            Exportar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Próximamente"
          >
            Importar CSV (Notion)
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="bg-[#002147]"
            onClick={() => setExpressOpen(true)}
          >
            Entrada express
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void loadRows()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Actualizar
          </Button>
        </div>
      </div>

      <div className="hidden min-w-0 flex-col gap-3 rounded-lg border border-slate-200/90 bg-white/90 p-3 shadow-sm md:flex md:flex-row md:flex-wrap md:items-end">
        <div className="grid min-w-0 flex-1 gap-2 sm:max-w-md">
          <Label htmlFor="etq-hr-buscar" className="text-xs">
            Buscar (OT, cliente, trabajo)
          </Label>
          <Input
            id="etq-hr-buscar"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Ej. 35594 o Maymo"
            className="h-9"
          />
        </div>
        <div className="grid w-full gap-2 sm:w-52">
          <Label className="text-xs">Papel</Label>
          <NativeSelect
            value={filtroPapel}
            onChange={(e) => setFiltroPapel(e.target.value)}
            options={papelOptions}
          />
        </div>
        <div className="grid w-full gap-2 sm:w-56">
          <Label className="text-xs">Ordenar por</Label>
          <NativeSelect
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            options={ORDEN_OPTIONS}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 sm:pb-1">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={ocultarFinalizadas}
            onChange={(e) => setOcultarFinalizadas(e.target.checked)}
          />
          Ocultar finalizadas
        </label>
        <label
          className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 sm:pb-1"
          title="Oculta el resumen superior y compacta la tabla"
        >
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={compactMode}
            onChange={(e) => setCompactMode(e.target.checked)}
          />
          Modo compacto
        </label>
      </div>

      {!compactMode ? (
        <div className="hidden grid-cols-2 gap-2 sm:grid-cols-3 md:grid lg:grid-cols-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">Etiquetas OTs</p>
            <p className="text-sm font-semibold text-[#002147]">
              {formatEtiquetasKpi(etiquetasOts)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Cantidad OT · según filtros
            </p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-800">Metros hoy</p>
            <p className="text-sm font-semibold text-emerald-900">
              {formatMetrosKpi(kpis.metrosHoy)}
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-800/80">
              Papel consumido · Konica hoy
            </p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <p className="text-[11px] text-emerald-800">Metros este mes</p>
            <p className="text-sm font-semibold text-emerald-900">
              {formatMetrosKpi(kpis.metrosMes)}
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-800/80">
              Papel consumido · Konica del mes
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700">Cola Konica</p>
            <p className="text-sm font-semibold text-amber-900">
              {kpis.colaKonica}
            </p>
            <p className="mt-0.5 text-[10px] text-amber-800/80">OTs por imprimir</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] text-red-700">Plazo ≤ 4 días</p>
            <p className="text-sm font-semibold text-red-900">
              {kpis.plazoCritico}
            </p>
            <p className="mt-0.5 text-[10px] text-red-800/80">OTs activas</p>
          </div>
        </div>
      ) : null}

      <EtiquetasHojaRutaMuelleView
        rows={rows}
        loading={loading}
        togglingMaquina={togglingMaquina}
        onToggleMaquina={toggleMaquina}
        onOpenDetail={setMuelleDetailRow}
      />

      {loading && rows.length === 0 ? (
        <div className="hidden items-center justify-center gap-2 py-12 text-sm text-slate-600 md:flex">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <Alert className="hidden border-slate-200 bg-slate-50/90 md:block">
          <AlertTitle>Sin filas</AlertTitle>
          <AlertDescription className="text-sm">
            {rows.length === 0
              ? "Aún no hay registros en la hoja de ruta. Usa «Entrada express» (cuando esté activo) o inserta desde planificación."
              : "Ninguna fila coincide con los filtros. Prueba a limpiar búsqueda o mostrar finalizadas."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="hidden max-w-full overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-sm md:block">
          <Table
            className={cn(
              "transition-all duration-300 ease-out",
              compactMode ? "min-w-[1000px] text-[11px]" : "min-w-[1100px] text-xs"
            )}
          >
            <TableHeader>
              <TableRow
                className={cn(
                  "bg-slate-50/90 hover:bg-slate-50/90",
                  compactMode && "h-8"
                )}
              >
                <TableHead className="w-10 px-1 text-center font-semibold text-[#002147]">
                  <span className="sr-only">Editar</span>
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  OT
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  Cliente
                </TableHead>
                <TableHead className="min-w-[8rem] font-semibold text-[#002147]">
                  Trabajo
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  Papel
                </TableHead>
                <TableHead className="text-right font-semibold text-[#002147]">
                  Cant.
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  F. entrega
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  F. entrada
                </TableHead>
                <TableHead
                  className="w-10 whitespace-nowrap px-1 text-center font-semibold text-[#002147]"
                  title="Plazo hasta entrega OT (rojo ≤4d, amarillo 5–14d, verde >2 sem)"
                >
                  Plazo
                </TableHead>
                {MAQUINA_COLS.map(({ label, title }) => (
                  <TableHead
                    key={label}
                    className="w-9 px-1 text-center text-[10px] font-semibold text-[#002147]"
                    title={title}
                  >
                    {label}
                  </TableHead>
                ))}
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  Troquel
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  I / F prod.
                </TableHead>
                <TableHead className="text-right font-semibold text-[#002147]">
                  Caj / Bob / Etq
                </TableHead>
                <TableHead className="min-w-[6rem] font-semibold text-[#002147]">
                  Resto
                </TableHead>
                <TableHead className="w-12 whitespace-nowrap px-1 text-center font-semibold text-[#002147]">
                  Fin.
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    i % 2 === 1 ? "bg-slate-50/50" : "bg-white",
                    "border-slate-100",
                    compactMode && "h-8"
                  )}
                >
                  <TableCell
                    className={cn(
                      "w-10 px-1 text-center align-middle",
                      compactMode && "py-1"
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "text-[#002147] hover:bg-slate-100",
                        compactMode ? "size-6" : "size-7"
                      )}
                      aria-label={`Editar OT ${r.ot_numero}`}
                      onClick={() => setEditingRow(r)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap font-medium text-[#002147]",
                      compactMode && "py-1 font-mono text-[11px]"
                    )}
                  >
                    {r.ot_numero}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "truncate",
                      compactMode ? "max-w-[8rem] py-1 text-[11px]" : "max-w-[10rem]"
                    )}
                    title={r.cliente ?? ""}
                  >
                    {r.cliente ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "truncate",
                      compactMode ? "max-w-[10rem] py-1 text-[11px]" : "max-w-[12rem]"
                    )}
                    title={r.trabajo ?? ""}
                  >
                    {r.trabajo ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "truncate",
                      compactMode ? "max-w-[6rem] py-1 text-[11px]" : "max-w-[8rem]"
                    )}
                    title={r.papel ?? ""}
                  >
                    {r.papel ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      compactMode && "py-1 text-[11px]"
                    )}
                  >
                    {r.cantidad != null ? String(r.cantidad) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap tabular-nums",
                      compactMode && "py-1 text-[11px]"
                    )}
                  >
                    {fmtDate(r.fecha_entrega_ot)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap tabular-nums",
                      compactMode && "py-1 text-[11px]"
                    )}
                  >
                    {fmtDate(r.fecha_entrada_depto)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "px-1 text-center align-middle",
                      compactMode && "py-1"
                    )}
                  >
                    <EntregaPlazoSemaforo
                      fechaEntregaOt={r.fecha_entrega_ot}
                      urgente={r.urgencia === "urgente"}
                    />
                  </TableCell>
                  {MAQUINA_COLS.map(({ field, title }) => (
                    <TableCell
                      key={field}
                      className="px-1 text-center align-middle"
                    >
                      <label
                        className="inline-flex cursor-pointer justify-center py-0.5"
                        title={title}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 cursor-pointer rounded border-slate-300 accent-[#002147] disabled:opacity-50"
                          checked={Boolean(r[field])}
                          disabled={togglingMaquina === `${r.id}:${field}`}
                          aria-label={`${title} OT ${r.ot_numero}`}
                          onChange={(e) => {
                            void toggleMaquina(r, field, e.target.checked);
                          }}
                        />
                      </label>
                    </TableCell>
                  ))}
                  <TableCell
                    className={cn(
                      "max-w-[9rem] truncate",
                      compactMode && "py-1 text-[11px]"
                    )}
                    title={resolveTroquelDisplay(r, troquelesById)}
                  >
                    {resolveTroquelDisplay(r, troquelesById)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap tabular-nums",
                      compactMode ? "py-1 text-[10px]" : "text-[10px]"
                    )}
                  >
                    {fmtDate(r.fecha_inicio_produccion)} /{" "}
                    {fmtDate(r.fecha_fin_produccion)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums text-slate-700",
                      compactMode ? "py-1 text-[10px]" : "text-[10px]"
                    )}
                  >
                    {r.cajas ?? "—"} / {r.bobinas ?? "—"} / {r.etiquetas ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-[8rem] truncate",
                      compactMode ? "py-1 text-[10px]" : "text-[10px]"
                    )}
                    title={r.cajas_restantes ?? ""}
                  >
                    {r.cajas_restantes ?? "—"}
                  </TableCell>
                  <TableCell className="px-1 text-center align-middle">
                    <input
                      type="checkbox"
                      className="size-3.5 cursor-pointer rounded border-slate-300 accent-[#002147] disabled:opacity-50"
                      checked={Boolean(r.finalizado)}
                      disabled={togglingId === r.id}
                      title={
                        r.finalizado
                          ? "Desmarcar finalizada"
                          : "Marcar como finalizada"
                      }
                      aria-label={`Finalizada OT ${r.ot_numero}`}
                      onChange={(e) => {
                        void toggleFinalizado(r, e.target.checked);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


