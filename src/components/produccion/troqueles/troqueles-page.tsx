"use client";

import {
  AlertTriangle,
  Copy,
  Droplet,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Loader2,
  Pencil,
  Printer,
  Search,
  Sparkles,
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
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { GlobalModelSelector } from "@/components/layout/header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  exportTroquelesListadoPdf,
  exportTroquelesToExcel,
} from "@/lib/troqueles-export";
import type { TroquelImportPayload } from "@/lib/troqueles-import";
import {
  parseTroquelesImportFile,
  resolveSinRefCollisionsWithDb,
} from "@/lib/troqueles-import";
import {
  troquelAiFuzzySearchPattern,
  troquelAiFullPath,
  troquelAiNestedPath,
  troquelPdfFileUrlFromWindowsPath,
  troquelPdfFullPath,
  troquelPdfFuzzySearchPattern,
  troquelPdfNestedPath,
} from "@/lib/troqueles-path";
import {
  TROQUELES_MAX_ROWS,
  TROQUELES_PAGE_SIZE,
  fetchDistinctClientes,
  troquelesSelectFiltered,
  troquelesSelectFilteredAll,
} from "@/lib/troqueles-query";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { useHubStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const FILTER_ALL = "__all__";

export type TroquelRow = {
  id: string;
  num_troquel: string;
  proveedor: string | null;
  ref_proveedor: string | null;
  cliente: string | null;
  descripcion: string | null;
  tipo_producto: string | null;
  mides: string | null;
  num_figuras: string | null;
  material: string | null;
  formato_papel: string | null;
  figuras_hoja: string | null;
  pinza: string | null;
  plancha_hendidos: string | null;
  expulsion: string | null;
  num_expulsion: string | null;
  taco: string | null;
  relieve_seco: string | null;
  caucho_acrilico: string | null;
  maquina: string | null;
  fecha_ultima_fab: string | null;
  notas: string | null;
  created_at: string;
};

const FORM_KEYS = [
  "num_troquel",
  "proveedor",
  "ref_proveedor",
  "cliente",
  "descripcion",
  "tipo_producto",
  "mides",
  "num_figuras",
  "material",
  "formato_papel",
  "figuras_hoja",
  "pinza",
  "plancha_hendidos",
  "expulsion",
  "num_expulsion",
  "taco",
  "relieve_seco",
  "caucho_acrilico",
  "maquina",
  "fecha_ultima_fab",
  "notas",
] as const;

const FORM_LABELS: Record<(typeof FORM_KEYS)[number], string> = {
  num_troquel: "Nº troquel *",
  proveedor: "Proveedor",
  ref_proveedor: "Ref. proveedor",
  cliente: "Cliente",
  descripcion: "Descripción",
  tipo_producto: "Tipo producto",
  mides: "Mides",
  num_figuras: "Nº figuras",
  material: "Material",
  formato_papel: "Formato papel",
  figuras_hoja: "Figuras por hoja",
  pinza: "Pinza",
  plancha_hendidos: "Plancha hendidos",
  expulsion: "Expulsión",
  num_expulsion: "Nº expulsión",
  taco: "Taco",
  relieve_seco: "Relieve en seco",
  caucho_acrilico: "Caucho acrílico",
  maquina: "Máquina",
  fecha_ultima_fab: "Fecha última fabricación",
  notas: "Notas",
};

function emptyForm(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of FORM_KEYS) o[k] = "";
  return o;
}

function rowToForm(row: TroquelRow): Record<string, string> {
  const f = emptyForm();
  for (const k of FORM_KEYS) {
    if (k === "fecha_ultima_fab") {
      f[k] = row.fecha_ultima_fab ?? "";
    } else {
      f[k] = String(row[k as keyof TroquelRow] ?? "").trim();
    }
  }
  return f;
}

function formToPayload(
  f: Record<string, string>
): { payload: Record<string, unknown> } | { error: string } {
  const num = String(f.num_troquel ?? "").trim();
  if (!num) {
    return { error: "El número de troquel es obligatorio." };
  }
  const nullIfEmpty = (s: string) => {
    const v = s.trim();
    return v ? v : null;
  };
  const payload: Record<string, unknown> = {
    num_troquel: num,
    proveedor: nullIfEmpty(f.proveedor ?? ""),
    ref_proveedor: nullIfEmpty(f.ref_proveedor ?? ""),
    cliente: nullIfEmpty(f.cliente ?? ""),
    descripcion: nullIfEmpty(f.descripcion ?? ""),
    tipo_producto: nullIfEmpty(f.tipo_producto ?? ""),
    mides: nullIfEmpty(f.mides ?? ""),
    num_figuras: nullIfEmpty(f.num_figuras ?? ""),
    material: nullIfEmpty(f.material ?? ""),
    formato_papel: nullIfEmpty(f.formato_papel ?? ""),
    figuras_hoja: nullIfEmpty(f.figuras_hoja ?? ""),
    pinza: nullIfEmpty(f.pinza ?? ""),
    plancha_hendidos: nullIfEmpty(f.plancha_hendidos ?? ""),
    expulsion: nullIfEmpty(f.expulsion ?? ""),
    num_expulsion: nullIfEmpty(f.num_expulsion ?? ""),
    taco: nullIfEmpty(f.taco ?? ""),
    relieve_seco: nullIfEmpty(f.relieve_seco ?? ""),
    caucho_acrilico: nullIfEmpty(f.caucho_acrilico ?? ""),
    maquina: nullIfEmpty(f.maquina ?? ""),
    fecha_ultima_fab: nullIfEmpty(f.fecha_ultima_fab ?? ""),
    notas: nullIfEmpty(f.notas ?? ""),
  };
  return { payload };
}

function importPayloadToInsertRow(p: TroquelImportPayload): Record<string, unknown> {
  return { ...p };
}

function buildTroquelesAsistenteRowsPayload(rows: TroquelRow[]) {
  return rows.map((r) => ({
    num_troquel: r.num_troquel,
    proveedor: r.proveedor,
    ref_proveedor: r.ref_proveedor,
    cliente: r.cliente,
    descripcion: r.descripcion,
    tipo_producto: r.tipo_producto,
    mides: r.mides,
    num_figuras: r.num_figuras,
    material: r.material,
    formato_papel: r.formato_papel,
    figuras_hoja: r.figuras_hoja,
    pinza: r.pinza,
    plancha_hendidos: r.plancha_hendidos,
    expulsion: r.expulsion,
    num_expulsion: r.num_expulsion,
    taco: r.taco,
    relieve_seco: r.relieve_seco,
    caucho_acrilico: r.caucho_acrilico,
    maquina: r.maquina,
    fecha_ultima_fab: r.fecha_ultima_fab,
    notas: r.notas,
  }));
}

