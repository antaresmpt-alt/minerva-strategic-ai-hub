"use client";

import {
  Boxes,
  Coins,
  Layers,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { StockAiDialog } from "@/components/produccion/almacen/stock/stock-ai-dialog";
import {
  openCartelaPrintWindow,
  printCartelasWindow,
  writeCartelasToWindow,
} from "@/lib/cartela-print-html";
import {
  fetchOtMetadataMap,
  otTitulosFromMetadata,
} from "@/lib/cartelas-ot-metadata";
import {
  executeStockOptimusImport,
  parseStockOptimusFile,
  type StockOptimusParseResult,
} from "@/lib/stock-optimus-import";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ProdStockMovimientoRow,
  ProdStockPaletConOts,
  StockEstadoDerivado,
  StockPaletAtpConOts,
  StockPaletAtpRow,
  StockPaletOtChip,
  StockTipo,
} from "@/types/prod-stock";
const supabase = createSupabaseBrowserClient();

type EstadoFiltro = "todos" | "sin_ot" | "libre" | "reservado" | "parcial";

const ESTADO_BADGE: Record<StockEstadoDerivado, string> = {
  disponible: "bg-emerald-100 text-emerald-800 border-emerald-200",
  parcial: "bg-amber-100 text-amber-800 border-amber-200",
  reservado: "bg-blue-100 text-blue-800 border-blue-200",
  agotado: "bg-slate-100 text-slate-500 border-slate-200",
};

const ESTADO_LABEL: Record<StockEstadoDerivado, string> = {
  disponible: "Disponible",
  parcial: "Parcial",
  reservado: "Reservado",
  agotado: "Agotado",
};

const TIPO_STOCK_LABEL: Record<StockTipo, string> = {
  materia_prima: "Materia prima",
  semielaborado: "Semielaborado",
  producto_terminado: "Producto terminado",
  consumible: "Consumible",
};

