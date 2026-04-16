"use client";

import {
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GlobalModelSelector } from "@/components/layout/header";
import { createMasterOtsColumns } from "@/components/produccion/ots/master-ots-columns";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
import { TroquelPickerField } from "@/components/produccion/ots/troquel-picker-field";
import { estadoDisplayForRow } from "@/components/produccion/ots/master-ots-table-helpers";
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
import { NativeSelect, type Option } from "@/components/ui/select-native";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  OPTIMUS_IMPORT_FILTER_LABELS,
  buildOptimusImportAllowedKeysFromChecks,
  createDefaultOptimusImportEstadoChecks,
  inferEstadoCodFromDesc,
  parseOptimusOtsMasterFile,
} from "@/lib/prod-ots-optimus-import";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { escapeIlikePattern } from "@/lib/troqueles-query";
import { useHubStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/store";
import type { ProdOtsGeneralRow } from "@/types/prod-ots";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const TABLE = "prod_ots_general";
const TABLE_OT_DESPACHADAS = "produccion_ot_despachadas";
/** Seguimiento externo: columna `OT` e `id_pedido` (equivalente a `num_pedido` / OT). */
const SEGUIMIENTO_EXTERNOS = "prod_seguimiento_externos";

type DespachoSeleccion = { id: string; num_pedido: string };

type DespachoFormState = {
  tintas: string;
  material: string;
  tamano_hoja: string;
  gramaje: string;
  num_hojas_brutas: string;
  num_hojas_netas: string;
  horas_entrada: string;
  horas_tiraje: string;
  troquel: string;
  poses: string;
  acabado_pral: string;
  notas: string;
};

function emptyDespachoForm(): DespachoFormState {
  return {
    tintas: "",
    material: "",
    tamano_hoja: "",
    gramaje: "",
    num_hojas_brutas: "",
    num_hojas_netas: "",
    horas_entrada: "",
    horas_tiraje: "",
    troquel: "",
    poses: "",
    acabado_pral: "",
    notas: "",
  };
}

function parseOptionalIntInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Valores numéricos obligatorios para columnas `numeric` en despacho (evita 400 por tipo). */
function numberOrZeroForDespacho(s: string): number {
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** `integer` en BD: hojas, poses. */
function integerOrZeroForDespacho(s: string): number {
  return Math.trunc(numberOrZeroForDespacho(s));
}

const ESTADO_PRESETS_LIST: readonly string[] = [
  "Terminado",
  "Lanzado",
  "En producción",
  "No empezado",
  "En cola",
  "En curso",
  "Cancelado",
  "Suspendido",
  "Retrasado",
  "Abierto",
];

function sanitizeSearchInput(s: string): string {
  return s.replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

function otsSearchOrFilter(term: string): string | null {
  const t = sanitizeSearchInput(term);
  if (!t) return null;
  const p = `%${escapeIlikePattern(t)}%`;
  return ["num_pedido", "cliente", "titulo", "pedido_cliente"]
    .map((col) => `${col}.ilike.${p}`)
    .join(",");
}

function parseNumPedidoId(numPedido: string): number | null {
  const digits = String(numPedido ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emptySelectOption(label: string): Option[] {
  return [{ value: "", label }];
}

async function collectDistinctTriples(
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<{
  estados: string[];
  vendedores: string[];
  familias: string[];
}> {
  const estados = new Set<string>();
  const vendedores = new Set<string>();
  const familias = new Set<string>();
  const batch = 1000;
  let from = 0;
  for (let guard = 0; guard < 100; guard++) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("estado_desc,vendedor,familia")
      .range(from, from + batch - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const e = String(r.estado_desc ?? "").trim();
      const v = String(r.vendedor ?? "").trim();
      const f = String(r.familia ?? "").trim();
      if (e) estados.add(e);
      if (v) vendedores.add(v);
      if (f) familias.add(f);
    }
    if (data.length < batch) break;
    from += batch;
  }
  const sortEs = (a: string, b: string) => a.localeCompare(b, "es");
  return {
    estados: [...estados].sort(sortEs),
    vendedores: [...vendedores].sort(sortEs),
    familias: [...familias].sort(sortEs),
  };
}

export function MasterOtsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();
  const globalModel = useHubStore((s) => s.globalModel);
  const fileRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ProdOtsGeneralRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState("");
  const [familiaFilter, setFamiliaFilter] = useState("");
  const [despachadoFilter, setDespachadoFilter] = useState<
    "todos" | "si" | "no"
  >("todos");

  const [estadoOptions, setEstadoOptions] = useState<string[]>([]);
  const [vendedorOptions, setVendedorOptions] = useState<string[]>([]);
  const [familiaOptions, setFamiliaOptions] = useState<string[]>([]);

  const [externoOtSet, setExternoOtSet] = useState<Set<string>>(new Set());
  const [externoIdSet, setExternoIdSet] = useState<Set<number>>(new Set());
  /** `num_pedido` / OT que ya tienen fila en `produccion_ot_despachadas` (página actual). */
  const [despachoRegistradoOtSet, setDespachoRegistradoOtSet] = useState<
    Set<string>
  >(() => new Set());

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProdOtsGeneralRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [optimusImportOpen, setOptimusImportOpen] = useState(false);
  const [optimusImportEstadoChecks, setOptimusImportEstadoChecks] = useState(
    () => createDefaultOptimusImportEstadoChecks()
  );

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const despachoSeleccionCacheRef = useRef<DespachoSeleccion | null>(null);
  const [despachoOpen, setDespachoOpen] = useState(false);
  const [despachoForm, setDespachoForm] = useState<DespachoFormState>(() =>
    emptyDespachoForm()
  );
  const [despachoSaving, setDespachoSaving] = useState(false);

  const estadoEditSelectOptions = useMemo((): Option[] => {
    const merged = new Set<string>([...ESTADO_PRESETS_LIST, ...estadoOptions]);
    const cur = editing?.estado_desc?.trim() ?? "";
    if (cur) merged.add(cur);
    const sorted = [...merged]
      .filter((x) => x.length > 0)
      .sort((a, b) => a.localeCompare(b, "es"));
    return [
      { value: "", label: "— (sin estado) —" },
      ...sorted.map((v) => ({ value: v, label: v })),
    ];
  }, [estadoOptions, editing?.estado_desc]);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      400
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
    setRowSelection({});
  }, [debouncedSearch, estadoFilter, vendedorFilter, familiaFilter, despachadoFilter]);

  const applyFilters = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => {
      let query = q;
      const orF = otsSearchOrFilter(debouncedSearch);
      if (orF) query = query.or(orF);
      if (estadoFilter) query = query.eq("estado_desc", estadoFilter);
      if (vendedorFilter) query = query.eq("vendedor", vendedorFilter);
      if (familiaFilter) query = query.eq("familia", familiaFilter);
      if (despachadoFilter === "si") {
        query = query.eq("despachado", true);
      } else if (despachadoFilter === "no") {
        query = query.or("despachado.is.null,despachado.eq.false");
      }
      return query;
    },
    [debouncedSearch, estadoFilter, vendedorFilter, familiaFilter, despachadoFilter]
  );

  const loadFilterOptions = useCallback(async () => {
    try {
      const { estados, vendedores, familias } = await collectDistinctTriples(
        supabase
      );
      setEstadoOptions(estados);
      setVendedorOptions(vendedores);
      setFamiliaOptions(familias);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar las listas de filtros.");
    }
  }, [supabase]);

  const loadExternosForRows = useCallback(
    async (list: ProdOtsGeneralRow[]) => {
      const otStrings = new Set<string>();
      const idNums = new Set<number>();
      for (const r of list) {
        const s = String(r.num_pedido ?? "").trim();
        if (s) otStrings.add(s);
        const id = parseNumPedidoId(s);
        if (id != null) idNums.add(id);
      }
      const otArr = [...otStrings];
      const idArr = [...idNums];
      const nextOt = new Set<string>();
      const nextId = new Set<number>();
      try {
        if (otArr.length > 0) {
          const { data, error } = await supabase
            .from(SEGUIMIENTO_EXTERNOS)
            .select("OT")
            .in("OT", otArr);
          if (error) throw error;
          for (const x of data ?? []) {
            const o = String((x as { OT?: string }).OT ?? "").trim();
            if (o) nextOt.add(o);
          }
        }
        if (idArr.length > 0) {
          const { data, error } = await supabase
            .from(SEGUIMIENTO_EXTERNOS)
            .select("id_pedido")
            .in("id_pedido", idArr);
          if (error) throw error;
          for (const x of data ?? []) {
            const id = (x as { id_pedido?: number }).id_pedido;
            if (typeof id === "number" && Number.isFinite(id)) nextId.add(id);
          }
        }
        setExternoOtSet(nextOt);
        setExternoIdSet(nextId);
      } catch (e) {
        console.error(e);
        setExternoOtSet(new Set());
        setExternoIdSet(new Set());
      }
    },
    [supabase]
  );

  const loadDespachadasForRows = useCallback(
    async (list: ProdOtsGeneralRow[]) => {
      const inValues: (string | number)[] = [];
      const seen = new Set<string>();
      const push = (v: string | number) => {
        const key = typeof v === "number" ? `n:${v}` : `s:${v}`;
        if (seen.has(key)) return;
        seen.add(key);
        inValues.push(v);
      };
      for (const r of list) {
        const s = String(r.num_pedido ?? "").trim();
        if (!s) continue;
        push(s);
        if (/^\d+$/.test(s)) {
          const n = Number(s);
          if (Number.isFinite(n)) push(n);
        }
      }
      if (inValues.length === 0) {
        setDespachoRegistradoOtSet(new Set());
        return;
      }
      try {
        const { data, error } = await supabase
          .from(TABLE_OT_DESPACHADAS)
          .select("ot_numero")
          .in("ot_numero", inValues);
        if (error) throw error;
        const next = new Set<string>();
        for (const x of data ?? []) {
          const o = String(
            (x as { ot_numero?: string | number }).ot_numero ?? ""
          ).trim();
          if (o) next.add(o);
        }
        setDespachoRegistradoOtSet(next);
      } catch (e) {
        console.error(e);
        setDespachoRegistradoOtSet(new Set());
      }
    },
    [supabase]
  );

  const loadPage = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      try {
        let countQ = supabase
          .from(TABLE)
          .select("*", { count: "exact", head: true });
        countQ = applyFilters(countQ);
        const { count, error: cErr } = await countQ;
        if (cErr) throw cErr;
        setTotal(count ?? 0);

        let dataQ = supabase.from(TABLE).select("*");
        dataQ = applyFilters(dataQ);
        const { data, error } = await dataQ
          .order("num_pedido", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .range(from, to);
        if (error) throw error;
        const list = (data ?? []) as ProdOtsGeneralRow[];
        setRows(list);
        void loadExternosForRows(list);
        void loadDespachadasForRows(list);
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : "Error al cargar las OTs."
        );
        setRows([]);
        setTotal(0);
        setDespachoRegistradoOtSet(new Set());
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [supabase, page, applyFilters, loadExternosForRows, loadDespachadasForRows]
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  const totalPages =
    total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const pageDisplay = page + 1;

  const estadoSelectOptions = useMemo(
    () => [...emptySelectOption("Todos los estados"), ...estadoOptions.map((e) => ({ value: e, label: e }))],
    [estadoOptions]
  );
  const vendedorSelectOptions = useMemo(
    () => [
      ...emptySelectOption("Todos los vendedores"),
      ...vendedorOptions.map((e) => ({ value: e, label: e })),
    ],
    [vendedorOptions]
  );
  const familiaSelectOptions = useMemo(
    () => [
      ...emptySelectOption("Todas las familias"),
      ...familiaOptions.map((e) => ({ value: e, label: e })),
    ],
    [familiaOptions]
  );

  const rowHasExterno = useCallback(
    (r: ProdOtsGeneralRow): boolean => {
      const s = String(r.num_pedido ?? "").trim();
      if (s && externoOtSet.has(s)) return true;
      const id = parseNumPedidoId(s);
      return id != null && externoIdSet.has(id);
    },
    [externoOtSet, externoIdSet]
  );

  const openEdit = useCallback((r: ProdOtsGeneralRow) => {
    setEditing({ ...r });
    setEditOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      createMasterOtsColumns({
        rowHasExterno,
        openEdit,
        umbralesOtsCompras,
      }),
    [rowHasExterno, openEdit, umbralesOtsCompras]
  );

  const despachoSeleccion = useMemo(() => {
    const id = Object.keys(rowSelection).find((k) => rowSelection[k]);
    if (!id) {
      despachoSeleccionCacheRef.current = null;
      return null;
    }
    const r = rows.find((x) => x.id === id);
    if (r) {
      const sel: DespachoSeleccion = {
        id: r.id,
        num_pedido: String(r.num_pedido ?? "").trim(),
      };
      despachoSeleccionCacheRef.current = sel;
      return sel;
    }
    return despachoSeleccionCacheRef.current;
  }, [rowSelection, rows]);

  /** No volver a despachar si ya existe fila en `produccion_ot_despachadas` o el maestro marca despachado. */
  const despachoYaProcesado = useMemo(() => {
    if (!despachoSeleccion) return false;
    const ot = despachoSeleccion.num_pedido.trim();
    if (!ot) return false;
    const row = rows.find((x) => x.id === despachoSeleccion.id);
    if (row?.despachado === true) return true;
    return despachoRegistradoOtSet.has(ot);
  }, [despachoSeleccion, rows, despachoRegistradoOtSet]);

  const despachadoColumnFilters = useMemo<ColumnFiltersState>(
    () =>
      despachadoFilter === "todos"
        ? []
        : [{ id: "despachado", value: despachadoFilter }],
    [despachadoFilter]
  );

  const onDespachadoColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
    updater
  ) => {
    const next =
      typeof updater === "function"
        ? updater(despachadoColumnFilters)
        : updater;
    const col = next.find((c) => c.id === "despachado");
    if (!col) {
      setDespachadoFilter("todos");
      return;
    }
    const v = col.value;
    if (v === "si" || v === "no" || v === "todos") {
      setDespachadoFilter(v);
    }
  };

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: {
      rowSelection,
      columnFilters: despachadoColumnFilters,
    },
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: onDespachadoColumnFiltersChange,
    manualFiltering: true,
    manualSorting: true,
    initialState: {
      sorting: [{ id: "num_pedido", desc: true }],
    },
    enableMultiRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
  });

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        cliente: editing.cliente,
        titulo: editing.titulo,
        estado_desc: editing.estado_desc,
        estado_cod:
          editing.estado_cod ?? inferEstadoCodFromDesc(editing.estado_desc ?? ""),
        cantidad: editing.cantidad,
        familia: editing.familia,
        pedido_cliente: editing.pedido_cliente,
        prueba_color: editing.prueba_color,
        pdf_ok: editing.pdf_ok,
        muestra_ok: editing.muestra_ok,
        fecha_apertura: editing.fecha_apertura,
        fecha_entrega: editing.fecha_entrega,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("OT actualizada.");
      setEditOpen(false);
      setEditing(null);
      void loadPage();
      void loadFilterOptions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function submitDespacho() {
    if (!despachoSeleccion) return;
    setDespachoSaving(true);
    const selectedRowId = despachoSeleccion.id;
    const selectedOt = despachoSeleccion.num_pedido.trim();
    try {
      if (!selectedOt) throw new Error("OT inválida.");

      const dataToInsert = {
        ot_numero: selectedOt,
        tintas: despachoForm.tintas.trim() || null,
        material: despachoForm.material.trim() || null,
        tamano_hoja: despachoForm.tamano_hoja.trim() || null,
        gramaje: parseOptionalDecimalInput(despachoForm.gramaje),
        num_hojas_brutas: integerOrZeroForDespacho(despachoForm.num_hojas_brutas),
        num_hojas_netas: integerOrZeroForDespacho(despachoForm.num_hojas_netas),
        horas_entrada: numberOrZeroForDespacho(despachoForm.horas_entrada),
        horas_tiraje: numberOrZeroForDespacho(despachoForm.horas_tiraje),
        troquel: despachoForm.troquel.trim() || null,
        poses: integerOrZeroForDespacho(despachoForm.poses),
        acabado_pral: despachoForm.acabado_pral.trim() || null,
        notas: despachoForm.notas.trim() || null,
        despachado_at: new Date().toISOString(),
      };

      const { error: errDespacho } = await supabase
        .from(TABLE_OT_DESPACHADAS)
        .upsert(dataToInsert, { onConflict: "ot_numero" });
      if (errDespacho) throw errDespacho;

      const { error: errMaster } = await supabase
        .from(TABLE)
        .update({
          despachado: true,
          updated_at: new Date().toISOString(),
        })
        .eq("num_pedido", selectedOt);
      if (errMaster) throw errMaster;

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedRowId ||
          String(r.num_pedido ?? "").trim() === selectedOt
            ? { ...r, despachado: true }
            : r
        )
      );

      toast.success("OT Despachada correctamente");

      setDespachoForm(emptyDespachoForm());
      setDespachoOpen(false);
      setRowSelection({});
      despachoSeleccionCacheRef.current = null;

      await loadPage({ silent: true });
      await loadFilterOptions();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al despachar.");
    } finally {
      setDespachoSaving(false);
    }
  }

  async function onImportFile(f: File) {
    setImporting(true);
    try {
      const allowed = buildOptimusImportAllowedKeysFromChecks(
        optimusImportEstadoChecks
      );
      const { rows, warnings, omitidasPorFiltroEstado } =
        await parseOptimusOtsMasterFile(f, {
          allowedEstadoNormalizedKeys: allowed,
        });
      if (warnings.length > 0) {
        warnings.slice(0, 5).forEach((w) => toast.message(w));
      }
      if (!rows.length) {
        toast.error(
          omitidasPorFiltroEstado > 0
            ? `No se importó ninguna OT (${omitidasPorFiltroEstado} omitidas por filtro de estado).`
            : "No se importó ninguna fila válida."
        );
        setOptimusImportOpen(false);
        return;
      }
      const chunk = 120;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.from(TABLE).upsert(slice, {
          onConflict: "num_pedido",
        });
        if (error) throw error;
      }
      toast.success(
        omitidasPorFiltroEstado > 0
          ? `Importadas ${rows.length} OTs. ${omitidasPorFiltroEstado} omitidas por filtro de estado.`
          : `Importadas ${rows.length} OTs.`
      );
      setOptimusImportOpen(false);
      setPage(0);
      void loadPage();
      void loadFilterOptions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en importación.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const otsContextJson = useMemo(() => {
    return JSON.stringify(
      rows.map((r) => ({
        num_pedido: r.num_pedido,
        estado: estadoDisplayForRow(r),
        estado_cod: r.estado_cod,
        cliente: r.cliente,
        titulo: r.titulo,
        familia: r.familia,
        cantidad: r.cantidad,
        valor_potencial: r.valor_potencial,
        vendedor: r.vendedor,
        prioridad: r.prioridad,
        fecha_apertura: r.fecha_apertura,
        fecha_entrega: r.fecha_entrega,
      })),
      null,
      2
    );
  }, [rows]);

  const originalReport = useMemo(() => {
    return `## Listado maestro de OTs (página actual, ${rows.length} de ${total ?? "?"} registros visibles)

Los siguientes datos son la página actual de la tabla (no es el universo completo de la base de datos). Úsalos para responder y advierte si la pregunta requiere datos fuera de esta página.

\`\`\`json
${otsContextJson}
\`\`\``;
  }, [rows, total, otsContextJson]);

  async function sendAi() {
    const q = aiInput.trim();
    if (!q) return;
    setAiInput("");
    const nextHist: ChatMessage[] = [...aiMessages, { role: "user", content: q }];
    setAiMessages(nextHist);
    setAiLoading(true);
    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          originalReport,
          question: q,
          history: aiMessages,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(body.error ?? res.statusText));
      }
      const text = String(body.text ?? "").trim();
      if (!text) throw new Error("Respuesta vacía.");
      setAiMessages((h) => [...h, { role: "model", content: text }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de IA.");
      setAiMessages((h) => h.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
        }}
      />

      <Dialog open={optimusImportOpen} onOpenChange={setOptimusImportOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100">
            <DialogTitle>Filtro de Importación</DialogTitle>
            <DialogDescription>
              Selecciona qué estados de Optimus deseas importar a Minerva.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-6 py-4">
            {OPTIMUS_IMPORT_FILTER_LABELS.map((label, idx) => {
              const id = `optimus-import-estado-${idx}`;
              return (
                <div key={label} className="flex items-center gap-3">
                  <Checkbox
                    id={id}
                    checked={Boolean(optimusImportEstadoChecks[label])}
                    onCheckedChange={(checked) => {
                      setOptimusImportEstadoChecks((prev) => ({
                        ...prev,
                        [label]: Boolean(checked),
                      }));
                    }}
                  />
                  <Label
                    htmlFor={id}
                    className="cursor-pointer text-sm font-normal leading-snug text-slate-800"
                  >
                    {label}
                  </Label>
                </div>
              );
            })}
          </div>
          <DialogFooter className="border-t border-slate-100 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOptimusImportOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              Seleccionar Archivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={despachoOpen} onOpenChange={setDespachoOpen}>
        <DialogContent className="flex max-h-[min(92vh,720px)] max-w-[min(96vw,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
            <DialogTitle className="text-base">
              Despachar OT{" "}
              <span className="font-mono text-sm font-semibold text-[#002147]">
                {despachoSeleccion?.num_pedido ?? ""}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Completa los datos de despacho. Se guardarán en producción y se
              marcará la OT como despachada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[min(60vh,480px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
            <div className="grid gap-1">
              <Label htmlFor="despacho-tintas" className="text-xs">
                Tintas
              </Label>
              <Input
                id="despacho-tintas"
                className="h-8 text-xs"
                value={despachoForm.tintas}
                onChange={(e) =>
                  setDespachoForm((f) => ({ ...f, tintas: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-material" className="text-xs">
                Material
              </Label>
              <Input
                id="despacho-material"
                className="h-8 text-xs"
                value={despachoForm.material}
                onChange={(e) =>
                  setDespachoForm((f) => ({ ...f, material: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-tamano" className="text-xs">
                Tamaño hoja
              </Label>
              <Input
                id="despacho-tamano"
                className="h-8 text-xs"
                value={despachoForm.tamano_hoja}
                onChange={(e) =>
                  setDespachoForm((f) => ({
                    ...f,
                    tamano_hoja: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-gramaje" className="text-xs">
                Gramaje
              </Label>
              <Input
                id="despacho-gramaje"
                className="h-8 text-xs"
                type="number"
                value={despachoForm.gramaje}
                onChange={(e) =>
                  setDespachoForm((f) => ({ ...f, gramaje: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-brutas" className="text-xs">
                Hojas brutas
              </Label>
              <Input
                id="despacho-brutas"
                className="h-8 text-xs"
                type="number"
                inputMode="numeric"
                value={despachoForm.num_hojas_brutas}
                onChange={(e) =>
                  setDespachoForm((f) => ({
                    ...f,
                    num_hojas_brutas: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-netas" className="text-xs">
                Hojas netas
              </Label>
              <Input
                id="despacho-netas"
                className="h-8 text-xs"
                type="number"
                inputMode="numeric"
                value={despachoForm.num_hojas_netas}
                onChange={(e) =>
                  setDespachoForm((f) => ({
                    ...f,
                    num_hojas_netas: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-horas-entrada" className="text-xs">
                Horas entrada estimadas
              </Label>
              <Input
                id="despacho-horas-entrada"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={despachoForm.horas_entrada}
                onChange={(e) =>
                  setDespachoForm((f) => ({
                    ...f,
                    horas_entrada: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-horas-tiraje" className="text-xs">
                Horas tiraje estimadas
              </Label>
              <Input
                id="despacho-horas-tiraje"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={despachoForm.horas_tiraje}
                onChange={(e) =>
                  setDespachoForm((f) => ({
                    ...f,
                    horas_tiraje: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <TroquelPickerField
                id="despacho-troquel"
                value={despachoForm.troquel}
                onChange={(v) =>
                  setDespachoForm((f) => ({ ...f, troquel: v }))
                }
                onTroquelPicked={(picked) =>
                  setDespachoForm((f) => ({
                    ...f,
                    troquel: picked.num_troquel,
                    poses: picked.num_figuras?.trim()
                      ? picked.num_figuras.trim()
                      : f.poses,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-poses" className="text-xs">
                Poses
              </Label>
              <Input
                id="despacho-poses"
                className="h-8 text-xs"
                value={despachoForm.poses}
                onChange={(e) =>
                  setDespachoForm((f) => ({ ...f, poses: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="despacho-acabado" className="text-xs">
                Acabado PRAL
              </Label>
              <Input
                id="despacho-acabado"
                className="h-8 text-xs"
                value={despachoForm.acabado_pral}
                onChange={(e) =>
                  setDespachoForm((f) => ({
                    ...f,
                    acabado_pral: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="despacho-notas" className="text-xs">
                Notas
              </Label>
              <Textarea
                id="despacho-notas"
                className="min-h-[72px] resize-y text-xs"
                rows={3}
                value={despachoForm.notas}
                onChange={(e) =>
                  setDespachoForm((f) => ({ ...f, notas: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:px-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={despachoSaving}
              onClick={() => setDespachoOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={despachoSaving || !despachoSeleccion}
              className="gap-2 bg-[#002147] text-white hover:bg-[#001a38]"
              onClick={() => void submitDespacho()}
            >
              {despachoSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Guardar despacho"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold text-[#002147] sm:text-2xl">
            Listado maestro de OTs
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
            Paginación en servidor (50 filas). Importación Optimus por{" "}
            <code className="rounded bg-slate-100 px-1">num_pedido</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GlobalModelSelector layout="stack" className="text-xs" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="size-4 text-amber-600" aria-hidden />
            Preguntar a la IA
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={importing}
            onClick={() => setOptimusImportOpen(true)}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Importar Optimus
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={!despachoSeleccion || despachoYaProcesado}
            title={
              despachoYaProcesado && despachoSeleccion
                ? "Esta OT ya tiene despacho registrado (producción)."
                : !despachoSeleccion
                  ? "Selecciona una OT en la tabla"
                  : undefined
            }
            onClick={() => {
              if (despachoYaProcesado) return;
              setDespachoForm(emptyDespachoForm());
              setDespachoOpen(true);
            }}
          >
            <ClipboardCheck className="size-4 text-emerald-700" aria-hidden />
            {despachoYaProcesado ? "Ya despachada" : "Despachar OT"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200/90 bg-white/80 p-3 shadow-sm backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-12">
        <div className="grid min-w-0 gap-1 sm:col-span-2 lg:col-span-6">
          <Label className="text-xs font-medium">Buscar</Label>
          <Input
            placeholder="Nº pedido, cliente o título…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="grid min-w-0 gap-1 lg:col-span-2">
          <NativeSelect
            label="Estado"
            className="h-8 min-w-0 text-xs"
            options={estadoSelectOptions}
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          />
        </div>
        <div className="grid min-w-0 gap-1 lg:col-span-1">
          <NativeSelect
            label="Vendedor"
            className="h-8 w-full min-w-0 max-w-[10rem] text-xs [&_select]:min-w-0"
            options={vendedorSelectOptions}
            value={vendedorFilter}
            onChange={(e) => setVendedorFilter(e.target.value)}
          />
        </div>
        <div className="grid min-w-0 gap-1 lg:col-span-1">
          <NativeSelect
            label="Familia (análisis ventas)"
            className="h-8 w-full min-w-0 max-w-[10rem] text-xs [&_select]:min-w-0"
            options={familiaSelectOptions}
            value={familiaFilter}
            onChange={(e) => setFamiliaFilter(e.target.value)}
          />
        </div>
        <div className="grid min-w-0 gap-1 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="filtro-despachado" className="text-xs font-medium">
            Despachado
          </Label>
          <Select
            value={despachadoFilter}
            onValueChange={(v) => {
              if (v === "todos" || v === "si" || v === "no") {
                setDespachadoFilter(v);
              }
            }}
          >
            <SelectTrigger
              id="filtro-despachado"
              size="sm"
              className="h-8 w-full min-w-0 border-input bg-background text-xs shadow-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-[var(--anchor-width)]">
              <SelectItem value="todos" className="text-xs">
                Todos
              </SelectItem>
              <SelectItem value="si" className="text-xs">
                Sí
              </SelectItem>
              <SelectItem value="no" className="text-xs">
                No
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <Table className="table-fixed min-w-[1360px] text-xs">
            <TableHeader className="bg-slate-50/95 sticky top-0 z-20 shadow-[0_1px_0_0_rgb(226_232_240)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 z-20 bg-slate-50/95 px-0.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-10 text-center"
                  >
                    <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    Sin resultados.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-slate-50/80"
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-0 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground tabular-nums">
            {total != null ? (
              <>
                <span className="font-medium text-slate-800">{total}</span>{" "}
                registros · Página{" "}
                <span className="font-medium text-slate-800">
                  {pageDisplay}
                </span>{" "}
                de {totalPages}
              </>
            ) : (
              "…"
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2"
              disabled={loading || page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2"
              disabled={
                loading ||
                total == null ||
                (page + 1) * PAGE_SIZE >= total
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,880px)] max-w-[min(96vw,720px)] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 px-4 py-3 sm:px-5">
            <DialogTitle className="text-base">
              Editar OT{" "}
              <span className="font-mono text-sm font-normal text-slate-600">
                {editing?.num_pedido}
              </span>
            </DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <div className="grid max-h-[60vh] gap-3 overflow-y-auto px-4 pb-3 sm:grid-cols-2 sm:px-5">
                <div className="grid gap-1 sm:col-span-2">
                  <Label className="text-xs">Cliente</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.cliente ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, cliente: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label className="text-xs">Pedido cliente</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.pedido_cliente ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        pedido_cliente: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label className="text-xs">Título (trabajo)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.titulo ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, titulo: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <NativeSelect
                    label="Estado"
                    className="h-8 text-xs [&_select]:h-8 [&_select]:min-h-8 [&_select]:py-1 [&_select]:text-xs"
                    options={estadoEditSelectOptions}
                    value={editing.estado_desc?.trim() ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditing({
                        ...editing,
                        estado_desc: v,
                        estado_cod: inferEstadoCodFromDesc(v),
                      });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Estado (código, opcional)</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    value={editing.estado_cod ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditing({
                        ...editing,
                        estado_cod: v === "" ? null : Number(v),
                      });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    value={editing.cantidad ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditing({
                        ...editing,
                        cantidad: v === "" ? null : Number(v),
                      });
                    }}
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label className="text-xs">Familia (análisis ventas)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.familia ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, familia: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Prueba color</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.prueba_color ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, prueba_color: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">PDF para ok</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.pdf_ok ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, pdf_ok: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Muestra para OK</Label>
                  <Input
                    className="h-8 text-xs"
                    value={editing.muestra_ok ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, muestra_ok: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Fecha apertura</Label>
                  <Input
                    className="h-8 text-xs"
                    type="datetime-local"
                    value={
                      editing.fecha_apertura
                        ? editing.fecha_apertura.slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        fecha_apertura: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Fecha entrega</Label>
                  <Input
                    className="h-8 text-xs"
                    type="datetime-local"
                    value={
                      editing.fecha_entrega
                        ? editing.fecha_entrega.slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        fecha_entrega: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter className="shrink-0 gap-2 px-4 py-3 sm:flex-row sm:px-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-100 px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bot className="size-5 text-[#002147]" aria-hidden />
              Asistente OTs (Gemini)
            </SheetTitle>
            <SheetDescription className="text-xs">
              Contexto: página actual ({rows.length} filas). El modelo global se
              usa desde la barra superior.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {aiMessages.length === 0 ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Ejemplos: «¿Qué trabajos del cliente X vencen esta semana?»,
                «Resume cuántas OTs están en Lanzado en esta página».
              </p>
            ) : (
              aiMessages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                    m.role === "user"
                      ? "ml-4 border-slate-200 bg-slate-50"
                      : "mr-4 border-[#C69C2B]/30 bg-amber-50/40"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {m.role === "user" ? "Tú" : "IA"}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                </div>
              ))
            )}
            {aiLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-4 animate-spin" />
                Generando…
              </div>
            ) : null}
          </div>
          <div className="mt-auto border-t border-slate-100 p-3">
            <Textarea
              placeholder="Escribe tu pregunta…"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              rows={3}
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendAi();
                }
              }}
            />
            <Button
              type="button"
              className="mt-2 w-full gap-2"
              size="sm"
              disabled={aiLoading || !aiInput.trim()}
              onClick={() => void sendAi()}
            >
              <Sparkles className="size-4" aria-hidden />
              Enviar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
