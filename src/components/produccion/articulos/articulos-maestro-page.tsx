"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  aplicarArticulosDiff,
  computeArticulosDiff,
  descargarPlantillaArticulos,
  exportarArticulosAExcel,
  parseArticulosExcelFile,
  type ArticuloDiffResult,
  type ArticuloImportRow,
} from "@/lib/articulos-maestro-import";
import {
  ARTICULO_TIPO_PRODUCTO_OPTIONS,
  type ProdReferenciaRow,
} from "@/types/prod-referencias";

// ─── Form ─────────────────────────────────────────────────────────────────────

type ArticuloForm = {
  codigo: string;
  referencia_cliente: string;
  descripcion: string;
  cliente: string;
  tipo_producto: string;
  subtipo: string;
  activo: boolean;
  formato_largo_mm: string;
  formato_ancho_mm: string;
  formato_fondo_mm: string;
  material_habitual: string;
  poses_habitual: string;
  troquel_habitual: string;
  tintas_habituales: string;
  acabado_habitual: string;
  ruta_habitual: string;
  notas: string;
};

const EMPTY_FORM: ArticuloForm = {
  codigo: "",
  referencia_cliente: "",
  descripcion: "",
  cliente: "",
  tipo_producto: "",
  subtipo: "",
  activo: true,
  formato_largo_mm: "",
  formato_ancho_mm: "",
  formato_fondo_mm: "",
  material_habitual: "",
  poses_habitual: "",
  troquel_habitual: "",
  tintas_habituales: "",
  acabado_habitual: "",
  ruta_habitual: "",
  notas: "",
};

function rowToForm(row: ProdReferenciaRow): ArticuloForm {
  return {
    codigo: row.codigo,
    referencia_cliente: row.referencia_cliente ?? "",
    descripcion: row.descripcion ?? "",
    cliente: row.cliente ?? "",
    tipo_producto: row.tipo_producto ?? "",
    subtipo: row.subtipo ?? "",
    activo: row.activo,
    formato_largo_mm: row.formato_largo_mm != null ? String(row.formato_largo_mm) : "",
    formato_ancho_mm: row.formato_ancho_mm != null ? String(row.formato_ancho_mm) : "",
    formato_fondo_mm: row.formato_fondo_mm != null ? String(row.formato_fondo_mm) : "",
    material_habitual: row.material_habitual ?? "",
    poses_habitual: row.poses_habitual != null ? String(row.poses_habitual) : "",
    troquel_habitual: row.troquel_habitual ?? "",
    tintas_habituales: row.tintas_habituales ?? "",
    acabado_habitual: row.acabado_habitual ?? "",
    ruta_habitual: row.ruta_habitual ?? "",
    notas: row.notas ?? "",
  };
}

function formToPayload(form: ArticuloForm) {
  const parseNum = (v: string) => {
    const n = Number(v.trim().replace(",", "."));
    return v.trim() && Number.isFinite(n) ? n : null;
  };
  return {
    codigo: form.codigo.trim(),
    referencia_cliente: form.referencia_cliente.trim() || null,
    descripcion: form.descripcion.trim() || null,
    cliente: form.cliente.trim() || null,
    tipo_producto: form.tipo_producto.trim() || null,
    subtipo: form.subtipo.trim() || null,
    activo: form.activo,
    formato_largo_mm: parseNum(form.formato_largo_mm),
    formato_ancho_mm: parseNum(form.formato_ancho_mm),
    formato_fondo_mm: parseNum(form.formato_fondo_mm),
    material_habitual: form.material_habitual.trim() || null,
    poses_habitual: parseNum(form.poses_habitual) != null ? Math.round(parseNum(form.poses_habitual)!) : null,
    troquel_habitual: form.troquel_habitual.trim() || null,
    tintas_habituales: form.tintas_habituales.trim() || null,
    acabado_habitual: form.acabado_habitual.trim() || null,
    ruta_habitual: form.ruta_habitual.trim() || null,
    notas: form.notas.trim() || null,
  };
}

// ─── Completeness badge ───────────────────────────────────────────────────────

function completitudBadge(row: ProdReferenciaRow) {
  const hasTecnica =
    row.material_habitual || row.poses_habitual || row.troquel_habitual || row.tintas_habituales;
  const hasIdentidad = row.referencia_cliente || row.descripcion;

  if (!hasIdentidad)
    return (
      <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-400">
        Solo código
      </Badge>
    );
  if (!hasTecnica)
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
        Sin técnica
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
      Completa
    </Badge>
  );
}

