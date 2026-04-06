"use client";

import {
  Copy,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Printer,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";

import {
  FichaTecnicaPrint,
  FICHA_PRINT_PAGE_STYLE,
  type FichaTecnicaPrintHandle,
} from "@/components/produccion/fichas-tecnicas/FichaTecnicaPrint";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  exportFichasTecnicasListadoPdf,
  exportFichasTecnicasToExcel,
} from "@/lib/fichas-tecnicas-export";
import type { FichaTecnicaImportPayload } from "@/lib/fichas-tecnicas-import";
import { parseFichasTecnicasImportFile } from "@/lib/fichas-tecnicas-import";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const FILTER_ALL = "__all__";

function normalizeFichaRow(raw: Record<string, unknown>): FichaTecnicaRow {
  const otRaw = raw.ot;
  const ot =
    typeof otRaw === "number" && Number.isFinite(otRaw)
      ? otRaw
      : Number.parseInt(String(otRaw ?? "").replace(/\D/g, ""), 10);
  return {
    ...(raw as unknown as FichaTecnicaRow),
    ot: Number.isFinite(ot) ? ot : 0,
  };
}

export type FichaTecnicaRow = {
  id: string;
  ot: number;
  cliente: string;
  trabajo: string;
  gramaje: string | null;
  tipo_material: string | null;
  formato: string | null;
  pasadas: string | null;
  tipo_impresion: string | null;
  densidad_1: number | null;
  densidad_2: number | null;
  densidad_3: number | null;
  densidad_4: number | null;
  densidad_5: number | null;
  densidad_6: number | null;
  densidad_7: number | null;
  densidad_8: number | null;
  notas: string | null;
  ruta_backup: string | null;
  fecha: string | null;
  maquinista: string | null;
  created_at: string;
  updated_at: string | null;
};

const emptyForm = (): Record<string, string> => ({
  ot: "",
  cliente: "",
  trabajo: "",
  gramaje: "",
  tipo_material: "",
  formato: "",
  pasadas: "",
  tipo_impresion: "",
  densidad_1: "",
  densidad_2: "",
  densidad_3: "",
  densidad_4: "",
  densidad_5: "",
  densidad_6: "",
  densidad_7: "",
  densidad_8: "",
  notas: "",
  ruta_backup: "",
  fecha: "",
  maquinista: "",
});

function densidadRowToForm(
  v: number | string | null | undefined
): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function rowToForm(row: FichaTecnicaRow): Record<string, string> {
  const f = emptyForm();
  f.ot = String(row.ot ?? "");
  f.cliente = row.cliente ?? "";
  f.trabajo = row.trabajo ?? "";
  f.gramaje = row.gramaje ?? "";
  f.tipo_material = row.tipo_material ?? "";
  f.formato = row.formato ?? "";
  f.pasadas = row.pasadas ?? "";
  f.tipo_impresion = row.tipo_impresion ?? "";
  f.densidad_1 = densidadRowToForm(row.densidad_1);
  f.densidad_2 = densidadRowToForm(row.densidad_2);
  f.densidad_3 = densidadRowToForm(row.densidad_3);
  f.densidad_4 = densidadRowToForm(row.densidad_4);
  f.densidad_5 = densidadRowToForm(row.densidad_5);
  f.densidad_6 = densidadRowToForm(row.densidad_6);
  f.densidad_7 = densidadRowToForm(row.densidad_7);
  f.densidad_8 = densidadRowToForm(row.densidad_8);
  f.notas = row.notas ?? "";
  f.ruta_backup = row.ruta_backup ?? "";
  f.fecha = row.fecha ?? "";
  f.maquinista = row.maquinista ?? "";
  return f;
}