async function copyToClipboard(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    toast.success("Ruta copiada al portapapeles.");
  } catch {
    toast.error("No se pudo copiar. Copia manualmente.");
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Muestra el icono del visor de cauchos si el valor indica caucho (p. ej. «SI»). */
function cauchoAcrilicoShowsViewer(v: string | null): boolean {
  const t = (v ?? "").trim();
  if (!t) return false;
  return t.toUpperCase().includes("SI");
}

/** Evita `Error: [object Object]` si `error` en JSON no es string. */
function readErrorFromJsonBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err.trim();
  return null;
}

function readAttemptedPathFromJson(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const p = (body as { attemptedPath?: unknown }).attemptedPath;
  return typeof p === "string" && p.trim() ? p.trim() : null;
}

/** La API debe devolver `files: string[]`; tolera objetos `{ name }` por si acaso. */
function normalizeCauchoFileList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push(s);
      continue;
    }
    if (item && typeof item === "object" && "name" in item) {
      const n = (item as { name: unknown }).name;
      if (typeof n === "string" && n.trim()) out.push(n.trim());
    }
  }
  return out;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function TroquelesPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const globalModel = useHubStore((s) => s.globalModel);
  const [rows, setRows] = useState<TroquelRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [listOffset, setListOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [filterCliente, setFilterCliente] = useState<string>(FILTER_ALL);
  const [clienteOptions, setClienteOptions] = useState<string[]>([]);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const [configRow, setConfigRow] = useState<{
    id: string;
    pdf_path: string | null;
    caucho_path: string | null;
  } | null>(null);
  const [configPathDraft, setConfigPathDraft] = useState("");
  const [configCauchoPathDraft, setConfigCauchoPathDraft] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formEditingId, setFormEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalNum, setPdfModalNum] = useState<string | null>(null);
  const [pdfAssetKind, setPdfAssetKind] = useState<"pdf" | "illustrator" | null>(
    null
  );
  /** Ruta absoluta del archivo encontrado en el servidor (cabecera X-Resolved-Path). */
  const [pdfResolvedPath, setPdfResolvedPath] = useState<string | null>(null);
  /** Si no hay archivo (404): carpeta Nivel 2 para búsqueda manual. */
  const [pdfLocalizarHint, setPdfLocalizarHint] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);

  const [cauchoModalOpen, setCauchoModalOpen] = useState(false);
  const [cauchoModalNum, setCauchoModalNum] = useState<string | null>(null);
  const [cauchoFiles, setCauchoFiles] = useState<string[]>([]);
  const [cauchoSelected, setCauchoSelected] = useState<string | null>(null);
  const [cauchoListLoading, setCauchoListLoading] = useState(false);
  const [cauchoPreviewLoading, setCauchoPreviewLoading] = useState(false);
  const [cauchoError, setCauchoError] = useState<string | null>(null);
  /** Listado vacío por 404 (sin archivos / ruta inválida), para UI centrada. */
  const [cauchoListNotFound, setCauchoListNotFound] = useState(false);
  /** Ruta absoluta que intentó usar la API (depuración en modal). */
  const [cauchoErrorAttemptedPath, setCauchoErrorAttemptedPath] = useState<
    string | null
  >(null);
  const [cauchoBlobUrl, setCauchoBlobUrl] = useState<string | null>(null);
  const cauchoIframeRef = useRef<HTMLIFrameElement>(null);

  const [asistentePregunta, setAsistentePregunta] = useState("");
  const [asistenteLoading, setAsistenteLoading] = useState(false);
  const [asistenteError, setAsistenteError] = useState<string | null>(null);
  const [asistenteText, setAsistenteText] = useState("");
  const abortAsistenteRef = useRef<AbortController | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from("prod_troqueles_config")
      .select("id, pdf_path, caucho_path")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setConfigRow({
        id: data.id as string,
        pdf_path: data.pdf_path as string | null,
        caucho_path: (data as { caucho_path?: string | null }).caucho_path ?? null,
      });
      setConfigPathDraft((data.pdf_path as string | null)?.trim() ?? "");
      setConfigCauchoPathDraft(
        ((data as { caucho_path?: string | null }).caucho_path ?? null)?.trim() ??
          ""
      );
    } else {
      setConfigRow(null);
      setConfigPathDraft("");
      setConfigCauchoPathDraft("");
    }
  }, [supabase]);

  const clienteFilterValue =
    filterCliente === FILTER_ALL ? null : filterCliente;

  const reloadListFromServer = useCallback(async () => {
    setLoading(true);
    setHasMore(true);
    setListOffset(0);
    const { data, error, count } = await troquelesSelectFiltered(supabase, {
      search: debouncedSearch,
      cliente: clienteFilterValue,
      offset: 0,
      limit: TROQUELES_PAGE_SIZE,
    });
    if (error) {
      console.error(error);
      toast.error(error.message);
      setRows([]);
      setTotalCount(null);
    } else {
      const batch = (data ?? []) as TroquelRow[];
      setRows(batch);
      setTotalCount(count ?? null);
      setListOffset(batch.length);
      const c = count;
      setHasMore(
        batch.length === TROQUELES_PAGE_SIZE &&
          batch.length < TROQUELES_MAX_ROWS &&
          (c == null || batch.length < c)
      );
    }
    setLoading(false);
  }, [supabase, debouncedSearch, clienteFilterValue]);

  const loadMoreRows = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    if (listOffset >= TROQUELES_MAX_ROWS) {
      setHasMore(false);
      return;
    }
    setLoadingMore(true);
    const { data, error, count } = await troquelesSelectFiltered(supabase, {
      search: debouncedSearch,
      cliente: clienteFilterValue,
      offset: listOffset,
      limit: TROQUELES_PAGE_SIZE,
    });
    if (error) {
      toast.error(error.message);
      setLoadingMore(false);
      return;
    }
    const batch = (data ?? []) as TroquelRow[];
    setRows((prev) => [...prev, ...batch]);
    const nextOff = listOffset + batch.length;
    setListOffset(nextOff);
    if (count != null) setTotalCount(count);
    const c = count ?? totalCount;
    setHasMore(
      batch.length === TROQUELES_PAGE_SIZE &&
        nextOff < TROQUELES_MAX_ROWS &&
        (c == null || nextOff < c)
    );
    setLoadingMore(false);
  }, [
    supabase,
    debouncedSearch,
    clienteFilterValue,
    hasMore,
    loadingMore,
    loading,
    listOffset,
    totalCount,
  ]);

  useEffect(() => {
    void reloadListFromServer();
  }, [reloadListFromServer]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchDistinctClientes(supabase);
        if (!cancelled) setClienteOptions(list);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e?.isIntersecting) void loadMoreRows();
      },
      { root: null, rootMargin: "120px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMoreRows]);

  const runAsistente = useCallback(async () => {
    const q = asistentePregunta.trim();
    if (!q) {
      toast.error("Escribe una pregunta.");
      return;
    }
    abortAsistenteRef.current?.abort();
    const ac = new AbortController();
    abortAsistenteRef.current = ac;
    setAsistenteLoading(true);
    setAsistenteError(null);
    try {
      const { data: allRows, error: fetchErr } = await troquelesSelectFilteredAll(
        supabase,
        {
          search: debouncedSearch,
          cliente: clienteFilterValue,
          maxRows: TROQUELES_MAX_ROWS,
        }
      );
      if (fetchErr) throw fetchErr;
      const payload = buildTroquelesAsistenteRowsPayload(
        (allRows ?? []) as TroquelRow[]
      );
      const res = await fetch("/api/gemini/troqueles-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          rows: payload,
          question: q,
        }),
        signal: ac.signal,
      });
      const data = (await res.json()) as { error?: string; text?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al responder");
      setAsistenteText(data.text ?? "");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setAsistenteError(
        e instanceof Error ? e.message : "Error desconocido"
      );
      setAsistenteText("");
    } finally {
      setAsistenteLoading(false);
    }
  }, [
    asistentePregunta,
    globalModel,
    supabase,
    debouncedSearch,
    clienteFilterValue,
  ]);

  function clearFilters() {
    setSearch("");
    setFilterCliente(FILTER_ALL);
  }

  function openNew() {
    setFormEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(row: TroquelRow) {
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
    setSaving(true);
    if (formEditingId) {
      const { error } = await supabase
        .from("prod_troqueles")
        .update(parsed.payload)
        .eq("id", formEditingId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Troquel actualizado.");
    } else {
      const { error } = await supabase.from("prod_troqueles").insert(parsed.payload);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Troquel guardado.");
    }
    setFormOpen(false);
    void reloadListFromServer();
  }

  async function handleDeleteTroquel() {
    if (!formEditingId) return;
    const rowId = formEditingId;
    if (!confirm("¿Eliminar este registro de troquel?")) return;
    setSaving(true);
    const { error } = await supabase.from("prod_troqueles").delete().eq("id", rowId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registro eliminado.");
    setFormOpen(false);
    setFormEditingId(null);
    void reloadListFromServer();
  }

  async function savePdfConfig() {
    const path = configPathDraft.trim();
    const cauchoPath = configCauchoPathDraft.trim();
    setSavingConfig(true);
    if (configRow?.id) {
      const { error } = await supabase
        .from("prod_troqueles_config")
        .update({ pdf_path: path || null, caucho_path: cauchoPath || null })
        .eq("id", configRow.id);
      setSavingConfig(false);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("prod_troqueles_config")
        .insert({ pdf_path: path || null, caucho_path: cauchoPath || null })
        .select("id, pdf_path, caucho_path")
        .single();
      setSavingConfig(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data) {
        setConfigRow({
          id: data.id as string,
          pdf_path: data.pdf_path as string | null,
          caucho_path: (data as { caucho_path?: string | null }).caucho_path ?? null,
        });
      }
    }
    toast.success("Ubicación guardada.");
    void loadConfig();
  }

  const revokePdfBlob = useCallback(() => {
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const openPdfPreview = useCallback(
    async (row: TroquelRow) => {
      const num = row.num_troquel?.trim();
      if (!num) {
        toast.error("Este registro no tiene número de troquel.");
        return;
      }
      setPdfModalNum(num);
      setPdfModalOpen(true);
      setPdfAssetKind(null);
      setPdfResolvedPath(null);
      setPdfLocalizarHint(null);
      setPdfLoading(true);
      setPdfError(null);
      revokePdfBlob();
      try {
        const res = await fetch(
          `/api/produccion/troquel-pdf?num=${encodeURIComponent(num)}`
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            localizarHint?: string;
          };
          setPdfResolvedPath(null);
          setPdfLocalizarHint(
            typeof j.localizarHint === "string" ? j.localizarHint : null
          );
          throw new Error(j.error ?? `Error ${res.status}`);
        }
        const resolvedEnc = res.headers.get("X-Resolved-Path");
        const resolved = resolvedEnc
          ? decodeURIComponent(resolvedEnc)
          : null;
        setPdfResolvedPath(resolved);
        setPdfLocalizarHint(null);
        const kind = res.headers.get("X-Asset-Kind");
        if (kind === "illustrator") {
          await res.blob();
          setPdfAssetKind("illustrator");
          setPdfBlobUrl(null);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfAssetKind("pdf");
        setPdfBlobUrl(url);
      } catch (e) {
        setPdfError(e instanceof Error ? e.message : "No se pudo cargar el PDF.");
      } finally {
        setPdfLoading(false);
      }
    },
    [revokePdfBlob]
  );

  function closePdfModal(open: boolean) {
    if (!open) {
      revokePdfBlob();
      setPdfModalNum(null);
      setPdfAssetKind(null);
      setPdfResolvedPath(null);
      setPdfLocalizarHint(null);
      setPdfError(null);
    }
    setPdfModalOpen(open);
  }

  function printPdfInModal() {
    const w = pdfIframeRef.current?.contentWindow;
    if (w) w.print();
    else toast.info("Espera a que cargue el PDF.");
  }

  const revokeCauchoBlob = useCallback(() => {
    setCauchoBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const loadCauchoPreview = useCallback(
    async (num: string, fileName: string) => {
      revokeCauchoBlob();
      setCauchoPreviewLoading(true);
      setCauchoError(null);
      setCauchoErrorAttemptedPath(null);
      setCauchoSelected(fileName);
      try {
        const res = await fetch(
          `/api/produccion/caucho-list?num=${encodeURIComponent(num)}&file=${encodeURIComponent(fileName)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg =
            readErrorFromJsonBody(body) ??
            `No se pudo cargar el archivo (${res.status}).`;
          setCauchoError(msg);
          setCauchoErrorAttemptedPath(readAttemptedPathFromJson(body));
          setCauchoBlobUrl(null);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setCauchoBlobUrl(url);
        setCauchoErrorAttemptedPath(null);
      } catch (e) {
        setCauchoError(
          e instanceof Error ? e.message : "No se pudo cargar el PDF de caucho."
        );
        setCauchoBlobUrl(null);
        setCauchoErrorAttemptedPath(null);
      } finally {
        setCauchoPreviewLoading(false);
      }
    },
    [revokeCauchoBlob]
  );

  const openCauchoViewer = useCallback(
    async (row: TroquelRow) => {
      const num = row.num_troquel?.trim();
      if (!num) {
        toast.error("Este registro no tiene número de troquel.");
        return;
      }
      setCauchoModalNum(num);
      setCauchoModalOpen(true);
      setCauchoFiles([]);
      setCauchoSelected(null);
      setCauchoError(null);
      setCauchoListNotFound(false);
      setCauchoErrorAttemptedPath(null);
      revokeCauchoBlob();
      setCauchoListLoading(true);
      let list: string[] = [];
      try {
        const res = await fetch(
          `/api/produccion/caucho-list?num=${encodeURIComponent(num)}`
        );
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            readErrorFromJsonBody(body) ??
            `No se pudo obtener la lista de cauchos (${res.status}).`;
          setCauchoError(msg);
          setCauchoErrorAttemptedPath(readAttemptedPathFromJson(body));
          setCauchoListNotFound(res.status === 404);
          setCauchoFiles([]);
          return;
        }
        list = normalizeCauchoFileList(
          body && typeof body === "object"
            ? (body as { files?: unknown }).files
            : undefined
        );
        setCauchoFiles(list);
        setCauchoListNotFound(false);
        setCauchoErrorAttemptedPath(null);
        if (list.length === 1) {
          await loadCauchoPreview(num, list[0]);
        }
      } catch (e) {
        setCauchoError(
          e instanceof Error ? e.message : "No se pudo listar los cauchos."
        );
        setCauchoListNotFound(false);
        setCauchoErrorAttemptedPath(null);
      } finally {
        setCauchoListLoading(false);
      }
    },
    [revokeCauchoBlob, loadCauchoPreview]
  );

  function closeCauchoModal(open: boolean) {
    if (!open) {
      revokeCauchoBlob();
      setCauchoModalNum(null);
      setCauchoFiles([]);
      setCauchoSelected(null);
      setCauchoError(null);
      setCauchoListNotFound(false);
      setCauchoErrorAttemptedPath(null);
    }
    setCauchoModalOpen(open);
  }

  function printCauchoInModal() {
    const w = cauchoIframeRef.current?.contentWindow;
    if (w) w.print();
    else toast.info("Selecciona un PDF o espera a que cargue.");
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
          await parseTroquelesImportFile(file);
        if (parseWarnings.length > 0) {
          toast.info(parseWarnings.slice(0, 6).join(" · "));
        }
        if (parsed.length === 0) {
          toast.error(
            filasLeidas > 0
              ? "No hay filas válidas para importar."
              : parseWarnings[0] ?? "No se encontraron datos."
          );
          return;
        }
        const resolved = await resolveSinRefCollisionsWithDb(parsed, supabase);
        const byNum = new Map<string, TroquelImportPayload>();
        for (const p of resolved) {
          byNum.set(p.num_troquel.trim().toLowerCase(), p);
        }
        const deduped = Array.from(byNum.values());

        const nums = deduped.map((p) => p.num_troquel);
        const existing = new Set<string>();
        for (const part of chunkArray(nums, 100)) {
          const { data: existingRows, error: existingErr } = await supabase
            .from("prod_troqueles")
            .select("num_troquel")
            .in("num_troquel", part);
          if (existingErr) {
            toast.error(existingErr.message);
            return;
          }
          for (const r of existingRows ?? []) {
            existing.add(String(r.num_troquel ?? "").trim().toLowerCase());
          }
        }
        const nuevos = deduped.filter(
          (p) => !existing.has(p.num_troquel.trim().toLowerCase())
        );
        const omitidas = deduped.length - nuevos.length;
        if (nuevos.length === 0) {
          toast.info(
            `0 nuevos importados, ${omitidas} omitidos por ya existir.`
          );
          return;
        }
        const batch = nuevos.map(importPayloadToInsertRow);
        const { error } = await supabase.from("prod_troqueles").insert(batch);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success(
          `${nuevos.length} nuevos importados, ${omitidas} omitidos por ya existir.`
        );
        void reloadListFromServer();
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudo leer el archivo."
        );
      } finally {
        setImporting(false);
      }
    },
    [supabase, reloadListFromServer]
  );

  const runExportExcel = useCallback(async () => {
    setExportBusy(true);
    try {
      const { data, error } = await troquelesSelectFilteredAll(supabase, {
        search: debouncedSearch,
        cliente: clienteFilterValue,
        maxRows: TROQUELES_MAX_ROWS,
      });
      if (error) throw error;
      const list = (data ?? []) as TroquelRow[];
      if (list.length === 0) {
        toast.info("No hay filas con los filtros actuales.");
        return;
      }
      exportTroquelesToExcel(list);
      toast.success("Excel descargado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar.");
    } finally {
      setExportBusy(false);
    }
  }, [supabase, debouncedSearch, clienteFilterValue]);

  const runExportPdf = useCallback(async () => {
    setExportBusy(true);
    try {
      const { data, error } = await troquelesSelectFilteredAll(supabase, {
        search: debouncedSearch,
        cliente: clienteFilterValue,
        maxRows: TROQUELES_MAX_ROWS,
      });
      if (error) throw error;
      const list = (data ?? []) as TroquelRow[];
      if (list.length === 0) {
        toast.info("No hay filas con los filtros actuales.");
        return;
      }
      exportTroquelesListadoPdf(list);
      toast.success("PDF descargado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar.");
    } finally {
      setExportBusy(false);
    }
  }, [supabase, debouncedSearch, clienteFilterValue]);

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const pdfFuzzyPattern = useMemo(
    () =>
      pdfModalNum && configPathDraft.trim()
        ? troquelPdfFuzzySearchPattern(configPathDraft, pdfModalNum)
        : "",
    [pdfModalNum, configPathDraft]
  );

  const pdfAiFuzzyPattern = useMemo(
    () =>
      pdfModalNum && configPathDraft.trim()
        ? troquelAiFuzzySearchPattern(configPathDraft, pdfModalNum)
        : "",
    [pdfModalNum, configPathDraft]
  );

  const pdfNestedLocalUrl = useMemo(
    () =>
      pdfModalNum && configPathDraft.trim()
        ? troquelPdfFileUrlFromWindowsPath(
            troquelPdfNestedPath(configPathDraft, pdfModalNum)
          )
        : "",
    [pdfModalNum, configPathDraft]
  );

  const aiNestedLocalUrl = useMemo(
    () =>
      pdfModalNum && configPathDraft.trim()
        ? troquelPdfFileUrlFromWindowsPath(
            troquelAiNestedPath(configPathDraft, pdfModalNum)
          )
        : "",
    [pdfModalNum, configPathDraft]
  );

  /** Localizar en Red: archivo encontrado → ruta completa; si no → carpeta Nivel 2 (404); si no → patrón comodín. */
  const pdfLocalizarCopyTarget = useMemo(() => {
    if (pdfResolvedPath?.trim()) return pdfResolvedPath.trim();
    if (pdfLocalizarHint?.trim()) return pdfLocalizarHint.trim();
    if (pdfAssetKind === "illustrator" && pdfAiFuzzyPattern)
      return pdfAiFuzzyPattern;
    return pdfFuzzyPattern;
  }, [
    pdfResolvedPath,
    pdfLocalizarHint,
    pdfAssetKind,
    pdfAiFuzzyPattern,
    pdfFuzzyPattern,
  ]);

  const pdfPlanaCopyTarget = useMemo(() => {
    if (pdfResolvedPath?.trim()) return pdfResolvedPath.trim();
    if (pdfModalNum && configPathDraft.trim()) {
      return pdfAssetKind === "illustrator"
        ? troquelAiFullPath(configPathDraft, pdfModalNum)
        : troquelPdfFullPath(configPathDraft, pdfModalNum);
    }
    return "";
  }, [pdfResolvedPath, pdfModalNum, configPathDraft, pdfAssetKind]);

  const asistenteCuerpo = (
    <div className="space-y-2 pt-0.5">
      <p className="text-[11px] leading-snug text-muted-foreground">
        La IA usa hasta <strong>{TROQUELES_MAX_ROWS}</strong> filas que coinciden
        con búsqueda y cliente (consulta en servidor), no solo la página visible.
      </p>
      <GlobalModelSelector
        layout="stack"
        className="[&_span]:text-[10px] [&_select]:h-8 [&_select]:text-xs"
      />
      <Textarea
        value={asistentePregunta}
        onChange={(e) => setAsistentePregunta(e.target.value)}
        rows={3}
        placeholder="Ej. «¿Qué troqueles hay para Vermont?» · «¿Expulsor en estuches OCURITE?» · «¿Barniz Venovar?»"
        className="min-h-[4.25rem] resize-y text-xs"
        disabled={asistenteLoading}
      />
      <Button
        type="button"
        size="sm"
        className="h-8 w-full gap-1.5 bg-[#002147] text-xs text-white hover:bg-[#002147]/90"
        disabled={asistenteLoading || loading}
        onClick={() => void runAsistente()}
      >
        {asistenteLoading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
        )}
        Preguntar
      </Button>
      {asistenteError ? (
        <Alert className="border-red-200 bg-red-50/95 py-2 text-red-950">
          <AlertTitle className="text-xs">No se pudo responder</AlertTitle>
          <AlertDescription className="text-xs">{asistenteError}</AlertDescription>
        </Alert>
      ) : null}
      {asistenteText.trim() ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/90 px-2 py-2">
          <div className="prose prose-sm prose-slate max-w-none dark:prose-invert [&_p]:my-1.5 [&_ul]:my-1 [&_li]:text-xs [&_p]:text-xs">
            <ReactMarkdown>{asistenteText}</ReactMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-10 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
            Troqueles
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Registro de troqueles, importación Excel (solo números nuevos; no se
            sobrescriben filas existentes) y consulta del PDF por número.
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
          <Button type="button" variant="secondary" className="gap-2" onClick={openNew}>
            <FileSpreadsheet className="size-4" aria-hidden />
            Nuevo registro
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <div className="min-w-0 flex-1 space-y-4">
          <details className="group rounded-xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#002147] [&::-webkit-details-marker]:hidden">
              <Sparkles className="size-4 shrink-0 text-[#C69C2B]" aria-hidden />
              Asistente de Troqueles
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Toca para expandir
              </span>
            </summary>
            <div className="border-t border-slate-100 px-3 pb-3 pt-2">
              {asistenteCuerpo}
            </div>
          </details>

          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-lg text-[#002147]">
                    Listado de troqueles
                  </CardTitle>
              <CardDescription>
                Búsqueda y filtro de cliente se aplican en el servidor (toda la
                base, hasta {TROQUELES_MAX_ROWS} filas cargadas con desplazamiento).
                {totalCount != null ? (
                  <span className="mt-1 block text-slate-600">
                    Coincidencias: <strong>{totalCount}</strong> · En pantalla:{" "}
                    <strong>{rows.length}</strong>
                    {hasMore ? " (hay más por cargar)" : null}
                  </span>
                ) : null}
              </CardDescription>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-[#002147]/25"
                    disabled={loading || exportBusy || rows.length === 0}
                    onClick={() => void runExportExcel()}
                  >
                    {exportBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <FileSpreadsheet className="size-4" aria-hidden />
                    )}
                    Excel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-[#002147]/25"
                    disabled={loading || exportBusy || rows.length === 0}
                    onClick={() => void runExportPdf()}
                  >
                    {exportBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <FileText className="size-4" aria-hidden />
                    )}
                    PDF
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="buscar-troquel">Buscar</Label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="buscar-troquel"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nº troquel, cliente, material, notas…"
                      className="h-9 border-[#002147]/20 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filtro-cliente-t">Cliente</Label>
                  <Select
                    value={filterCliente}
                    onValueChange={(v) => setFilterCliente(v ?? FILTER_ALL)}
                    disabled={loading}
                  >
                    <SelectTrigger
                      id="filtro-cliente-t"
                      className="h-9 w-full min-w-0 border-[#002147]/20"
                    >
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FILTER_ALL}>Todos los clientes</SelectItem>
                      {clienteOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full gap-2 border-[#002147]/25"
                    onClick={clearFilters}
                  >
                    <X className="size-4" aria-hidden />
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 px-4 pb-4 pt-0 sm:px-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-[#002147]/50" />
                </div>
              ) : (
                <>
                <div
                  className={cn(
                    "max-h-[min(650px,70vh)] min-h-[200px] overflow-auto rounded-lg border border-slate-200/90 bg-white shadow-[inset_0_1px_0_0_rgb(241_245_249)]",
                    "[scrollbar-width:thin]",
                    "[scrollbar-color:rgba(148,163,184,0.45)_rgb(248_250_252)]",
                    "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2",
                    "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/45",
                    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-400/65",
                    "[&::-webkit-scrollbar-track]:rounded-md [&::-webkit-scrollbar-track]:bg-slate-100/80"
                  )}
                >
                <Table
                  containerClassName="overflow-visible"
                  className="w-full border-collapse text-xs leading-tight"
                >
                  <TableHeader className="[&_tr]:border-b-0 [&_tr:hover]:bg-transparent [&_th]:sticky [&_th]:top-0 [&_th]:z-[14] [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50/95 [&_th]:py-1 [&_th]:px-1.5 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:backdrop-blur-sm [&_th]:shadow-[0_1px_0_0_rgb(226_232_240)] [&_th:first-child]:left-0 [&_th:first-child]:z-30 [&_th:first-child]:bg-slate-50/95">
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className="!h-8 w-9 min-w-[2.25rem] px-0.5 text-center">
                        PDF
                      </TableHead>
                      <TableHead className="!h-8 w-24 min-w-[5.5rem] whitespace-nowrap">
                        Nº
                      </TableHead>
                      <TableHead className="!h-8 w-28 max-w-[7rem] whitespace-nowrap">
                        Prov.
                      </TableHead>
                      <TableHead className="!h-8 w-20 whitespace-nowrap">Ref.</TableHead>
                      <TableHead className="!h-8 w-36 min-w-0 max-w-36">
                        Cliente
                      </TableHead>
                      <TableHead className="!h-8 w-36 min-w-0 max-w-36">
                        Descripción
                      </TableHead>
                      <TableHead className="!h-8 w-28 whitespace-nowrap">Tipo prod.</TableHead>
                      <TableHead className="!h-8 w-24 whitespace-nowrap">Mides</TableHead>
                      <TableHead className="!h-8 w-14 whitespace-nowrap">Nº fig.</TableHead>
                      <TableHead className="!h-8 w-28 whitespace-nowrap">Material</TableHead>
                      <TableHead className="!h-8 w-24 whitespace-nowrap">Formato</TableHead>
                      <TableHead className="!h-8 w-16 whitespace-nowrap">Fig./h.</TableHead>
                      <TableHead className="!h-8 w-20 whitespace-nowrap">Pinza</TableHead>
                      <TableHead className="!h-8 w-20 whitespace-nowrap">Hendid.</TableHead>
                      <TableHead className="!h-8 w-20 whitespace-nowrap">Expuls.</TableHead>
                      <TableHead className="!h-8 w-14 whitespace-nowrap">Nº exp.</TableHead>
                      <TableHead className="!h-8 w-14 whitespace-nowrap">Taco</TableHead>
                      <TableHead className="!h-8 w-16 whitespace-nowrap">Relieve</TableHead>
                      <TableHead className="!h-8 w-20 whitespace-nowrap">Caucho</TableHead>
                      <TableHead className="!h-8 w-24 whitespace-nowrap">Máq.</TableHead>
                      <TableHead className="!h-8 w-[5.5rem] whitespace-nowrap">
                        F. fab.
                      </TableHead>
                      <TableHead className="!h-8 w-36 min-w-0 max-w-36">Notas</TableHead>
                      <TableHead className="!h-8 w-[5.25rem] whitespace-nowrap">Alta</TableHead>
                      <TableHead className="!h-8 w-[4.5rem] whitespace-nowrap text-right">
                        Ed.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:!py-1 [&_td]:!px-1.5 [&_td]:align-middle [&_td]:text-xs">
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={24}
                          className="py-8 text-center text-xs text-muted-foreground"
                        >
                          No hay troqueles que coincidan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-slate-50/80">
                          <TableCell className="sticky left-0 z-[11] w-9 min-w-[2.25rem] border-r border-slate-100 bg-white px-0.5 shadow-[2px_0_6px_-4px_rgba(0,33,71,0.12)]">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-7 shrink-0 border-[#002147]/25"
                              title="Previsualizar PDF"
                              onClick={() => void openPdfPreview(row)}
                            >
                              <Eye className="size-3.5" aria-hidden />
                            </Button>
                          </TableCell>
                          <TableCell className="w-24 min-w-[5.5rem] whitespace-nowrap font-semibold tabular-nums">
                            {row.num_troquel || "—"}
                          </TableCell>
                          <TableCell
                            className="w-28 max-w-[7rem] truncate whitespace-nowrap"
                            title={row.proveedor ?? ""}
                          >
                            {row.proveedor || "—"}
                          </TableCell>
                          <TableCell
                            className="w-20 truncate whitespace-nowrap"
                            title={row.ref_proveedor ?? ""}
                          >
                            {row.ref_proveedor || "—"}
                          </TableCell>
                          <TableCell
                            className="w-36 min-w-0 max-w-36 truncate"
                            title={row.cliente ?? ""}
                          >
                            {row.cliente || "—"}
                          </TableCell>
                          <TableCell
                            className="w-36 min-w-0 max-w-36 truncate"
                            title={row.descripcion ?? ""}
                          >
                            {row.descripcion || "—"}
                          </TableCell>
                          <TableCell
                            className="w-28 truncate whitespace-nowrap"
                            title={row.tipo_producto ?? ""}
                          >
                            {row.tipo_producto || "—"}
                          </TableCell>
                          <TableCell className="w-24 whitespace-nowrap">
                            {row.mides || "—"}
                          </TableCell>
                          <TableCell className="w-14 whitespace-nowrap text-center tabular-nums">
                            {row.num_figuras || "—"}
                          </TableCell>
                          <TableCell
                            className="w-28 truncate whitespace-nowrap"
                            title={row.material ?? ""}
                          >
                            {row.material || "—"}
                          </TableCell>
                          <TableCell
                            className="w-24 truncate whitespace-nowrap"
                            title={row.formato_papel ?? ""}
                          >
                            {row.formato_papel || "—"}
                          </TableCell>
                          <TableCell className="w-16 whitespace-nowrap text-center">
                            {row.figuras_hoja || "—"}
                          </TableCell>
                          <TableCell className="w-20 whitespace-nowrap">
                            {row.pinza || "—"}
                          </TableCell>
                          <TableCell
                            className="w-20 truncate whitespace-nowrap"
                            title={row.plancha_hendidos ?? ""}
                          >
                            {row.plancha_hendidos || "—"}
                          </TableCell>
                          <TableCell
                            className="w-20 truncate whitespace-nowrap"
                            title={row.expulsion ?? ""}
                          >
                            {row.expulsion || "—"}
                          </TableCell>
                          <TableCell className="w-14 whitespace-nowrap">
                            {row.num_expulsion || "—"}
                          </TableCell>
                          <TableCell className="w-14 whitespace-nowrap">
                            {row.taco || "—"}
                          </TableCell>
                          <TableCell className="w-16 whitespace-nowrap">
                            {row.relieve_seco || "—"}
                          </TableCell>
                          <TableCell
                            className="w-24 max-w-[9rem] whitespace-nowrap"
                            title={row.caucho_acrilico ?? ""}
                          >
                            <div className="flex min-w-0 items-center gap-0.5">
                              <span className="min-w-0 truncate">
                                {row.caucho_acrilico || "—"}
                              </span>
                              {cauchoAcrilicoShowsViewer(row.caucho_acrilico) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 shrink-0 text-[#002147]/85 hover:bg-[#002147]/10 hover:text-[#002147]"
                                  title="Visor de cauchos"
                                  onClick={() => void openCauchoViewer(row)}
                                >
                                  <Droplet className="size-3.5" aria-hidden />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell
                            className="w-24 truncate whitespace-nowrap"
                            title={row.maquina ?? ""}
                          >
                            {row.maquina || "—"}
                          </TableCell>
                          <TableCell className="w-[5.5rem] whitespace-nowrap tabular-nums">
                            {row.fecha_ultima_fab
                              ? formatFechaEsCorta(`${row.fecha_ultima_fab}T12:00:00`)
                              : "—"}
                          </TableCell>
                          <TableCell
                            className="w-36 min-w-0 max-w-36 truncate"
                            title={row.notas ?? ""}
                          >
                            {row.notas || "—"}
                          </TableCell>
                          <TableCell className="w-[5.25rem] whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
                            {formatFechaEsCorta(row.created_at)}
                          </TableCell>
                          <TableCell className="w-[4.5rem] p-0.5 text-right">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="size-7 border-[#002147]/15"
                              title="Editar registro"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {!loading && rows.length > 0 && hasMore ? (
                  <div
                    ref={loadMoreSentinelRef}
                    className="flex justify-center border-t border-slate-200/80 bg-slate-50/50 py-3 text-xs text-muted-foreground"
                  >
                    {loadingMore ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Cargando más resultados…
                      </span>
                    ) : (
                      <span>
                        Desplázate hacia abajo para cargar más (hasta{" "}
                        {TROQUELES_MAX_ROWS} filas)
                      </span>
                    )}
                  </div>
                ) : null}
                </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base text-[#002147]">
                Configuración de ubicación (PDF y cauchos)
              </CardTitle>
              <CardDescription className="text-xs">
                Carpeta de dibujos troquel y carpeta de PDFs de cauchos (patrón{" "}
                <code className="rounded bg-slate-100 px-1">[num_troquel]_*.pdf</code>
                ). Accesible por Node en el despliegue. Columnas{" "}
                <code className="rounded bg-slate-100 px-1">pdf_path</code> y{" "}
                <code className="rounded bg-slate-100 px-1">caucho_path</code> en{" "}
                <code className="rounded bg-slate-100 px-1">prod_troqueles_config</code>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="pdf-path">Ruta carpeta PDFs (troquel)</Label>
                  <Input
                    id="pdf-path"
                    value={configPathDraft}
                    onChange={(e) => setConfigPathDraft(e.target.value)}
                    placeholder="Ej. \\servidor\carpeta\troqueles o C:\Datos\Troqueles"
                    className="font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="caucho-path">Ruta carpeta cauchos</Label>
                  <Input
                    id="caucho-path"
                    value={configCauchoPathDraft}
                    onChange={(e) => setConfigCauchoPathDraft(e.target.value)}
                    placeholder="Ej. D:\emepe\Cauchos\PDFs (mismo servidor que la app)"
                    className="font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  className="bg-[#002147] hover:bg-[#002147]/90"
                  disabled={savingConfig}
                  onClick={() => void savePdfConfig()}
                >
                  {savingConfig ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Guardar ubicación
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="hidden w-full shrink-0 lg:block lg:w-72 lg:max-w-[18rem] lg:sticky lg:top-20 lg:self-start">
          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-base text-[#002147]">
                <Sparkles
                  className="size-4 shrink-0 text-[#C69C2B]"
                  aria-hidden
                />
                Asistente de Troqueles
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Preguntas sobre el listado filtrado (clientes, materiales,
                expulsión, barnices, máquinas…).
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4 pt-0">{asistenteCuerpo}</CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90vh,880px)] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle>
              {formEditingId ? "Editar troquel" : "Nuevo troquel"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[min(75vh,720px)] flex-1 gap-3 overflow-y-auto px-6 py-2 sm:grid-cols-2">
            {FORM_KEYS.map((key) => (
              <div key={key} className={key === "descripcion" || key === "notas" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`t-${key}`} className="text-xs">
                  {FORM_LABELS[key]}
                </Label>
                {key === "notas" || key === "descripcion" ? (
                  <Textarea
                    id={`t-${key}`}
                    value={form[key] ?? ""}
                    onChange={(e) => updateForm(key, e.target.value)}
                    rows={key === "notas" ? 4 : 3}
                    className="mt-1 text-sm"
                  />
                ) : key === "fecha_ultima_fab" ? (
                  <Input
                    id={`t-${key}`}
                    type="date"
                    value={form[key] ?? ""}
                    onChange={(e) => updateForm(key, e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    id={`t-${key}`}
                    value={form[key] ?? ""}
                    onChange={(e) => updateForm(key, e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-3 bg-white sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={saving || !formEditingId}
              onClick={() => void handleDeleteTroquel()}
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
                {formEditingId ? "Guardar cambios" : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfModalOpen} onOpenChange={closePdfModal}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,900px)] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 pr-14">
            <DialogTitle className="text-left text-[#002147]">
              {pdfAssetKind === "illustrator"
                ? "Archivo troquel"
                : "PDF troquel"}{" "}
              {pdfModalNum ? `· ${pdfModalNum}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-100 px-3 py-3 sm:px-4">
            <Alert className="border-slate-200 bg-white/95 text-slate-800">
              <AlertTitle className="text-sm text-[#002147]">
                Vista previa en el servidor
              </AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                Si los PDFs están solo en una unidad de red local (p. ej.{" "}
                <code className="rounded bg-slate-100 px-1">G:\</code>) y no en el
                mismo equipo que ejecuta la aplicación, aquí puede no mostrarse
                nada. Usa{" "}
                <strong>Localizar en Red</strong> y pega la ruta en el Explorador
                de archivos de Windows, o prueba el enlace{" "}
                <code className="rounded bg-slate-100 px-1">file://</code> (muchas
                empresas lo bloquean por seguridad).
              </AlertDescription>
            </Alert>
            {pdfAssetKind === "illustrator" && !pdfLoading ? (
              <Alert className="border-[#002147]/25 bg-[#C69C2B]/10 text-slate-900">
                <AlertTitle className="text-sm text-[#002147]">
                  Adobe Illustrator (.ai)
                </AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                  Archivo Adobe Illustrator detectado. Si no se previsualiza aquí,
                  utiliza <strong>Localizar en Red</strong> (copia la ruta del
                  .ai encontrada en el servidor) y ábrelo en Illustrator o con
                  Adobe Acrobat.
                </AlertDescription>
              </Alert>
            ) : null}
            {pdfLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-[#002147]/50" />
              </div>
            ) : pdfError ? (
              <div className="space-y-3">
                <Alert className="border-amber-200 bg-amber-50/95">
                  <AlertTitle className="text-sm">No se pudo cargar en el servidor</AlertTitle>
                  <AlertDescription className="text-xs">{pdfError}</AlertDescription>
                </Alert>
                <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                  Es habitual que el PDF no esté en el servidor web sino en tu red
                  local. Copia el <strong>patrón de búsqueda</strong> o la ruta
                  anidada, ábrela desde el Explorador (Win+E → pegar en la barra de
                  direcciones) y abre el PDF desde ahí.
                </p>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                ref={pdfIframeRef}
                title={`PDF ${pdfModalNum ?? ""}`}
                src={pdfBlobUrl}
                className="h-[min(65vh,680px)] w-full rounded border border-slate-200 bg-white"
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-[#002147]/25"
                  disabled={!pdfPlanaCopyTarget}
                  onClick={() => {
                    if (pdfPlanaCopyTarget) void copyToClipboard(pdfPlanaCopyTarget);
                    else toast.info("Configura primero la carpeta de PDFs abajo.");
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  Copiar ruta (plana)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 border-[#002147]/20"
                  disabled={!pdfLocalizarCopyTarget}
                  onClick={() =>
                    pdfLocalizarCopyTarget
                      ? void copyToClipboard(pdfLocalizarCopyTarget)
                      : undefined
                  }
                >
                  <FolderSearch className="size-4" aria-hidden />
                  Localizar en Red
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closePdfModal(false)}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#C69C2B]/90"
                  disabled={!pdfBlobUrl || pdfAssetKind === "illustrator"}
                  onClick={() => printPdfInModal()}
                >
                  <Printer className="size-4" aria-hidden />
                  Imprimir
                </Button>
              </div>
            </div>
            {pdfAssetKind === "illustrator" && aiNestedLocalUrl ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                Enlace local .ai (experimental):{" "}
                <a
                  href={aiNestedLocalUrl}
                  className="break-all font-mono text-[#002147] underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {aiNestedLocalUrl}
                </a>
              </p>
            ) : pdfNestedLocalUrl ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                Enlace local (experimental):{" "}
                <a
                  href={pdfNestedLocalUrl}
                  className="break-all font-mono text-[#002147] underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pdfNestedLocalUrl}
                </a>
              </p>
            ) : null}
            {pdfModalNum && configPathDraft.trim() ? (
              <div className="space-y-1 border-t border-slate-100 pt-2 font-mono text-[10px] text-muted-foreground break-all">
                {pdfResolvedPath ? (
                  <p>
                    <span className="text-slate-500">Archivo resuelto (servidor):</span>{" "}
                    {pdfResolvedPath}
                  </p>
                ) : null}
                {pdfLocalizarHint && !pdfResolvedPath ? (
                  <p>
                    <span className="text-slate-500">Carpeta sugerida (Nivel 2):</span>{" "}
                    {pdfLocalizarHint}
                  </p>
                ) : null}
                <p>
                  <span className="text-slate-500">Plana (referencia):</span>{" "}
                  {pdfAssetKind === "illustrator"
                    ? troquelAiFullPath(configPathDraft, pdfModalNum)
                    : troquelPdfFullPath(configPathDraft, pdfModalNum)}
                </p>
                <p>
                  <span className="text-slate-500">Anidada (referencia):</span>{" "}
                  {pdfAssetKind === "illustrator"
                    ? troquelAiNestedPath(configPathDraft, pdfModalNum)
                    : troquelPdfNestedPath(configPathDraft, pdfModalNum)}
                </p>
                {pdfFuzzyPattern ? (
                  <p>
                    <span className="text-slate-500">Patrón PDF (comodín):</span>{" "}
                    {pdfFuzzyPattern}
                  </p>
                ) : null}
                {pdfAiFuzzyPattern ? (
                  <p>
                    <span className="text-slate-500">Patrón .ai (comodín):</span>{" "}
                    {pdfAiFuzzyPattern}
                  </p>
                ) : null}
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cauchoModalOpen} onOpenChange={closeCauchoModal}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,920px)] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 pr-14">
            <DialogTitle className="text-left text-[#002147]">
              Visor de cauchos{cauchoModalNum ? ` · ${cauchoModalNum}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-3 py-3 sm:px-4">
            {cauchoListLoading ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-[#002147]/50" />
              </div>
            ) : cauchoError && cauchoFiles.length === 0 && cauchoListNotFound ? (
              <div
                className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-10 text-center"
                role="alert"
              >
                <AlertTriangle
                  className="size-14 shrink-0 text-amber-500"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <p className="max-w-lg text-sm leading-relaxed text-slate-700">
                  {cauchoError}
                </p>
                {cauchoErrorAttemptedPath ? (
                  <p className="max-w-xl font-mono text-[10px] leading-snug text-slate-400 break-all">
                    Ruta intentada en el servidor: {cauchoErrorAttemptedPath}
                  </p>
                ) : null}
              </div>
            ) : cauchoError && cauchoFiles.length === 0 ? (
              <Alert className="border-amber-200 bg-amber-50/95">
                <AlertTitle className="text-sm">No se pudo cargar la lista</AlertTitle>
                <AlertDescription className="text-xs">
                  {cauchoError}
                  {cauchoErrorAttemptedPath ? (
                    <span className="mt-2 block font-mono text-[10px] leading-snug text-slate-400 break-all">
                      Ruta intentada en el servidor: {cauchoErrorAttemptedPath}
                    </span>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid min-h-[min(62vh,680px)] gap-3 md:grid-cols-[minmax(0,15rem)_1fr]">
                <div className="flex max-h-[min(62vh,680px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <p className="shrink-0 border-b border-slate-100 px-2 py-1.5 text-[11px] font-semibold text-[#002147]">
                    Archivos ({cauchoFiles.length})
                  </p>
                  <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
                    {cauchoFiles.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() =>
                            cauchoModalNum
                              ? void loadCauchoPreview(cauchoModalNum, name)
                              : undefined
                          }
                          className={cn(
                            "w-full rounded px-2 py-1.5 text-left font-mono text-[11px] break-all transition-colors",
                            cauchoSelected === name
                              ? "bg-[#002147]/12 text-[#002147]"
                              : "hover:bg-slate-50"
                          )}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {cauchoFiles.length === 0 ? (
                    <p className="shrink-0 border-t border-slate-100 px-2 py-2 text-xs text-muted-foreground">
                      Ningún archivo coincide con{" "}
                      <code className="rounded bg-slate-100 px-0.5">
                        {cauchoModalNum ?? ""}_*.pdf
                      </code>{" "}
                      o{" "}
                      <code className="rounded bg-slate-100 px-0.5">
                        {cauchoModalNum ?? ""}_*.ai
                      </code>{" "}
                      en la carpeta configurada.
                    </p>
                  ) : null}
                </div>
                <div className="relative flex min-h-[min(58vh,620px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {cauchoPreviewLoading ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85">
                      <Loader2 className="size-9 animate-spin text-[#002147]/50" />
                    </div>
                  ) : null}
                  {cauchoError && cauchoFiles.length > 0 ? (
                    <Alert className="m-3 shrink-0 border-amber-200 bg-amber-50/95">
                      <AlertTitle className="text-sm">Previsualización</AlertTitle>
                      <AlertDescription className="text-xs">
                        {cauchoError}
                        {cauchoErrorAttemptedPath ? (
                          <span className="mt-2 block font-mono text-[10px] leading-snug text-slate-400 break-all">
                            Ruta intentada en el servidor:{" "}
                            {cauchoErrorAttemptedPath}
                          </span>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {cauchoBlobUrl ? (
                    <iframe
                      ref={cauchoIframeRef}
                      title={`Caucho ${cauchoModalNum ?? ""}`}
                      src={cauchoBlobUrl}
                      className="min-h-[min(54vh,580px)] w-full flex-1 border-0 bg-white"
                    />
                  ) : !cauchoPreviewLoading &&
                    cauchoFiles.length > 1 &&
                    !cauchoBlobUrl ? (
                    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Selecciona un archivo en la lista para previsualizarlo.
                    </div>
                  ) : !cauchoPreviewLoading &&
                    cauchoFiles.length === 0 &&
                    !cauchoError ? (
                    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                      Sin archivos para este troquel.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 flex flex-row flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => closeCauchoModal(false)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              className="gap-2 bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#C69C2B]/90"
              disabled={!cauchoBlobUrl}
              onClick={() => printCauchoInModal()}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