// ─── Form dialog ──────────────────────────────────────────────────────────────

function ArticuloFormDialog({
  open,
  title,
  description,
  form,
  saving,
  onFormChange,
  onSave,
  onClose,
  showCodigo = true,
}: {
  open: boolean;
  title: string;
  description?: string;
  form: ArticuloForm;
  saving: boolean;
  onFormChange: (f: ArticuloForm) => void;
  onSave: () => void;
  onClose: () => void;
  showCodigo?: boolean;
}) {
  const set = (k: keyof ArticuloForm, v: string | boolean) =>
    onFormChange({ ...form, [k]: v });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Identidad */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Identidad
          </p>
          <div className="grid grid-cols-2 gap-3">
            {showCodigo && (
              <div className="grid gap-1">
                <Label className="text-xs">
                  Código Minerva <span className="text-red-500">*</span>
                </Label>
                <Input
                  className="h-8 font-mono text-xs"
                  placeholder="M-00001"
                  value={form.codigo}
                  onChange={(e) => set("codigo", e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1">
              <Label className="text-xs">Referencia cliente</Label>
              <Input
                className="h-8 font-mono text-xs"
                placeholder="EU858"
                value={form.referencia_cliente}
                onChange={(e) => set("referencia_cliente", e.target.value)}
              />
            </div>
            <div className={`grid gap-1 ${showCodigo ? "" : "col-span-2"}`}>
              <Label className="text-xs">Descripción</Label>
              <Input
                className="h-8 text-xs"
                placeholder="EST BBP PROBIOMIX 10 CAP"
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cliente</Label>
              <Input
                className="h-8 text-xs"
                placeholder="LABORATORIOS ANUR, S.L"
                value={form.cliente}
                onChange={(e) => set("cliente", e.target.value)}
              />
            </div>
          </div>

          {/* Clasificación */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Clasificación
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Tipo de producto</Label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={form.tipo_producto}
                onChange={(e) => set("tipo_producto", e.target.value)}
              >
                <option value="">— sin tipo —</option>
                {ARTICULO_TIPO_PRODUCTO_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Subtipo</Label>
              <Input
                className="h-8 text-xs"
                placeholder="automontable, con ventana…"
                value={form.subtipo}
                onChange={(e) => set("subtipo", e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="activo-check"
                checked={form.activo}
                onCheckedChange={(v) => set("activo", Boolean(v))}
              />
              <Label htmlFor="activo-check" className="cursor-pointer text-xs">
                Activo
              </Label>
            </div>
          </div>

          {/* Dimensiones */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Dimensiones (mm)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["formato_largo_mm", "Largo"],
                ["formato_ancho_mm", "Ancho"],
                ["formato_fondo_mm", "Fondo"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="grid gap-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min={0}
                  placeholder="—"
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Sugerencias técnicas */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Sugerencias técnicas (pre-rellenan el despacho)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Material habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Zenith 300g"
                value={form.material_habitual}
                onChange={(e) => set("material_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Troquel habitual</Label>
              <Input
                className="h-8 font-mono text-xs"
                placeholder="TAG00205"
                value={form.troquel_habitual}
                onChange={(e) => set("troquel_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Poses habitual</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                placeholder="4"
                value={form.poses_habitual}
                onChange={(e) => set("poses_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Tintas habituales</Label>
              <Input
                className="h-8 text-xs"
                placeholder="4+1"
                value={form.tintas_habituales}
                onChange={(e) => set("tintas_habituales", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Acabado habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Barniz AC brillo"
                value={form.acabado_habitual}
                onChange={(e) => set("acabado_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Ruta habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="impresion+troquelado+engomado"
                value={form.ruta_habitual}
                onChange={(e) => set("ruta_habitual", e.target.value)}
              />
            </div>
          </div>

          {/* Notas */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Notas
          </p>
          <Textarea
            className="min-h-[60px] text-xs"
            placeholder="Observaciones, incidencias históricas…"
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || !form.codigo.trim()}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ArticulosMaestroPage() {
  const supabase = createSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ProdReferenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroActivo, setFiltroActivo] = useState("activos");

  // Modal editar
  const [editingRow, setEditingRow] = useState<ProdReferenciaRow | null>(null);
  const [editForm, setEditForm] = useState<ArticuloForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal crear
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArticuloForm>(EMPTY_FORM);
  const [savingCreate, setSavingCreate] = useState(false);

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDiff, setImportDiff] = useState<ArticuloDiffResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importIncluirModificados, setImportIncluirModificados] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("prod_referencias")
        .select("*")
        .order("codigo", { ascending: true });
      if (err) throw err;
      setRows((data ?? []) as ProdReferenciaRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando artículos");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Filtered rows ───────────────────────────────────────────────────────────

  const rowsFiltradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return rows.filter((r) => {
      const matchTexto =
        !q ||
        r.codigo.toLowerCase().includes(q) ||
        (r.referencia_cliente ?? "").toLowerCase().includes(q) ||
        (r.descripcion ?? "").toLowerCase().includes(q) ||
        (r.cliente ?? "").toLowerCase().includes(q);
      const matchCliente = filtroCliente === "todos" || r.cliente === filtroCliente;
      const matchTipo = filtroTipo === "todos" || r.tipo_producto === filtroTipo;
      const matchActivo =
        filtroActivo === "todos" ||
        (filtroActivo === "activos" && r.activo) ||
        (filtroActivo === "inactivos" && !r.activo);
      return matchTexto && matchCliente && matchTipo && matchActivo;
    });
  }, [rows, filtroTexto, filtroCliente, filtroTipo, filtroActivo]);

  const clientesUnicos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.cliente).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const tiposUnicos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.tipo_producto).filter(Boolean) as string[])).sort(),
    [rows]
  );

  // ── Crear ───────────────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    const nextNum = rows.reduce((max, r) => {
      const m = r.codigo.match(/^M-(\d{5})$/);
      if (m) { const n = parseInt(m[1], 10); return n > max ? n : max; }
      return max;
    }, 0);
    const nextCodigo = `M-${String(nextNum + 1).padStart(5, "0")}`;
    setCreateForm({ ...EMPTY_FORM, codigo: nextCodigo });
    setCreateOpen(true);
  }, [rows]);

  const handleCreate = useCallback(async () => {
    if (!createForm.codigo.trim()) return;
    setSavingCreate(true);
    try {
      const { error: err } = await supabase
        .from("prod_referencias")
        .insert(formToPayload(createForm));
      if (err) throw err;
      toast.success(`Artículo ${createForm.codigo} creado`);
      setCreateOpen(false);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error creando artículo");
    } finally {
      setSavingCreate(false);
    }
  }, [createForm, supabase, loadData]);

  // ── Editar ──────────────────────────────────────────────────────────────────

  const openEdit = useCallback((row: ProdReferenciaRow) => {
    setEditingRow(row);
    setEditForm(rowToForm(row));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingRow) return;
    setSavingEdit(true);
    try {
      const { error: err } = await supabase
        .from("prod_referencias")
        .update(formToPayload(editForm))
        .eq("id", editingRow.id);
      if (err) throw err;
      toast.success(`Artículo ${editingRow.codigo} actualizado`);
      setEditingRow(null);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando cambios");
    } finally {
      setSavingEdit(false);
    }
  }, [editingRow, editForm, supabase, loadData]);

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    exportarArticulosAExcel(rowsFiltradas);
  }, [rowsFiltradas]);

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportFile(file);
      setImportLoading(true);
      setImportError(null);
      setImportDiff(null);
      try {
        const existingCodigos = rows.map((r) => r.codigo);
        const parsed = await parseArticulosExcelFile(file, existingCodigos);
        const diff = computeArticulosDiff(parsed, rows);
        setImportDiff(diff);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Error procesando Excel");
      } finally {
        setImportLoading(false);
      }
    },
    [rows]
  );

  const handleImportConfirm = useCallback(async () => {
    if (!importDiff) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const { insertados, actualizados } = await aplicarArticulosDiff(
        supabase,
        importDiff,
        { incluirModificados: importIncluirModificados }
      );
      toast.success(`Importación completa: ${insertados} nuevos, ${actualizados} actualizados`);
      setImportOpen(false);
      setImportFile(null);
      setImportDiff(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Error importando");
    } finally {
      setImportLoading(false);
    }
  }, [importDiff, importIncluirModificados, supabase, loadData]);

  const resetImport = useCallback(() => {
    setImportFile(null);
    setImportDiff(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 max-w-[100vw] space-y-4 overflow-x-hidden">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <Boxes className="size-5 text-[#002147]" />
          <h1 className="font-heading text-xl font-bold text-[#002147] md:text-2xl">
            Maestro de Artículos
          </h1>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Catálogo de referencias Minerva · {rows.length} artículos ·{" "}
          {rows.filter((r) => r.activo).length} activos
        </p>
      </header>

      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" />
          Crear nuevo
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
          <Upload className="size-3.5" />
          Importar Excel
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
          <Download className="size-3.5" />
          Exportar ({rowsFiltradas.length})
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={descargarPlantillaArticulos}
          className="gap-1.5 text-slate-500"
        >
          <FileSpreadsheet className="size-3.5" />
          Plantilla Excel
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Buscar código, EU, descripción, cliente…"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
          {filtroTexto && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setFiltroTexto("")}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
        >
          <option value="todos">Todos los clientes</option>
          {clientesUnicos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="todos">Todos los tipos</option>
          {tiposUnicos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroActivo}
          onChange={(e) => setFiltroActivo(e.target.value)}
        >
          <option value="activos">Solo activos</option>
          <option value="todos">Todos (incl. inactivos)</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : rowsFiltradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          {rows.length === 0
            ? "No hay artículos todavía. Crea uno o importa un Excel."
            : "No hay artículos que coincidan con los filtros."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Código</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Ref. cliente</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Descripción</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Cliente</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Material</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Ruta</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Completitud</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">OTs</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowsFiltradas.map((r) => (
                <tr
                  key={r.id}
                  className={`transition hover:bg-slate-50 ${!r.activo ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2 font-mono font-medium text-[#002147]">{r.codigo}</td>
                  <td className="px-3 py-2 font-mono text-[#C69C2B]">
                    {r.referencia_cliente ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-700">
                    {r.descripcion ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-slate-500">
                    {r.cliente ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.tipo_producto ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 text-slate-500">
                    {r.material_habitual ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[10px] text-slate-400">
                    {r.ruta_habitual ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2">{completitudBadge(r)}</td>
                  <td className="px-3 py-2 text-center text-slate-400">
                    {r.total_repeticiones > 0 ? (
                      <span className="font-medium text-slate-600">{r.total_repeticiones}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear */}
      <ArticuloFormDialog
        open={createOpen}
        title="Crear nuevo artículo"
        description="El código se auto-sugerirá pero puedes cambiarlo."
        form={createForm}
        saving={savingCreate}
        onFormChange={setCreateForm}
        onSave={handleCreate}
        onClose={() => setCreateOpen(false)}
      />

      {/* Modal Editar */}
      <ArticuloFormDialog
        open={!!editingRow}
        title={`Editar artículo · ${editingRow?.codigo ?? ""}`}
        form={editForm}
        saving={savingEdit}
        onFormChange={setEditForm}
        onSave={handleSaveEdit}
        onClose={() => setEditingRow(null)}
        showCodigo={false}
      />

      {/* Modal Import */}
      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          if (!o) { setImportOpen(false); resetImport(); }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar artículos desde Excel</DialogTitle>
            <DialogDescription>
              Sube un Excel con la misma estructura de la plantilla. Las celdas vacías no
              sobrescriben datos existentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
            >
              <Upload className="size-3.5" />
              {importFile ? importFile.name : "Seleccionar archivo…"}
            </Button>

            {importLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="size-3.5 animate-spin" />
                Procesando…
              </div>
            )}

            {importError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-xs text-red-700">{importError}</AlertDescription>
              </Alert>
            )}

            {importDiff && !importLoading && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-medium text-slate-700">Vista previa de cambios:</p>
                <div className="flex gap-4">
                  <span className="text-emerald-700">
                    ✅ {importDiff.nuevos.length} nuevos
                  </span>
                  <span className="text-amber-700">
                    ✏️ {importDiff.modificados.length} con cambios
                  </span>
                  <span className="text-slate-500">
                    — {importDiff.sinCambios.length} sin cambios
                  </span>
                </div>
                {importDiff.modificados.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="incluir-mod"
                      checked={importIncluirModificados}
                      onCheckedChange={(v) => setImportIncluirModificados(Boolean(v))}
                    />
                    <Label htmlFor="incluir-mod" className="cursor-pointer text-xs">
                      Actualizar también los {importDiff.modificados.length} modificados
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setImportOpen(false); resetImport(); }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!importDiff || importLoading}
              onClick={handleImportConfirm}
            >
              {importLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {importDiff
                ? `Importar ${importDiff.nuevos.length + (importIncluirModificados ? importDiff.modificados.length : 0)} artículos`
                : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
