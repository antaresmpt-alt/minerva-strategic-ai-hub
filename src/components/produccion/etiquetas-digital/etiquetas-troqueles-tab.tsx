"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type {
  ProdEtiquetasTroquelRow,
  ProdEtiquetasTroquelInsert,
} from "@/types/prod-etiquetas-troqueles";
import {
  parseExcelFile,
  computeDiff,
  aplicarDiff,
  exportarTroquelesAExcel,
  normalizarCodigoTroquel,
} from "@/lib/etiquetas-troqueles-import";
import type { TroquelesDiffResult } from "@/lib/etiquetas-troqueles-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NativeSelect, type Option } from "@/components/ui/select-native";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, Plus, Pencil, AlertCircle, Trash2, Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EtiquetasTroquelesViewerDialog } from "./etiquetas-troqueles-viewer-dialog";

type EditForm = {
  codigo: string;
  carpeta_original: string;
  carpeta_path: string;
  forma: string;
  ancho_mm: string;
  alto_mm: string;
  diametro_mm: string;
  dimensiones_texto: string;
  especial: boolean;
  multiple: boolean;
  con_hendido: boolean;
  cliente: string;
  trabajo: string;
  estado: string;
  necesita_revision: boolean;
  notas: string;
  fecha_ult_reparacion: string;
};

const ESTADO_OPTIONS: Option[] = [
  { value: "activo", label: "activo" },
  { value: "vacio", label: "vacio" },
  { value: "mantenimiento", label: "mantenimiento" },
];

function rowToForm(row: ProdEtiquetasTroquelRow): EditForm {
  return {
    codigo: row.codigo,
    carpeta_original: row.carpeta_original ?? "",
    carpeta_path: row.carpeta_path ?? "",
    forma: row.forma ?? "",
    ancho_mm: row.ancho_mm != null ? String(row.ancho_mm) : "",
    alto_mm: row.alto_mm != null ? String(row.alto_mm) : "",
    diametro_mm: row.diametro_mm != null ? String(row.diametro_mm) : "",
    dimensiones_texto: row.dimensiones_texto ?? "",
    especial: row.especial,
    multiple: row.multiple,
    con_hendido: row.con_hendido,
    cliente: row.cliente ?? "",
    trabajo: row.trabajo ?? "",
    estado: row.estado,
    necesita_revision: row.necesita_revision,
    notas: row.notas ?? "",
    fecha_ult_reparacion: row.fecha_ult_reparacion ?? "",
  };
}

function parseOptionalDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function EtiquetasTroquelesTab() {
  const [rows, setRows] = useState<ProdEtiquetasTroquelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroForma, setFiltroForma] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroNecesitaRevision, setFiltroNecesitaRevision] = useState(false);
  
  const [editingRow, setEditingRow] = useState<ProdEtiquetasTroquelRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEdit, setDeletingEdit] = useState(false);
  
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDiff, setImportDiff] = useState<TroquelesDiffResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importIncluirModificados, setImportIncluirModificados] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTroquel, setViewerTroquel] = useState<ProdEtiquetasTroquelRow | null>(null);
  
  const [configOpen, setConfigOpen] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  
  const supabase = createSupabaseBrowserClient();
  
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from("prod_etiquetas_troqueles")
        .select("*")
        .order("codigo", { ascending: true });
      
      if (fetchError) throw fetchError;
      
      setRows(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando troqueles");
    } finally {
      setLoading(false);
    }
  }, [supabase]);
  
  const loadConfig = useCallback(async () => {
    try {
      const { data, error: configError } = await supabase
        .from("prod_troqueles_config")
        .select("etiquetas_troqueles_path")
        .limit(1)
        .maybeSingle();
      
      if (configError) throw configError;
      
      setConfigPath(data?.etiquetas_troqueles_path ?? "");
    } catch (err) {
      console.error("Error loading config:", err);
    }
  }, [supabase]);
  
  useEffect(() => {
    loadData();
    loadConfig();
  }, [loadData, loadConfig]);
  
  const rowsFiltradas = useMemo(() => {
    return rows.filter((row) => {
      const textoMatch =
        !filtroTexto ||
        row.codigo.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        (row.carpeta_original ?? "").toLowerCase().includes(filtroTexto.toLowerCase()) ||
        (row.cliente ?? "").toLowerCase().includes(filtroTexto.toLowerCase()) ||
        (row.trabajo ?? "").toLowerCase().includes(filtroTexto.toLowerCase());
      
      const formaMatch = filtroForma === "todas" || row.forma === filtroForma;
      const estadoMatch = filtroEstado === "todos" || row.estado === filtroEstado;
      const clienteMatch = filtroCliente === "todos" || row.cliente === filtroCliente;
      const revisionMatch = !filtroNecesitaRevision || row.necesita_revision;
      
      return textoMatch && formaMatch && estadoMatch && clienteMatch && revisionMatch;
    });
  }, [rows, filtroTexto, filtroForma, filtroEstado, filtroCliente, filtroNecesitaRevision]);
  
  const formasUnicas = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.forma).filter((f): f is string => !!f))).sort();
  }, [rows]);
  
  const estadosUnicos = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.estado))).sort();
  }, [rows]);
  
  const clientesUnicos = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.cliente).filter((c): c is string => !!c))).sort();
  }, [rows]);
  
  const handleExportar = useCallback(() => {
    exportarTroquelesAExcel(rowsFiltradas);
  }, [rowsFiltradas]);
  
  const handleImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      setImportFile(file);
      setImportLoading(true);
      setImportError(null);
      setImportDiff(null);
      
      try {
        const parsedRows = await parseExcelFile(file);
        const diff = computeDiff(parsedRows, rows);
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
      const result = await aplicarDiff(supabase, importDiff, {
        incluirModificados: importIncluirModificados,
      });
      
      await loadData();
      
      setImportDialogOpen(false);
      setImportFile(null);
      setImportDiff(null);
      setImportIncluirModificados(false);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      alert(
        `Importación completada:\n- ${result.insertados} nuevos insertados\n- ${result.actualizados} actualizados`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error aplicando importación");
    } finally {
      setImportLoading(false);
    }
  }, [supabase, importDiff, importIncluirModificados, loadData]);
  
  const handleEdit = useCallback((row: ProdEtiquetasTroquelRow) => {
    setEditingRow(row);
    setEditForm(rowToForm(row));
  }, []);
  
  const handleSaveEdit = useCallback(async () => {
    if (!editingRow || !editForm) return;
    
    setSavingEdit(true);
    
    try {
      const { error: updateError } = await supabase
        .from("prod_etiquetas_troqueles")
        .update({
          carpeta_original: editForm.carpeta_original.trim() || null,
          carpeta_path: editForm.carpeta_path || null,
          forma: editForm.forma || null,
          ancho_mm: parseOptionalDecimal(editForm.ancho_mm),
          alto_mm: parseOptionalDecimal(editForm.alto_mm),
          diametro_mm: parseOptionalDecimal(editForm.diametro_mm),
          dimensiones_texto: editForm.dimensiones_texto || null,
          especial: editForm.especial,
          multiple: editForm.multiple,
          con_hendido: editForm.con_hendido,
          cliente: editForm.cliente || null,
          trabajo: editForm.trabajo || null,
          estado: editForm.estado,
          necesita_revision: editForm.necesita_revision,
          notas: editForm.notas || null,
          fecha_ult_reparacion:
            editForm.fecha_ult_reparacion.trim() || null,
        })
        .eq("id", editingRow.id);
      
      if (updateError) throw updateError;
      
      await loadData();
      setEditingRow(null);
      setEditForm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error guardando cambios");
    } finally {
      setSavingEdit(false);
    }
  }, [supabase, editingRow, editForm, loadData]);

  const handleDeleteEdit = useCallback(async () => {
    if (!editingRow) return;
    const ok = window.confirm(
      `¿Eliminar troquel ${editingRow.codigo}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    setDeletingEdit(true);

    try {
      const { data, error: deleteError } = await supabase
        .from("prod_etiquetas_troqueles")
        .delete()
        .eq("id", editingRow.id)
        .select("id");

      if (deleteError) throw deleteError;
      if (!data?.length) {
        throw new Error("No se eliminó ningún troquel. Comprueba permisos o recarga la página.");
      }

      await loadData();
      setEditingRow(null);
      setEditForm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error eliminando troquel");
    } finally {
      setDeletingEdit(false);
    }
  }, [supabase, editingRow, loadData]);
  
  const handleCreateNew = useCallback(async () => {
    const maxCodigoNum = rows.reduce((max, row) => {
      const num = Number.parseInt(row.codigo, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
    
    const nextCodigo = normalizarCodigoTroquel(maxCodigoNum + 1);
    
    setCreateForm({
      codigo: nextCodigo,
      carpeta_original: "",
      carpeta_path: "",
      forma: "",
      ancho_mm: "",
      alto_mm: "",
      diametro_mm: "",
      dimensiones_texto: "",
      especial: false,
      multiple: false,
      con_hendido: false,
      cliente: "",
      trabajo: "",
      estado: "activo",
      necesita_revision: false,
      notas: "",
      fecha_ult_reparacion: "",
    });
    setCreateDialogOpen(true);
  }, [rows]);
  
  const handleSaveCreate = useCallback(async () => {
    if (!createForm) return;
    
    if (!createForm.codigo.trim()) {
      alert("El código es obligatorio");
      return;
    }
    
    setSavingCreate(true);
    
    try {
      const newRow: ProdEtiquetasTroquelInsert = {
        codigo: createForm.codigo.trim(),
        carpeta_original: createForm.carpeta_original.trim() || null,
        carpeta_path: createForm.carpeta_path || null,
        forma: createForm.forma || null,
        ancho_mm: parseOptionalDecimal(createForm.ancho_mm),
        alto_mm: parseOptionalDecimal(createForm.alto_mm),
        diametro_mm: parseOptionalDecimal(createForm.diametro_mm),
        dimensiones_texto: createForm.dimensiones_texto || null,
        especial: createForm.especial,
        multiple: createForm.multiple,
        con_hendido: createForm.con_hendido,
        cliente: createForm.cliente || null,
        trabajo: createForm.trabajo || null,
        estado: createForm.estado,
        necesita_revision: createForm.necesita_revision,
        notas: createForm.notas || null,
        fecha_ult_reparacion:
          createForm.fecha_ult_reparacion.trim() || null,
        documentos: null,
      };
      
      const { error: insertError } = await supabase
        .from("prod_etiquetas_troqueles")
        .insert(newRow);
      
      if (insertError) throw insertError;
      
      await loadData();
      setCreateDialogOpen(false);
      setCreateForm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creando troquel");
    } finally {
      setSavingCreate(false);
    }
  }, [supabase, createForm, loadData]);
  
  const handleOpenViewer = useCallback((row: ProdEtiquetasTroquelRow) => {
    if (!row.carpeta_original?.trim()) {
      alert("Este troquel no tiene carpeta original informada");
      return;
    }
    setViewerTroquel(row);
    setViewerOpen(true);
  }, []);
  
  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true);
    
    try {
      const { data: existingConfig, error: fetchError } = await supabase
        .from("prod_troqueles_config")
        .select("id")
        .limit(1)
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (existingConfig) {
        const { error: updateError } = await supabase
          .from("prod_troqueles_config")
          .update({ etiquetas_troqueles_path: configPath || null })
          .eq("id", existingConfig.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("prod_troqueles_config")
          .insert({ etiquetas_troqueles_path: configPath || null });
        
        if (insertError) throw insertError;
      }
      
      alert("Configuración guardada correctamente");
      await loadConfig();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error guardando configuración");
    } finally {
      setSavingConfig(false);
    }
  }, [supabase, configPath, loadConfig]);
  
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="text-sm text-slate-600">Cargando troqueles...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50 text-red-800">
        <AlertCircle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52">
          <Label htmlFor="filtro-texto" className="text-xs">
            Buscar (código, carpeta, cliente, trabajo)
          </Label>
          <Input
            id="filtro-texto"
            type="text"
            placeholder="Buscar..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div className="w-40">
          <Label htmlFor="filtro-forma" className="text-xs">
            Forma
          </Label>
          <Select value={filtroForma} onValueChange={(v) => setFiltroForma(v ?? "todas")}>
            <SelectTrigger id="filtro-forma" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {formasUnicas.map((forma) => (
                <SelectItem key={forma} value={forma}>
                  {forma}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-32">
          <Label htmlFor="filtro-estado" className="text-xs">
            Estado
          </Label>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v ?? "todos")}>
            <SelectTrigger id="filtro-estado" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {estadosUnicos.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {estado}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <Label htmlFor="filtro-cliente" className="text-xs">
            Cliente
          </Label>
          <Select value={filtroCliente} onValueChange={(v) => setFiltroCliente(v ?? "todos")}>
            <SelectTrigger id="filtro-cliente" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {clientesUnicos.map((cliente) => (
                <SelectItem key={cliente} value={cliente}>
                  {cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="filtro-revision"
            checked={filtroNecesitaRevision}
            onCheckedChange={(checked) => setFiltroNecesitaRevision(!!checked)}
          />
          <Label htmlFor="filtro-revision" className="text-xs cursor-pointer">
            Solo necesitan revisión
          </Label>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleCreateNew} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Crear nuevo
        </Button>
        
        <Button
          onClick={() => setImportDialogOpen(true)}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          <Upload className="size-4" />
          Importar Excel
        </Button>
        
        <Button
          onClick={handleExportar}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          <Download className="size-4" />
          Exportar Excel
        </Button>
        
        <div className="ml-auto text-xs text-slate-600">
          {rowsFiltradas.length} de {rows.length} troqueles
        </div>
      </div>
      
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">Código</th>
              <th className="px-2 py-2 text-left font-semibold">Forma</th>
              <th className="px-2 py-2 text-left font-semibold">Dimensiones</th>
              <th className="px-2 py-2 text-left font-semibold">Cliente</th>
              <th className="px-2 py-2 text-left font-semibold">Trabajo</th>
              <th className="px-2 py-2 text-left font-semibold">Estado</th>
              <th className="px-2 py-2 text-left font-semibold">F. últ. reparación</th>
              <th className="px-2 py-2 text-center font-semibold">Rev.</th>
              <th className="px-2 py-2 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-8 text-center text-slate-500">
                  No hay troqueles que coincidan con los filtros
                </td>
              </tr>
            ) : (
              rowsFiltradas.map((row) => {
                const canOpenViewer = !!row.carpeta_original?.trim();
                
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-2 py-2 font-mono">{row.codigo}</td>
                    <td className="px-2 py-2">{row.forma || "-"}</td>
                    <td className="px-2 py-2">{row.dimensiones_texto || "-"}</td>
                    <td className="px-2 py-2">{row.cliente || "-"}</td>
                    <td className="px-2 py-2">{row.trabajo || "-"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          row.estado === "activo"
                            ? "bg-green-100 text-green-800"
                            : row.estado === "vacio"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.fecha_ult_reparacion || "-"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {row.necesita_revision ? (
                        <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                          Sí
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenViewer(row)}
                          disabled={!canOpenViewer}
                          className="h-7 w-7 p-0"
                          title={
                            canOpenViewer
                              ? "Ver archivos del troquel"
                              : "Sin carpeta original informada"
                          }
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(row)}
                          className="h-7 gap-1 px-2"
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setConfigOpen(!configOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span>Configuración de ubicación de archivos</span>
          {configOpen ? (
            <ChevronUp className="size-4 text-slate-400" />
          ) : (
            <ChevronDown className="size-4 text-slate-400" />
          )}
        </button>
        
        {configOpen && (
          <div className="space-y-4 border-t border-slate-200 px-4 py-4">
            <p className="text-xs text-slate-600">
              Carpeta raíz donde están las carpetas de troqueles de etiquetas (ej. <code className="rounded bg-slate-100 px-1 font-mono">C:\Datos\Troqueles\Etiquetas</code>). 
              Se concatena con la carpeta original de cada troquel.
            </p>
            <div className="space-y-2">
              <Label htmlFor="config-path" className="text-xs">
                Ruta carpeta troqueles de etiquetas
              </Label>
              <Input
                id="config-path"
                value={configPath}
                onChange={(e) => setConfigPath(e.target.value)}
                placeholder="C:\Users\USUARIO\Downloads\ETIQUETAS\TROQUELES\TROQUELES\TROQUELES ETIQUETAS"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                size="sm"
                className="gap-1.5"
              >
                {savingConfig ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Guardar ubicación
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4">
            <DialogTitle>Editar troquel {editingRow?.codigo}</DialogTitle>
            <DialogDescription>
              Modifica los campos del troquel. El código no se puede cambiar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {editForm && (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="edit-codigo" className="text-xs">
                    Código
                  </Label>
                  <Input
                    id="edit-codigo"
                    value={editForm.codigo}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-estado" className="text-xs">
                    Estado
                  </Label>
                  <NativeSelect
                    id="edit-estado"
                    className="mt-1"
                    value={editForm.estado}
                    onChange={(e) =>
                      setEditForm({ ...editForm, estado: e.target.value })
                    }
                    options={ESTADO_OPTIONS}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-fecha-reparacion" className="text-xs">
                    Fecha últ. reparación
                  </Label>
                  <Input
                    id="edit-fecha-reparacion"
                    type="date"
                    value={editForm.fecha_ult_reparacion}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        fecha_ult_reparacion: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-carpeta" className="text-xs">
                  Carpeta original
                </Label>
                <Input
                  id="edit-carpeta"
                  value={editForm.carpeta_original}
                  onChange={(e) =>
                    setEditForm({ ...editForm, carpeta_original: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-forma" className="text-xs">
                    Forma
                  </Label>
                  <Input
                    id="edit-forma"
                    value={editForm.forma}
                    onChange={(e) => setEditForm({ ...editForm, forma: e.target.value })}
                    placeholder="rectangular, redondo, etc"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-dim-texto" className="text-xs">
                    Dimensiones (texto)
                  </Label>
                  <Input
                    id="edit-dim-texto"
                    value={editForm.dimensiones_texto}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dimensiones_texto: e.target.value })
                    }
                    placeholder="100x60mm, 50mm, etc"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="edit-ancho" className="text-xs">
                    Ancho (mm)
                  </Label>
                  <Input
                    id="edit-ancho"
                    value={editForm.ancho_mm}
                    onChange={(e) => setEditForm({ ...editForm, ancho_mm: e.target.value })}
                    placeholder="100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-alto" className="text-xs">
                    Alto (mm)
                  </Label>
                  <Input
                    id="edit-alto"
                    value={editForm.alto_mm}
                    onChange={(e) => setEditForm({ ...editForm, alto_mm: e.target.value })}
                    placeholder="60"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-diametro" className="text-xs">
                    Diámetro (mm)
                  </Label>
                  <Input
                    id="edit-diametro"
                    value={editForm.diametro_mm}
                    onChange={(e) => setEditForm({ ...editForm, diametro_mm: e.target.value })}
                    placeholder="50"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-cliente" className="text-xs">
                    Cliente
                  </Label>
                  <Input
                    id="edit-cliente"
                    value={editForm.cliente}
                    onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })}
                    placeholder="TURRIS, VINESTAR, etc"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-trabajo" className="text-xs">
                    Trabajo
                  </Label>
                  <Input
                    id="edit-trabajo"
                    value={editForm.trabajo}
                    onChange={(e) => setEditForm({ ...editForm, trabajo: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-especial"
                    checked={editForm.especial}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, especial: !!checked })
                    }
                  />
                  <Label htmlFor="edit-especial" className="text-xs cursor-pointer">
                    Especial
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-multiple"
                    checked={editForm.multiple}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, multiple: !!checked })
                    }
                  />
                  <Label htmlFor="edit-multiple" className="text-xs cursor-pointer">
                    Múltiple/Doble
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-hendido"
                    checked={editForm.con_hendido}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, con_hendido: !!checked })
                    }
                  />
                  <Label htmlFor="edit-hendido" className="text-xs cursor-pointer">
                    Con hendido
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-revision"
                    checked={editForm.necesita_revision}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, necesita_revision: !!checked })
                    }
                  />
                  <Label htmlFor="edit-revision" className="text-xs cursor-pointer">
                    Necesita revisión
                  </Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-notas" className="text-xs">
                  Notas
                </Label>
                <Input
                  id="edit-notas"
                  value={editForm.notas}
                  onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          </div>
          
          <DialogFooter className="shrink-0 gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-3 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDeleteEdit()}
              disabled={savingEdit || deletingEdit}
              className="gap-1.5 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Trash2 className="size-4" aria-hidden />
              {deletingEdit ? "Eliminando..." : "Eliminar"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingRow(null)}
                disabled={savingEdit || deletingEdit}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit || deletingEdit}>
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar troqueles desde Excel</DialogTitle>
            <DialogDescription>
              Selecciona un archivo Excel para importar troqueles. El sistema comparará con
              los datos existentes y te mostrará un resumen antes de importar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFileChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200"
              />
            </div>
            
            {importLoading && (
              <p className="text-sm text-slate-600">Procesando archivo...</p>
            )}
            
            {importError && (
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertCircle className="size-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}
            
            {importDiff && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h4 className="font-semibold text-sm">Resumen de cambios:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between rounded bg-green-100 px-3 py-2">
                    <span className="font-medium text-green-800">Nuevos</span>
                    <span className="font-bold text-green-800">
                      {importDiff.nuevos.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-amber-100 px-3 py-2">
                    <span className="font-medium text-amber-800">Modificados</span>
                    <span className="font-bold text-amber-800">
                      {importDiff.modificados.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-slate-100 px-3 py-2">
                    <span className="font-medium text-slate-600">Sin cambios</span>
                    <span className="font-bold text-slate-600">
                      {importDiff.sinCambios.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-blue-100 px-3 py-2">
                    <span className="font-medium text-blue-800">Solo en BD</span>
                    <span className="font-bold text-blue-800">
                      {importDiff.soloEnBd.length}
                    </span>
                  </div>
                </div>
                
                {importDiff.modificados.length > 0 && (
                  <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2">
                    <Checkbox
                      id="import-incluir-modificados"
                      checked={importIncluirModificados}
                      onCheckedChange={(checked) => setImportIncluirModificados(!!checked)}
                    />
                    <Label
                      htmlFor="import-incluir-modificados"
                      className="cursor-pointer text-xs text-amber-800"
                    >
                      Aplicar modificados ({importDiff.modificados.length})
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportFile(null);
                setImportDiff(null);
                setImportIncluirModificados(false);
                setImportError(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              disabled={importLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportConfirm}
              disabled={!importDiff || importLoading || importDiff.nuevos.length === 0}
            >
              {importLoading
                ? "Importando..."
                : `Importar ${importDiff?.nuevos.length ?? 0} nuevos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4">
            <DialogTitle>Crear nuevo troquel</DialogTitle>
            <DialogDescription>
              Crea un nuevo troquel. El código se sugiere automáticamente pero puedes cambiarlo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {createForm && (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="create-codigo" className="text-xs">
                    Código *
                  </Label>
                  <Input
                    id="create-codigo"
                    value={createForm.codigo}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, codigo: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-estado" className="text-xs">
                    Estado
                  </Label>
                  <NativeSelect
                    id="create-estado"
                    className="mt-1"
                    value={createForm.estado}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, estado: e.target.value })
                    }
                    options={ESTADO_OPTIONS}
                  />
                </div>
                <div>
                  <Label htmlFor="create-fecha-reparacion" className="text-xs">
                    Fecha últ. reparación
                  </Label>
                  <Input
                    id="create-fecha-reparacion"
                    type="date"
                    value={createForm.fecha_ult_reparacion}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        fecha_ult_reparacion: e.target.value,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="create-carpeta" className="text-xs">
                  Carpeta original
                </Label>
                <Input
                  id="create-carpeta"
                  value={createForm.carpeta_original}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, carpeta_original: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="create-forma" className="text-xs">
                    Forma
                  </Label>
                  <Input
                    id="create-forma"
                    value={createForm.forma}
                    onChange={(e) => setCreateForm({ ...createForm, forma: e.target.value })}
                    placeholder="rectangular, redondo, etc"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-dim-texto" className="text-xs">
                    Dimensiones (texto)
                  </Label>
                  <Input
                    id="create-dim-texto"
                    value={createForm.dimensiones_texto}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, dimensiones_texto: e.target.value })
                    }
                    placeholder="100x60mm, 50mm, etc"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="create-ancho" className="text-xs">
                    Ancho (mm)
                  </Label>
                  <Input
                    id="create-ancho"
                    value={createForm.ancho_mm}
                    onChange={(e) => setCreateForm({ ...createForm, ancho_mm: e.target.value })}
                    placeholder="100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-alto" className="text-xs">
                    Alto (mm)
                  </Label>
                  <Input
                    id="create-alto"
                    value={createForm.alto_mm}
                    onChange={(e) => setCreateForm({ ...createForm, alto_mm: e.target.value })}
                    placeholder="60"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-diametro" className="text-xs">
                    Diámetro (mm)
                  </Label>
                  <Input
                    id="create-diametro"
                    value={createForm.diametro_mm}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, diametro_mm: e.target.value })
                    }
                    placeholder="50"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="create-cliente" className="text-xs">
                    Cliente
                  </Label>
                  <Input
                    id="create-cliente"
                    value={createForm.cliente}
                    onChange={(e) => setCreateForm({ ...createForm, cliente: e.target.value })}
                    placeholder="TURRIS, VINESTAR, etc"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-trabajo" className="text-xs">
                    Trabajo
                  </Label>
                  <Input
                    id="create-trabajo"
                    value={createForm.trabajo}
                    onChange={(e) => setCreateForm({ ...createForm, trabajo: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-especial"
                    checked={createForm.especial}
                    onCheckedChange={(checked) =>
                      setCreateForm({ ...createForm, especial: !!checked })
                    }
                  />
                  <Label htmlFor="create-especial" className="text-xs cursor-pointer">
                    Especial
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-multiple"
                    checked={createForm.multiple}
                    onCheckedChange={(checked) =>
                      setCreateForm({ ...createForm, multiple: !!checked })
                    }
                  />
                  <Label htmlFor="create-multiple" className="text-xs cursor-pointer">
                    Múltiple/Doble
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-hendido"
                    checked={createForm.con_hendido}
                    onCheckedChange={(checked) =>
                      setCreateForm({ ...createForm, con_hendido: !!checked })
                    }
                  />
                  <Label htmlFor="create-hendido" className="text-xs cursor-pointer">
                    Con hendido
                  </Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-revision"
                    checked={createForm.necesita_revision}
                    onCheckedChange={(checked) =>
                      setCreateForm({ ...createForm, necesita_revision: !!checked })
                    }
                  />
                  <Label htmlFor="create-revision" className="text-xs cursor-pointer">
                    Necesita revisión
                  </Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="create-notas" className="text-xs">
                  Notas
                </Label>
                <Input
                  id="create-notas"
                  value={createForm.notas}
                  onChange={(e) => setCreateForm({ ...createForm, notas: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          </div>
          
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 bg-slate-50/80 px-6 py-3">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setCreateForm(null);
              }}
              disabled={savingCreate}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveCreate} disabled={savingCreate}>
              {savingCreate ? "Creando..." : "Crear troquel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <EtiquetasTroquelesViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        troquel={viewerTroquel}
      />
    </div>
  );
}
