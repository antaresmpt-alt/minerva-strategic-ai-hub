"use client";

import {
  Copy,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EtiquetasMaterialDialog } from "@/components/produccion/etiquetas-digital/etiquetas-material-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  exportEtiquetasMaterialExcel,
  exportEtiquetasMaterialPdf,
  formatMaterialMailLine,
} from "@/lib/etiquetas-material-catalogo-export";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasMaterialCatalogoRow } from "@/types/prod-etiquetas-material-catalogo";
import { cn } from "@/lib/utils";

const TABLE = "prod_etiquetas_material_catalogo";

const MIGRATION_HINT =
  "En Supabase → SQL Editor, ejecuta la migración 20260518120000_prod_etiquetas_material_catalogo.sql del repo. Pulsa Actualizar.";

function isMissingTableMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_etiquetas_material_catalogo");
}

function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

async function copyText(text: string, okMsg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMsg);
  } catch {
    toast.error("No se pudo copiar al portapapeles.");
  }
}

export function EtiquetasConsultaMaterialTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProdEtiquetasMaterialCatalogoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] =
    useState<ProdEtiquetasMaterialCatalogoRow | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("marca")
      .order("categoria")
      .order("item_number");
    setLoading(false);
    if (error) {
      setRows([]);
      if (isMissingTableMessage(error.message)) {
        toast.error("Falta la tabla de catálogo material", {
          id: "etq-material-missing-ddl",
          description: MIGRATION_HINT,
        });
      } else {
        toast.error("No se pudo cargar el catálogo", {
          description: error.message,
        });
      }
      return;
    }
    setRows((data ?? []) as ProdEtiquetasMaterialCatalogoRow[]);
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const categoriasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = (r.categoria ?? "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const categoriaOptions: Option[] = useMemo(
    () => [
      { value: "", label: "— Todas las categorías —" },
      ...categoriasUnicas.map((c) => ({ value: c, label: c })),
    ],
    [categoriasUnicas]
  );

  const filtradas = useMemo(() => {
    let list = [...rows];
    if (soloActivos) list = list.filter((r) => r.activo);
    if (filtroMarca === "ADESTOR" || filtroMarca === "FEDRIGONI") {
      list = list.filter((r) => r.marca === filtroMarca);
    }
    const fc = filtroCategoria.trim();
    if (fc) list = list.filter((r) => (r.categoria ?? "").trim() === fc);
    const q = filtroTexto.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = [
          r.marca,
          r.categoria,
          r.item_number,
          r.face_name,
          r.adhesive,
          r.backing,
          r.ean_code,
          r.notes,
          r.stock_dimensions,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [rows, filtroTexto, filtroMarca, filtroCategoria, soloActivos]);

  const exportFilters = useMemo(
    () => ({
      buscar: filtroTexto,
      marcaLabel:
        filtroMarca === "ADESTOR"
          ? "Adestor"
          : filtroMarca === "FEDRIGONI"
            ? "Fedrigoni"
            : "Todas",
      categoriaLabel: filtroCategoria.trim() || "Todas",
      soloActivos,
    }),
    [filtroTexto, filtroMarca, filtroCategoria, soloActivos]
  );

  const openNew = () => {
    setEditingRow(null);
    setDialogOpen(true);
  };

  const openEdit = (r: ProdEtiquetasMaterialCatalogoRow) => {
    setEditingRow(r);
    setDialogOpen(true);
  };

  return (
    <div className="flex w-full min-w-0 max-w-[100vw] flex-col gap-3">
      <EtiquetasMaterialDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingRow(null);
        }}
        row={editingRow}
        onSaved={() => void loadRows()}
      />

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">Consulta material</h2>
          <p className="text-xs text-slate-600">
            Catálogo técnico Adestor y Fedrigoni (códigos, EAN, variantes). Independiente
            del nombre que usa Hugo en compras hasta enlazar con Rita.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={filtradas.length === 0}
            onClick={() => {
              exportEtiquetasMaterialExcel(filtradas, exportFilters);
              toast.success("Excel descargado");
            }}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={filtradas.length === 0}
            onClick={() => {
              exportEtiquetasMaterialPdf(filtradas, exportFilters);
              toast.success("PDF descargado");
            }}
          >
            PDF
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1 bg-[#002147]"
            onClick={openNew}
          >
            <Plus className="size-4" aria-hidden />
            Nuevo
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

      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200/90 bg-white/90 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid min-w-0 flex-1 gap-2 sm:max-w-lg">
          <Label htmlFor="etq-mat-buscar" className="text-xs">
            Buscar (código, face, notas, EAN, adhesivo…)
          </Label>
          <Input
            id="etq-mat-buscar"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Ej. PCD0121, couche brillo, Art 80"
            className="h-9"
          />
        </div>
        <div className="grid w-full gap-2 sm:w-40">
          <Label className="text-xs">Marca</Label>
          <NativeSelect
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            options={[
              { value: "", label: "— Todas —" },
              { value: "ADESTOR", label: "Adestor" },
              { value: "FEDRIGONI", label: "Fedrigoni" },
            ]}
          />
        </div>
        <div className="grid w-full gap-2 sm:min-w-[12rem] sm:max-w-xs sm:flex-1">
          <Label className="text-xs">Categoría</Label>
          <NativeSelect
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            options={categoriaOptions}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 sm:pb-1">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo activos
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtradas.length} de {rows.length} referencias
        {soloActivos ? " (activas)" : ""}.
      </p>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando catálogo…
        </div>
      ) : filtradas.length === 0 ? (
        <Alert className="border-slate-200 bg-slate-50/90">
          <AlertTitle>Sin resultados</AlertTitle>
          <AlertDescription className="text-sm">
            {rows.length === 0
              ? "No hay datos. Ejecuta la migración en Supabase o pulsa «Nuevo» para añadir referencias."
              : "Ninguna fila coincide con los filtros."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-sm">
          <Table className="min-w-[1100px] text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                <TableHead className="w-10 px-1" />
                <TableHead className="font-semibold text-[#002147]">Marca</TableHead>
                <TableHead className="min-w-[8rem] font-semibold text-[#002147]">
                  Categoría
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">Código</TableHead>
                <TableHead className="min-w-[8rem] font-semibold text-[#002147]">
                  Face
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">Adh.</TableHead>
                <TableHead className="font-semibold text-[#002147]">Back.</TableHead>
                <TableHead className="text-right font-semibold text-[#002147]">
                  €/m²
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">EAN</TableHead>
                <TableHead className="min-w-[10rem] font-semibold text-[#002147]">
                  Notas
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    i % 2 === 1 ? "bg-slate-50/50" : "bg-white",
                    !r.activo && "opacity-50"
                  )}
                >
                  <TableCell className="px-1 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Editar"
                        aria-label={`Editar ${r.item_number}`}
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Copiar línea para correo"
                        aria-label={`Copiar línea ${r.item_number}`}
                        onClick={() =>
                          void copyText(
                            formatMaterialMailLine(r),
                            "Línea copiada para el correo"
                          )
                        }
                      >
                        <Copy className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.marca === "FEDRIGONI" ? "Fedrigoni" : "Adestor"}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate" title={r.categoria ?? ""}>
                    {r.categoria ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono font-semibold text-[#002147]">
                    {r.item_number}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate" title={r.face_name ?? ""}>
                    {r.face_name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[5rem] truncate" title={r.adhesive ?? ""}>
                    {r.adhesive ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[4rem] truncate" title={r.backing ?? ""}>
                    {r.backing ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtPrice(r.price_m2)}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {r.ean_code ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate" title={r.notes ?? ""}>
                    {r.notes ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.stock_dimensions ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