function parseDensidadFormValue(value: unknown): number | null {
  const str = String(value ?? "").trim().replace(",", ".");
  if (!str) return null;
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

function formToPayload(
  f: Record<string, string>
): { payload: Record<string, unknown>; ot: number } | { error: string } {
  const ot = Number.parseInt(String(f.ot).replace(/\D/g, ""), 10);
  if (Number.isNaN(ot) || ot <= 0) {
    return { error: "La OT debe ser un número válido." };
  }
  const nullIfEmpty = (s: unknown) => {
    const val = String(s ?? "").trim();
    return val ? val : null;
  };
  const payload: Record<string, unknown> = {
    ot,
    cliente: String(f.cliente ?? "").trim(),
    trabajo: String(f.trabajo ?? "").trim(),
    gramaje: nullIfEmpty(f.gramaje),
    tipo_material: nullIfEmpty(f.tipo_material),
    formato: nullIfEmpty(f.formato),
    pasadas: nullIfEmpty(f.pasadas),
    tipo_impresion: nullIfEmpty(f.tipo_impresion),
    densidad_1: parseDensidadFormValue(f.densidad_1),
    densidad_2: parseDensidadFormValue(f.densidad_2),
    densidad_3: parseDensidadFormValue(f.densidad_3),
    densidad_4: parseDensidadFormValue(f.densidad_4),
    densidad_5: parseDensidadFormValue(f.densidad_5),
    densidad_6: parseDensidadFormValue(f.densidad_6),
    densidad_7: parseDensidadFormValue(f.densidad_7),
    densidad_8: parseDensidadFormValue(f.densidad_8),
    notas: nullIfEmpty(f.notas),
    ruta_backup: nullIfEmpty(f.ruta_backup),
    fecha: nullIfEmpty(f.fecha),
    maquinista: nullIfEmpty(f.maquinista),
    updated_at: new Date().toISOString(),
  };
  (
    [
      "densidad_1",
      "densidad_2",
      "densidad_3",
      "densidad_4",
      "densidad_5",
      "densidad_6",
      "densidad_7",
      "densidad_8",
    ] as const
  ).forEach((k) => {
    const v = payload[k];
    if (typeof v === "number" && Number.isNaN(v)) payload[k] = null;
  });
  return { payload, ot };
}

function importPayloadToInsertRow(
  p: FichaTecnicaImportPayload
): Record<string, unknown> {
  return {
    ...p,
    updated_at: new Date().toISOString(),
  };
}

async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    toast.success("Ruta copiada al portapapeles.");
  } catch {
    toast.error("No se pudo copiar. Copia manualmente.");
  }
}

