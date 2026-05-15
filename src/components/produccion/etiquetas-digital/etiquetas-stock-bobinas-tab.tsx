"use client";

import { Loader2, Minus, Pencil, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EtiquetasStockBobinaDialog } from "@/components/produccion/etiquetas-digital/etiquetas-stock-bobina-dialog";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type { ProdEtiquetasStockBobinaRow } from "@/types/prod-etiquetas-stock-bobinas";
import { cn } from "@/lib/utils";

const TABLE = "prod_etiquetas_stock_bobinas";
const CATALOG_TABLE = "prod_etiquetas_catalogo";

const MIGRATION_HINT =
  "En Supabase → SQL Editor, ejecuta la migración 20260517140000_prod_etiquetas_stock_bobinas.sql del repo y pulsa Actualizar.";

const FILTRO_STOCK_OPTIONS: Option[] = [
  { value: "todos", label: "Todos" },
  { value: "con_stock", label: "Con stock (>0)" },
  { value: "sin_stock", label: "Sin stock (0)" },
  { value: "bajo", label: "Stock bajo (1 rollo)" },
];

function isMissingTableMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_etiquetas_stock_bobinas");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
  return iso;
}

function stockRowClass(unidades: number): string {
  if (unidades <= 0) return "bg-red-50/80";
  if (unidades === 1) return "bg-amber-50/60";
  return "";
}

export function EtiquetasStockBobinasTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProdEtiquetasStockBobinaRow[]>([]);
  const [catalog, setCatalog] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroStock, setFiltroStock] = useState("todos");
  const [soloActivos, setSoloActivos] = useState(true);
  const [editingRow, setEditingRow] = useState<ProdEtiquetasStockBobinaRow | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [rRows, rCat] = await Promise.all([
      supabase
        .from(TABLE)
        .select("*")
        .order("papel")
        .order("fabricante")
        .order("codigo"),
      supabase
        .from(CATALOG_TABLE)
        .select("id, categoria, grupo, label, activo, orden")
        .order("categoria")
        .order("orden")
        .order("label"),
    ]);
    setLoading(false);

    if (rRows.error) {
      setRows([]);
      const msg = rRows.error.message;
      if (isMissingTableMessage(msg)) {
        toast.error("Falta la tabla de stock en la base de datos", {
          id: "etq-stock-missing-ddl",
          description: MIGRATION_HINT,
        });
      } else {
        toast.error("No se pudo cargar el stock", { description: msg });
      }
    } else {
      setRows((rRows.data ?? []) as ProdEtiquetasStockBobinaRow[]);
    }

    if (rCat.error) {
      console.warn("[etiquetas catalog stock]", rCat.error.message);
      setCatalog([]);
    } else {
      setCatalog((rCat.data ?? []) as ProdEtiquetasCatalogRow[]);
    }
  }, [supabase]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtradas = useMemo(() => {
    let list = [...rows];
    if (soloActivos) {
      list = list.filter((r) => r.activo);
    }
    const q = filtroTexto.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.papel,
          r.fabricante,
          r.codigo,
          r.ubicacion ?? "",
          r.notas ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (filtroStock === "con_stock") {
      list = list.filter((r) => r.unidades_stock > 0);
    } else if (filtroStock === "sin_stock") {
      list = list.filter((r) => r.unidades_stock <= 0);
    } else if (filtroStock === "bajo") {
      list = list.filter((r) => r.unidades_stock === 1);
    }
    return list;
  }, [rows, filtroTexto, filtroStock, soloActivos]);

  const openNew = useCallback(() => {
    setEditingRow(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((row: ProdEtiquetasStockBobinaRow) => {
    setEditingRow(row);
    setDialogOpen(true);
  }, []);

  const adjustStock = useCallback(
    async (row: ProdEtiquetasStockBobinaRow, delta: number) => {
      const next = Math.max(0, row.unidades_stock + delta);
      if (next === row.unidades_stock) return;
      setAdjustingId(row.id);
      const { error } = await supabase
        .from(TABLE)
        .update({ unidades_stock: next })
        .eq("id", row.id);
      setAdjustingId(null);
      if (error) {
        toast.error(error.message);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, unidades_stock: next } : r
        )
      );
    },
    [supabase]
  );

  return (
    <div className="flex w-full min-w-0 max-w-[100vw] flex-col gap-3">
      <EtiquetasStockBobinaDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingRow(null);
        }}
        row={editingRow}
        catalog={catalog}
        onSaved={() => void loadAll()}
      />

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">Stock bobinas</h2>
          <p className="text-xs text-slate-600">
            Sustrato en rollos · tabla{" "}
            <code className="rounded bg-slate-100 px-1">{TABLE}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={openNew}>
            <Plus className="size-4" aria-hidden />
            Nuevo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void loadAll()}
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

      <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-white/90 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1 lg:col-span-2">
          <Label className="text-xs">Buscar</Label>
          <Input
            className="h-8 text-xs"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Papel, fabricante, código, ubicación…"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Stock</Label>
          <NativeSelect
            className="h-8 text-xs"
            value={filtroStock}
            onChange={(e) => setFiltroStock(e.target.value)}
            options={FILTRO_STOCK_OPTIONS}
          />
        </div>
        <label className="flex items-end gap-2 pb-1 text-xs">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="size-3.5 rounded border-slate-300"
          />
          Solo activos
        </label>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Cargando stock…
          </div>
        ) : filtradas.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No hay artículos que coincidan con el filtro.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Papel</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Rollos</TableHead>
                <TableHead>Ancho</TableHead>
                <TableHead>F. pedido</TableHead>
                <TableHead>F. recepción</TableHead>
                <TableHead>Ubicación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(stockRowClass(r.unidades_stock))}
                >
                  <TableCell className="p-1">
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Editar"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Quitar 1 rollo"
                        disabled={
                          adjustingId === r.id || r.unidades_stock <= 0
                        }
                        onClick={() => void adjustStock(r, -1)}
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Añadir 1 rollo"
                        disabled={adjustingId === r.id}
                        onClick={() => void adjustStock(r, 1)}
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[9rem] truncate font-medium">
                    {r.papel}
                  </TableCell>
                  <TableCell className="max-w-[7rem] truncate">
                    {r.fabricante || "—"}
                  </TableCell>
                  <TableCell className="max-w-[7rem] truncate font-mono text-xs">
                    {r.codigo || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {r.unidades_stock}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {r.ancho_mm != null ? `${r.ancho_mm} mm` : "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {fmtDate(r.fecha_pedido)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {fmtDate(r.fecha_recepcion)}
                  </TableCell>
                  <TableCell className="max-w-[6rem] truncate text-xs">
                    {r.ubicacion ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        <span className="inline-block size-2 rounded bg-red-100 ring-1 ring-red-200" />{" "}
        Sin stock ·{" "}
        <span className="inline-block size-2 rounded bg-amber-100 ring-1 ring-amber-200" />{" "}
        1 rollo (pedir pronto)
      </p>
    </div>
  );
}