function unwrapJoinRow(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first != null && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function eur(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

/** Proveedor desde notas de import Optimus (sin recepción muelle). */
function proveedorFromNotas(notas: string | null | undefined): string | null {
  if (!notas) return null;
  const m = notas.match(/Proveedor:\s*(.+?)(?:\s*·|$)/i);
  return m?.[1]?.trim() ?? null;
}

/** Mapea una fila de la vista ATP a ProdStockPaletConOts para reimprimir la cartela. */
function atpToPaletPrint(row: StockPaletAtpConOts): ProdStockPaletConOts {
  return {
    id: row.id,
    id_stock: row.id_stock,
    tipo_stock: row.tipo_stock,
    unidad: row.unidad,
    recepcion_id: row.recepcion_id,
    compra_id: row.compra_id,
    codigo_articulo: row.codigo_articulo,
    descripcion_material: row.descripcion_material,
    material_nombre: row.material_nombre,
    gramaje: row.gramaje,
    formato: row.formato,
    marca: row.marca,
    cantidad_peso: null,
    cantidad_peso_unidad: null,
    cantidad_inicial: row.cantidad_inicial,
    cantidad_actual: row.cantidad_fisica,
    ot_destino_numero: row.ot_destino_numero,
    estado: row.estado_legacy,
    coste: row.coste,
    ubicacion_fila: row.ubicacion_fila,
    nota_entrega: row.nota_entrega,
    ref_lote_proveedor: row.ref_lote_proveedor,
    ref_lote: row.ref_lote,
    es_fsc: row.es_fsc,
    es_pefc: row.es_pefc,
    fsc_certificado_proveedor: null,
    pefc_certificado_proveedor: null,
    notas: null,
    es_prueba: row.es_prueba,
    created_by: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ots: row.ots.map((o) => o.ot_numero),
    otsReservas: row.ots,
    proveedor_nombre: row.proveedor_nombre ?? null,
  };
}

export function StockPage() {
  const [rows, setRows] = useState<StockPaletAtpConOts[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<StockTipo | "todos">("todos");

  const [detalle, setDetalle] = useState<StockPaletAtpConOts | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<StockOptimusParseResult | null>(
    null
  );
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [mostrarPruebas, setMostrarPruebas] = useState(false);
  const [stockAiOpen, setStockAiOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: view, error } = await supabase
        .from("stock_palets_atp")
        .select("*")
        .order("id_stock", { ascending: false })
        .limit(600);

      if (error) throw error;
      if (!view || view.length === 0) {
        setRows([]);
        return;
      }

      const paletIds = view.map((v: StockPaletAtpRow) => v.id);

      const { data: notasRows } = await supabase
        .from("prod_stock_palets")
        .select("id, notas")
        .in("id", paletIds);
      const notasById: Record<string, string | null> = {};
      for (const n of notasRows ?? []) {
        notasById[n.id as string] =
          typeof n.notas === "string" ? n.notas : null;
      }

      // OTs con reserva (chips)
      const { data: otsRows } = await supabase
        .from("prod_stock_palet_ots")
        .select("palet_id, ot_numero, cantidad_reservada")
        .in("palet_id", paletIds);

      const otsByPalet: Record<string, StockPaletOtChip[]> = {};
      for (const r of otsRows ?? []) {
        if (!otsByPalet[r.palet_id]) otsByPalet[r.palet_id] = [];
        otsByPalet[r.palet_id].push({
          ot_numero: r.ot_numero,
          cantidad_reservada: r.cantidad_reservada ?? null,
        });
      }

      // Proveedor vía recepción → compra → proveedor
      const recepIds = [
        ...new Set(
          view
            .map((v: StockPaletAtpRow) => v.recepcion_id)
            .filter((x): x is string => !!x)
        ),
      ];
      const proveedorByRecep: Record<string, string | null> = {};
      if (recepIds.length > 0) {
        const { data: receps } = await supabase
          .from("prod_recepciones_material")
          .select("id, prod_compra_material(prod_proveedores(nombre))")
          .in("id", recepIds);
        for (const raw of (receps ?? []) as Record<string, unknown>[]) {
          const compra = unwrapJoinRow(raw.prod_compra_material);
          const prov = compra ? unwrapJoinRow(compra.prod_proveedores) : null;
          proveedorByRecep[String(raw.id)] =
            typeof prov?.nombre === "string" ? prov.nombre : null;
        }
      }

      const enriched: StockPaletAtpConOts[] = view.map(
        (v: StockPaletAtpRow) => {
          const provRecep = v.recepcion_id
            ? (proveedorByRecep[v.recepcion_id] ?? null)
            : null;
          const provNotas = proveedorFromNotas(notasById[v.id]);
          return {
            ...v,
            ots: otsByPalet[v.id] ?? [],
            proveedor_nombre: provRecep ?? provNotas,
          };
        }
      );
      setRows(enriched);
    } catch (e) {
      toast.error(
        `Error al cargar stock: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tiposPresentes = useMemo(() => {
    return [...new Set(rows.map((r) => r.tipo_stock))];
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;

    if (!mostrarPruebas) {
      list = list.filter((r) => !r.es_prueba);
    }

    if (estadoFiltro !== "todos") {
      list = list.filter((r) => {
        if (estadoFiltro === "sin_ot") return r.ots.length === 0;
        if (estadoFiltro === "libre") return r.cantidad_libre > 0;
        if (estadoFiltro === "reservado")
          return r.cantidad_reservada_total > 0;
        if (estadoFiltro === "parcial") return r.estado_derivado === "parcial";
        return true;
      });
    }

    if (tipoFiltro !== "todos") {
      list = list.filter((r) => r.tipo_stock === tipoFiltro);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.id_stock.toString().includes(q) ||
          (r.codigo_articulo?.toLowerCase().includes(q) ?? false) ||
          (r.material_nombre?.toLowerCase().includes(q) ?? false) ||
          (r.descripcion_material?.toLowerCase().includes(q) ?? false) ||
          (r.nota_entrega?.toLowerCase().includes(q) ?? false) ||
          (r.proveedor_nombre?.toLowerCase().includes(q) ?? false) ||
          r.ots.some((o) => o.ot_numero.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rows, mostrarPruebas, estadoFiltro, tipoFiltro, search]);

  const totales = useMemo(() => {
    let libres = 0;
    let reservadas = 0;
    let valoracion = 0;
    for (const r of filtered) {
      libres += r.cantidad_libre;
      reservadas += r.cantidad_reservada_total;
      if (r.cantidad_fisica > 0 && r.coste != null) valoracion += r.coste;
    }
    return { palets: filtered.length, libres, reservadas, valoracion };
  }, [filtered]);

  async function handlePrint(row: StockPaletAtpConOts) {
    const printWin = openCartelaPrintWindow(`Cartela-${row.id_stock}`);
    try {
      const otNums = row.ots.map((o) => o.ot_numero);
      const meta =
        otNums.length > 0
          ? await fetchOtMetadataMap(supabase, otNums)
          : {};
      const jobs = [
        {
          palet: atpToPaletPrint(row),
          copies: 1 as const,
          otTitulos: otTitulosFromMetadata(otNums, meta),
          proveedorNombre: row.proveedor_nombre ?? null,
        },
      ];
      if (printWin) {
        writeCartelasToWindow(printWin, jobs);
      } else if (!printCartelasWindow(jobs)) {
        toast.error(
          "No se pudo abrir la ventana de impresión. Permite ventanas emergentes."
        );
      }
    } catch {
      printWin?.close();
      toast.error("Error al preparar la cartela para imprimir.");
    }
  }

  async function handleImportFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("Solo se admiten archivos Excel (.xlsx).");
      return;
    }
    setImporting(true);
    try {
      const parsed = await parseStockOptimusFile(file);
      if (parsed.parseWarnings.length > 0) {
        toast.info(parsed.parseWarnings.slice(0, 3).join(" · "));
      }
      if (parsed.rows.length === 0) {
        toast.error("No hay filas válidas para importar.");
        return;
      }
      setImportPreview(parsed);
      setImportFileName(file.name);
      setImportOpen(true);
    } catch (e) {
      toast.error(
        `Error al leer Excel: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!importPreview?.rows.length) return;
    setImporting(true);
    try {
      const result = await executeStockOptimusImport(supabase, importPreview.rows, {
        deletePilotFirst: true,
      });
      toast.success(
        `Import OK: ${result.paletsInsertados} palets · ${result.otsInsertadas} OTs · ${result.pilotEliminados} piloto eliminadas`
      );
      setImportOpen(false);
      setImportPreview(null);
      setImportFileName(null);
      await load();
    } catch (e) {
      toast.error(
        `Error al importar: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147]">Stock de material</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Almacén · consulta por palet (ATP) · Ramón / Emma / Juan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStockAiOpen(true)}
            disabled={loading}
          >
            <Sparkles className="size-4 mr-2 text-[#C69C2B]" />
            Asistente IA
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            Importar Optimus
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Cabecera de totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Package className="size-4" />}
          label="Palets"
          value={totales.palets.toLocaleString("es-ES")}
        />
        <KpiCard
          icon={<Layers className="size-4" />}
          label="Hojas libres"
          value={totales.libres.toLocaleString("es-ES")}
          accent="text-emerald-700"
        />
        <KpiCard
          icon={<Boxes className="size-4" />}
          label="Hojas reservadas"
          value={totales.reservadas.toLocaleString("es-ES")}
          accent="text-blue-700"
        />
        <KpiCard
          icon={<Coins className="size-4" />}
          label="Valoración total"
          value={eur(totales.valoracion)}
          accent="text-[#C69C2B]"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <Input
            placeholder="ID Stock, código, material, OT, albarán, proveedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-9 text-sm"
          />
        </div>

        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {(
            [
              ["todos", "Todos"],
              ["sin_ot", "Sin OT"],
              ["libre", "Solo libre"],
              ["reservado", "Solo reservado"],
              ["parcial", "Parcial"],
            ] as [EstadoFiltro, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setEstadoFiltro(val)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                estadoFiltro === val
                  ? "bg-[#002147] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Select
          value={tipoFiltro}
          onValueChange={(v) => setTipoFiltro(v as StockTipo | "todos")}
        >
          <SelectTrigger className="h-9 text-sm w-[170px]">
            <SelectValue placeholder="Tipo de stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {(
              [
                "materia_prima",
                "semielaborado",
                "producto_terminado",
                "consumible",
              ] as StockTipo[]
            ).map((t) => (
              <SelectItem
                key={t}
                value={t}
                disabled={
                  tiposPresentes.length > 0 && !tiposPresentes.includes(t)
                }
              >
                {TIPO_STOCK_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
          <Checkbox
            checked={mostrarPruebas}
            onCheckedChange={(v) => setMostrarPruebas(v === true)}
          />
          Mostrar pruebas (≥99.000)
        </label>
      </div>

      <p className="text-xs text-slate-400">
        {loading
          ? "Cargando…"
          : `${filtered.length} palet${filtered.length !== 1 ? "s" : ""}`}
      </p>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Package className="size-8 mx-auto mb-2" />
          <p>
            {rows.length === 0
              ? "No hay palets de stock todavía. Se crean en Cartelas."
              : "Sin resultados con los filtros actuales."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">ID Stock</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Libre</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead>Ud.</TableHead>
                <TableHead className="text-right">Coste</TableHead>
                <TableHead>OT(s)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Albarán</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setDetalle(r)}
                >
                  <TableCell className="text-right font-black text-[#002147] tabular-nums">
                    {r.id_stock}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {r.codigo_articulo ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <span className="block truncate font-medium">
                      {r.material_nombre ?? r.descripcion_material ?? "—"}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {[
                        r.gramaje ? `${r.gramaje} gr` : null,
                        r.formato,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.ubicacion_fila ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 tabular-nums">
                    {r.cantidad_libre.toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="text-right text-blue-700 tabular-nums">
                    {r.cantidad_reservada_total > 0
                      ? r.cantidad_reservada_total.toLocaleString("es-ES")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.unidad}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {eur(r.coste)}
                  </TableCell>
                  <TableCell>
                    {r.ots.length === 0 ? (
                      <span className="text-xs text-emerald-600">libre</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {r.ots.map((o) => (
                          <Badge
                            key={o.ot_numero}
                            variant="secondary"
                            className="text-[11px] font-mono"
                          >
                            {o.ot_numero}
                            {o.cantidad_reservada != null &&
                            o.cantidad_reservada > 0
                              ? ` · ${o.cantidad_reservada.toLocaleString("es-ES")}`
                              : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${ESTADO_BADGE[r.estado_derivado]}`}
                    >
                      {ESTADO_LABEL[r.estado_derivado]}
                    </Badge>
                    {r.sobre_reservado && (
                      <TriangleAlert
                        className="size-3.5 text-amber-500 inline ml-1"
                        aria-label="Reservas superan el físico"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.nota_entrega ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[140px] truncate">
                    {r.proveedor_nombre ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Reimprimir cartela"
                      onClick={() => handlePrint(r)}
                    >
                      <Printer className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StockDetalleDialog
        row={detalle}
        onClose={() => setDetalle(null)}
        onPrint={handlePrint}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar stock Optimus</DialogTitle>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4 text-sm">
              <p className="text-slate-600">
                Archivo:{" "}
                <span className="font-mono text-xs">{importFileName}</span>
              </p>
              <p className="text-xs text-slate-500">
                {importPreview.filasLeidas} filas leídas ·{" "}
                {importPreview.totales.palets} palets válidos
                {importPreview.filasOmitidas > 0
                  ? ` · ${importPreview.filasOmitidas} omitidas`
                  : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border px-3 py-2">
                  <div className="text-xs text-slate-500">Palets</div>
                  <div className="font-bold text-lg">
                    {importPreview.totales.palets}
                  </div>
                </div>
                <div className="rounded border px-3 py-2">
                  <div className="text-xs text-slate-500">Valoración</div>
                  <div className="font-bold text-lg text-[#C69C2B]">
                    {eur(importPreview.totales.valoracion)}
                  </div>
                </div>
                <div className="rounded border px-3 py-2">
                  <div className="text-xs text-slate-500">Hojas libres</div>
                  <div className="font-bold text-emerald-700">
                    {importPreview.totales.hojasLibres.toLocaleString("es-ES")}
                  </div>
                </div>
                <div className="rounded border px-3 py-2">
                  <div className="text-xs text-slate-500">Hojas reservadas</div>
                  <div className="font-bold text-blue-700">
                    {importPreview.totales.hojasReservadas.toLocaleString(
                      "es-ES"
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Se eliminarán las cartelas piloto (#10310–#10320) y se
                importarán/actualizarán {importPreview.totales.palets} palets
                Optimus (Id &lt; 99.000). Las cartelas de prueba no se tocan.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  disabled={importing}
                >
                  Cancelar
                </Button>
                <Button onClick={() => void confirmImport()} disabled={importing}>
                  {importing && (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  )}
                  Confirmar import
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StockAiDialog
        open={stockAiOpen}
        onOpenChange={setStockAiOpen}
        rows={filtered}
        loadingStock={loading}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent = "text-[#002147]",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

function StockDetalleDialog({
  row,
  onClose,
  onPrint,
}: {
  row: StockPaletAtpConOts | null;
  onClose: () => void;
  onPrint: (row: StockPaletAtpConOts) => void;
}) {
  const [movs, setMovs] = useState<ProdStockMovimientoRow[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  useEffect(() => {
    if (!row) {
      setMovs([]);
      return;
    }
    let cancelled = false;
    setLoadingMovs(true);
    void (async () => {
      const { data } = await supabase
        .from("prod_stock_movimientos")
        .select("*")
        .eq("palet_id", row.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) {
        setMovs((data as ProdStockMovimientoRow[]) ?? []);
        setLoadingMovs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row]);

  if (!row) return null;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-black text-2xl text-[#002147]">
              #{row.id_stock}
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${ESTADO_BADGE[row.estado_derivado]}`}
            >
              {ESTADO_LABEL[row.estado_derivado]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium">
              {row.material_nombre ?? row.descripcion_material ?? "—"}
              {row.gramaje ? ` · ${row.gramaje} gr` : ""}
              {row.formato ? ` · ${row.formato}` : ""}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {row.codigo_articulo ? `Cód. ${row.codigo_articulo} · ` : ""}
              {TIPO_STOCK_LABEL[row.tipo_stock]}
              {row.es_fsc ? " · FSC" : ""}
              {row.es_pefc ? " · PEFC" : ""}
            </p>
          </div>

          {row.sobre_reservado && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="size-4 shrink-0 mt-0.5" />
              Las reservas duras ({row.cantidad_reservada_total.toLocaleString(
                "es-ES"
              )}{" "}
              h) superan el físico ({row.cantidad_fisica.toLocaleString("es-ES")}{" "}
              h). Revisar consumos/ajustes.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <DetalleCant
              label="Físicas"
              value={row.cantidad_fisica}
              accent="text-[#002147]"
            />
            <DetalleCant
              label="Reservadas"
              value={row.cantidad_reservada_total}
              accent="text-blue-700"
            />
            <DetalleCant
              label="Libres"
              value={row.cantidad_libre}
              accent="text-emerald-700"
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Campo label="Ubicación" value={row.ubicacion_fila} />
            <Campo label="Unidad" value={row.unidad} />
            <Campo label="Coste" value={eur(row.coste)} />
            <Campo label="Inicial" value={`${row.cantidad_inicial.toLocaleString("es-ES")} h`} />
            <Campo label="Albarán" value={row.nota_entrega} />
            <Campo label="Proveedor" value={row.proveedor_nombre ?? null} />
            <Campo label="Ref. lote" value={row.ref_lote} />
            <Campo label="Lote prov." value={row.ref_lote_proveedor} />
            <Campo
              label="Creada"
              value={row.created_at ? formatFechaEsCorta(row.created_at) : null}
            />
          </dl>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              OT(s) referenciadas
            </p>
            {row.ots.length === 0 ? (
              <p className="text-xs text-emerald-600">Stock libre (sin OT)</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {row.ots.map((o) => (
                  <Badge
                    key={o.ot_numero}
                    variant="secondary"
                    className="text-xs font-mono"
                  >
                    {o.ot_numero}
                    {o.cantidad_reservada != null && o.cantidad_reservada > 0
                      ? ` · ${o.cantidad_reservada.toLocaleString("es-ES")} h`
                      : " · blanda"}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              Últimos movimientos
            </p>
            {loadingMovs ? (
              <Loader2 className="size-4 animate-spin text-slate-400" />
            ) : movs.length === 0 ? (
              <p className="text-xs text-slate-400">
                Sin movimientos registrados para este palet.
              </p>
            ) : (
              <div className="space-y-1">
                {movs.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs border-b border-slate-100 py-1"
                  >
                    <span className="capitalize">{m.tipo}</span>
                    <span className="tabular-nums">
                      {m.cantidad.toLocaleString("es-ES")} h
                    </span>
                    <span className="text-slate-400">
                      {m.ot_numero ?? "—"}
                    </span>
                    <span className="text-slate-400">
                      {formatFechaEsCorta(m.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={() => onPrint(row)}>
              <Printer className="size-4 mr-2" />
              Reimprimir cartela
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetalleCant({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-md border bg-slate-50 py-2">
      <div className={`text-lg font-bold tabular-nums ${accent}`}>
        {value.toLocaleString("es-ES")}
      </div>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}