export function FichasTecnicasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<FichaTecnicaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCliente, setFilterCliente] = useState<string>(FILTER_ALL);
  const [filterMaquinista, setFilterMaquinista] = useState<string>(FILTER_ALL);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formEditingId, setFormEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const [viewRow, setViewRow] = useState<FichaTecnicaRow | null>(null);
  const fichaPrintRef = useRef<FichaTecnicaPrintHandle | null>(null);
  const batchPrintRef = useRef<HTMLDivElement>(null);
  const masterCheckboxRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const handleBatchPrint = useReactToPrint({
    contentRef: batchPrintRef,
    documentTitle: "Fichas-tecnicas-lote",
    pageStyle: FICHA_PRINT_PAGE_STYLE,
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prod_fichas_tecnicas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      toast.error(error.message);
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((row) =>
          normalizeFichaRow(row as Record<string, unknown>)
        )
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const uniqueClientes = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = (r.cliente ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const uniqueMaquinistas = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const m = (r.maquinista ?? "").trim();
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const otStr = String(r.ot);
      const cli = (r.cliente ?? "").toLowerCase();
      const trab = (r.trabajo ?? "").toLowerCase();
      return otStr.includes(q) || cli.includes(q) || trab.includes(q);
    });
  }, [rows, search]);

  const filtered = useMemo(() => {
    let list = searchFiltered;
    if (filterCliente !== FILTER_ALL) {
      list = list.filter((r) => (r.cliente ?? "").trim() === filterCliente);
    }
    if (filterMaquinista !== FILTER_ALL) {
      list = list.filter(
        (r) => (r.maquinista ?? "").trim() === filterMaquinista
      );
    }
    return list;
  }, [searchFiltered, filterCliente, filterMaquinista]);

  const selectedRowsForPrint = useMemo(
    () => filtered.filter((r) => selectedIds.has(r.id)),
    [filtered, selectedIds]
  );

  const allInViewSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const someInViewSelected = filtered.some((r) => selectedIds.has(r.id));

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someInViewSelected && !allInViewSelected;
  }, [someInViewSelected, allInViewSelected]);

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allInViewSelected) {
        for (const r of filtered) next.delete(r.id);
      } else {
        for (const r of filtered) next.add(r.id);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setFilterCliente(FILTER_ALL);
    setFilterMaquinista(FILTER_ALL);
  }

  function openNew() {
    setFormEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(row: FichaTecnicaRow) {
    setFormEditingId(row.id);
    setForm(rowToForm(row));
    setFormOpen(true);
  }

  async function saveForm() {
    const parsed = formToPayload(form);
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }
    const payload: Record<string, unknown> = { ...parsed.payload };
    if (formEditingId) {
      payload.id = formEditingId;
    }

    setSaving(true);
    const { error } = await supabase
      .from("prod_fichas_tecnicas")
      .upsert(payload, { onConflict: "ot" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(formEditingId ? "Ficha actualizada." : "Ficha guardada.");
    setFormOpen(false);
    void loadRows();
  }

  async function handleDeleteFicha() {
    if (!formEditingId) return;
    const rowId = formEditingId;
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar este registro?"
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("prod_fichas_tecnicas")
      .delete()
      .eq("id", rowId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ficha eliminada.");
    setFormOpen(false);
    setFormEditingId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
    void loadRows();
  }

  const processImportFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
        toast.error("Solo se admiten archivos .xlsx o .csv.");
        return;
      }
      setImporting(true);
      try {
        const { rows: parsed, parseWarnings, filasLeidas } =
          await parseFichasTecnicasImportFile(file);
        if (parseWarnings.length > 0) {
          toast.info(parseWarnings.slice(0, 6).join(" · "));
        }
        if (parsed.length === 0) {
          toast.error(
            filasLeidas > 0
              ? "No hay filas con OT válida."
              : parseWarnings[0] ?? "No se encontraron datos."
          );
          return;
        }
        const byOt = new Map<number, FichaTecnicaImportPayload>();
        for (const p of parsed) {
          byOt.set(p.ot, p);
        }
        const deduped = Array.from(byOt.values());

        const otsInFile = deduped.map((p) => p.ot);
        const { data: existingRows, error: existingErr } = await supabase
          .from("prod_fichas_tecnicas")
          .select("ot")
          .in("ot", otsInFile);
        if (existingErr) {
          toast.error(existingErr.message);
          return;
        }
        const existingOt = new Set(
          (existingRows ?? []).map((row) => row.ot as number)
        );
        const nuevos = deduped.filter((p) => !existingOt.has(p.ot));
        const omitidas = deduped.length - nuevos.length;
        if (nuevos.length === 0) {
          toast.info(
            `0 nuevas importadas, ${omitidas} omitidas por ya existir.`
          );
          return;
        }
        const batch = nuevos.map(importPayloadToInsertRow);
        const { error } = await supabase
          .from("prod_fichas_tecnicas")
          .insert(batch);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success(
          `${nuevos.length} nuevas importadas, ${omitidas} omitidas por ya existir.`
        );
        void loadRows();
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudo leer el archivo."
        );
      } finally {
        setImporting(false);
      }
    },
    [supabase, loadRows]
  );

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
            Fichas técnicas de impresión
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Alta manual o importación Excel (solo OT nuevas; no se sobrescriben
            datos existentes). Una ficha por OT.
          </p>
          <p className="mt-2 text-xs tabular-nums text-slate-500">
            Fechas (DD/MM/AA):{" "}
            <span className="font-medium text-slate-700">
              {formatFechaEsCorta(new Date().toISOString())}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processImportFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={importing}
            onClick={() => importFileInputRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Importar Excel
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={openNew}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            Nueva ficha manual
          </Button>
        </div>
      </header>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-lg text-[#002147]">
                Últimas fichas
              </CardTitle>
              <CardDescription>
                Listado filtrado; exporta lo que ves en tabla. Usa Ver ficha para
                la vista de taller e imprimir.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#002147]/25"
                disabled={loading || filtered.length === 0}
                onClick={() => {
                  if (filtered.length === 0) {
                    toast.info(
                      "No hay filas para exportar con los filtros actuales."
                    );
                    return;
                  }
                  exportFichasTecnicasToExcel(filtered);
                  toast.success("Excel descargado.");
                }}
              >
                <FileSpreadsheet className="size-4" aria-hidden />
                Excel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#002147]/25"
                disabled={loading || filtered.length === 0}
                onClick={() => {
                  if (filtered.length === 0) {
                    toast.info(
                      "No hay filas para exportar con los filtros actuales."
                    );
                    return;
                  }
                  exportFichasTecnicasListadoPdf(filtered);
                  toast.success("PDF descargado.");
                }}
              >
                <FileText className="size-4" aria-hidden />
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#002147]/25"
                disabled={loading || selectedRowsForPrint.length === 0}
                title={
                  selectedRowsForPrint.length === 0
                    ? "Selecciona una o más fichas en la tabla"
                    : "Imprimir una ficha por folio"
                }
                onClick={() => {
                  if (selectedRowsForPrint.length === 0) {
                    toast.info("Selecciona al menos una ficha en la tabla.");
                    return;
                  }
                  requestAnimationFrame(() => void handleBatchPrint());
                }}
              >
                <Printer className="size-4" aria-hidden />
                Imprimir seleccionados
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="grid gap-1.5 sm:col-span-2 xl:col-span-2">
              <Label htmlFor="buscar-ficha">
                Buscar (OT, cliente, trabajo)
              </Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="buscar-ficha"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej. OT, cliente o trabajo"
                  className="h-9 border-[#002147]/20 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filtro-cliente">Cliente</Label>
              <Select
                value={filterCliente}
                onValueChange={(v) => setFilterCliente(v ?? FILTER_ALL)}
                disabled={loading}
              >
                <SelectTrigger
                  id="filtro-cliente"
                  className="h-9 w-full min-w-0 border-[#002147]/20"
                >
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>
                    Todos los clientes
                  </SelectItem>
                  {uniqueClientes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filtro-maquinista">Maquinista</Label>
              <Select
                value={filterMaquinista}
                onValueChange={(v) => setFilterMaquinista(v ?? FILTER_ALL)}
                disabled={loading}
              >
                <SelectTrigger
                  id="filtro-maquinista"
                  className="h-9 w-full min-w-0 border-[#002147]/20"
                >
                  <SelectValue placeholder="Todos los maquinistas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>
                    Todos los maquinistas
                  </SelectItem>
                  {uniqueMaquinistas.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-1.5 sm:col-span-2 xl:col-span-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full gap-2 border-[#002147]/25 xl:w-full"
                onClick={clearFilters}
              >
                <X className="size-4" aria-hidden />
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-[#002147]/50" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/90">
                  <TableHead className="w-10 px-2 text-center">
                    <input
                      ref={masterCheckboxRef}
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={allInViewSelected}
                      disabled={filtered.length === 0}
                      onChange={() => toggleSelectAllVisible()}
                      title="Seleccionar o quitar todas las fichas visibles"
                      aria-label="Seleccionar todas las fichas visibles en la tabla"
                    />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">OT</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Trabajo</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead className="whitespace-nowrap">Maquinista</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No hay fichas que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="w-10 px-2 text-center align-middle">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectId(row.id)}
                          aria-label={`Seleccionar ficha OT ${row.ot}`}
                        />
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {row.ot}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        {row.cliente || "—"}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">
                        {row.trabajo || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.fecha
                          ? formatFechaEsCorta(`${row.fecha}T12:00:00`)
                          : formatFechaEsCorta(row.created_at)}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-sm">
                        {row.maquinista?.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {row.ruta_backup?.trim() ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() =>
                                void copyPath(row.ruta_backup!.trim())
                              }
                            >
                              <Copy className="mr-1 size-3" />
                              Copiar ruta
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setViewRow(row)}
                          >
                            <Printer className="size-3" />
                            Ver ficha
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="size-3" />
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90vh,880px)] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle>
              {formEditingId ? "Editar ficha" : "Nueva ficha manual"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[min(75vh,720px)] flex-1 gap-4 overflow-y-auto px-6 py-2">
            <div className="grid gap-2">
              <Label htmlFor="f-ot">OT *</Label>
              <Input
                id="f-ot"
                inputMode="numeric"
                value={form.ot}
                onChange={(e) => updateForm("ot", e.target.value)}
                placeholder="Número de pedido"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-cli">Cliente</Label>
              <Input
                id="f-cli"
                value={form.cliente}
                onChange={(e) => updateForm("cliente", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-trab">Trabajo</Label>
              <Input
                id="f-trab"
                value={form.trabajo}
                onChange={(e) => updateForm("trabajo", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-mat">Tipo de material</Label>
              <Input
                id="f-mat"
                value={form.tipo_material}
                onChange={(e) => updateForm("tipo_material", e.target.value)}
                placeholder="Como en el Excel (ej. couché, offset…)"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="f-gram">Gramaje</Label>
                <Input
                  id="f-gram"
                  value={form.gramaje}
                  onChange={(e) => updateForm("gramaje", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="f-fmt">Formato</Label>
                <Input
                  id="f-fmt"
                  value={form.formato}
                  onChange={(e) => updateForm("formato", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="f-pas">Pasadas</Label>
                <Input
                  id="f-pas"
                  value={form.pasadas}
                  onChange={(e) => updateForm("pasadas", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-tip">Tipo impresión / tintas</Label>
              <Input
                id="f-tip"
                value={form.tipo_impresion}
                onChange={(e) => updateForm("tipo_impresion", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => {
                const k = `densidad_${i + 1}`;
                return (
                  <div key={k} className="grid gap-1">
                    <Label htmlFor={k} className="text-xs">
                      Tinta {i + 1}
                    </Label>
                    <Input
                      id={k}
                      className="h-9"
                      value={form[k] ?? ""}
                      onChange={(e) => updateForm(k, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-notas">Notas</Label>
              <Textarea
                id="f-notas"
                rows={4}
                value={form.notas}
                onChange={(e) => updateForm("notas", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-back">Ruta de backup (adjuntos)</Label>
              <Input
                id="f-back"
                value={form.ruta_backup}
                onChange={(e) => updateForm("ruta_backup", e.target.value)}
                placeholder="\\servidor\carpeta\..."
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="f-fecha">Fecha</Label>
                <Input
                  id="f-fecha"
                  type="date"
                  value={form.fecha}
                  onChange={(e) => updateForm("fecha", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="f-ofi">Maquinista</Label>
                <Input
                  id="f-ofi"
                  value={form.maquinista}
                  onChange={(e) => updateForm("maquinista", e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-3 bg-white sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={saving || !formEditingId}
              onClick={() => void handleDeleteFicha()}
            >
              Eliminar
            </Button>
            <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-w-[7rem]"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving}
                className="min-w-[10rem] bg-[#002147] hover:bg-[#002147]/90"
                onClick={() => void saveForm()}
              >
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {formEditingId ? "Guardar cambios" : "Guardar ficha"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewRow != null}
        onOpenChange={(open) => {
          if (!open) setViewRow(null);
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,900px)] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <DialogHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 pr-14">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-left text-[#002147]">
                Vista ficha · OT {viewRow?.ot}
              </DialogTitle>
              {viewRow ? (
                <p className="truncate text-sm text-slate-600">
                  {viewRow.cliente?.trim() || "—"}
                  {viewRow.trabajo?.trim()
                    ? ` · ${viewRow.trabajo.trim()}`
                    : null}
                </p>
              ) : null}
            </div>
            <div className="print:hidden flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
              {viewRow?.ruta_backup?.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 border-[#002147]/25"
                  onClick={() =>
                    viewRow.ruta_backup?.trim()
                      ? void copyPath(viewRow.ruta_backup.trim())
                      : undefined
                  }
                >
                  <Copy className="size-4" aria-hidden />
                  Copiar ruta
                </Button>
              ) : null}
              <Button
                type="button"
                className="gap-2 bg-[#C69C2B] px-5 font-semibold text-[#002147] shadow-sm hover:bg-[#C69C2B]/90"
                onClick={() => fichaPrintRef.current?.print()}
              >
                <Printer className="size-5" aria-hidden />
                Imprimir
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {viewRow ? (
              <FichaTecnicaPrint
                ref={fichaPrintRef}
                data={viewRow}
                showToolbar={false}
                compact
              />
            ) : null}
          </div>

          <DialogFooter className="print:hidden shrink-0 border-t border-slate-200 bg-slate-50/90 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="gap-2 border-[#002147]/20 bg-white font-semibold text-[#002147] hover:bg-slate-100"
              onClick={() => fichaPrintRef.current?.print()}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        ref={batchPrintRef}
        className="ficha-print-batch-host fixed top-0 left-[-120vw] z-0 w-[210mm] max-w-[210mm] min-w-0 bg-white text-sm print:static print:left-0"
        aria-hidden
      >
        {selectedRowsForPrint.map((row, idx) => (
          <div
            key={row.id}
            className={cn(
              idx < selectedRowsForPrint.length - 1 && "ficha-batch-break"
            )}
          >
            <FichaTecnicaPrint
              data={row}
              showToolbar={false}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
