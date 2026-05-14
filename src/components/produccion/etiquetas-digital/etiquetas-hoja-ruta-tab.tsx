"use client";

import { Loader2, Pencil, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EtiquetasEntradaExpressDialog } from "@/components/produccion/etiquetas-digital/etiquetas-entrada-express-dialog";
import { EtiquetasHojaRutaEditDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-edit-dialog";

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
  exportEtiquetasHojaRutaExcel,
  exportEtiquetasHojaRutaPdf,
} from "@/lib/etiquetas-hoja-ruta-export";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import { cn } from "@/lib/utils";

const TABLE = "prod_etiquetas_hoja_ruta";

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

function boolCell(v: boolean) {
  return v ? "Sí" : "—";
}

export function EtiquetasHojaRutaTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProdEtiquetasHojaRutaRow[]>([]);
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

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("No se pudo cargar la hoja de ruta", {
        description: error.message,
      });
      setRows([]);
      return;
    }
    setRows((data ?? []) as ProdEtiquetasHojaRutaRow[]);
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const papelesUnicos = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const p = (r.papel ?? "").trim();
      if (p) s.add(p);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

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

  const handleExportExcel = useCallback(() => {
    if (filtradas.length === 0) {
      toast.message("Sin datos", {
        description: "No hay filas que coincidan con los filtros actuales.",
      });
      return;
    }
    exportEtiquetasHojaRutaExcel(filtradas, exportFilters);
  }, [filtradas, exportFilters]);

  const handleExportPdf = useCallback(() => {
    if (filtradas.length === 0) {
      toast.message("Sin datos", {
        description: "No hay filas que coincidan con los filtros actuales.",
      });
      return;
    }
    exportEtiquetasHojaRutaPdf(filtradas, exportFilters);
  }, [filtradas, exportFilters]);

  return (
    <div className="flex w-full min-w-0 max-w-[100vw] flex-col gap-3">
      <EtiquetasEntradaExpressDialog
        open={expressOpen}
        onOpenChange={setExpressOpen}
        onSaved={() => void loadRows()}
      />
      <EtiquetasHojaRutaEditDialog
        open={editingRow != null}
        onOpenChange={(o) => {
          if (!o) setEditingRow(null);
        }}
        row={editingRow}
        onSaved={() => void loadRows()}
      />
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
            title="Listado actual (filtros aplicados)"
          >
            Exportar Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            title="Listado actual (filtros aplicados)"
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

      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200/90 bg-white/90 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
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
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <Alert className="border-slate-200 bg-slate-50/90">
          <AlertTitle>Sin filas</AlertTitle>
          <AlertDescription className="text-sm">
            {rows.length === 0
              ? "Aún no hay registros en la hoja de ruta. Usa «Entrada express» (cuando esté activo) o inserta desde planificación."
              : "Ninguna fila coincide con los filtros. Prueba a limpiar búsqueda o mostrar finalizadas."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-sm">
          <Table className="min-w-[1100px] text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
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
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  Urg.
                </TableHead>
                <TableHead className="min-w-[6rem] font-semibold text-[#002147]">
                  Kon / Troq / Num
                </TableHead>
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
                    "border-slate-100"
                  )}
                >
                  <TableCell className="w-10 px-1 text-center align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-[#002147] hover:bg-slate-100"
                      aria-label={`Editar OT ${r.ot_numero}`}
                      onClick={() => setEditingRow(r)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium text-[#002147]">
                    {r.ot_numero}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate" title={r.cliente ?? ""}>
                    {r.cliente ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate" title={r.trabajo ?? ""}>
                    {r.trabajo ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[8rem] truncate" title={r.papel ?? ""}>
                    {r.papel ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.cantidad != null ? String(r.cantidad) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {fmtDate(r.fecha_entrega_ot)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {fmtDate(r.fecha_entrada_depto)}
                  </TableCell>
                  <TableCell>{r.urgencia === "urgente" ? "Urg." : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-[10px] text-slate-600">
                    {boolCell(r.konica)} / {boolCell(r.troqueladora)} /{" "}
                    {boolCell(r.numeradora)}
                  </TableCell>
                  <TableCell className="max-w-[4rem] truncate">
                    {r.troquel_utillaje ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-[10px]">
                    {fmtDate(r.fecha_inicio_produccion)} /{" "}
                    {fmtDate(r.fecha_fin_produccion)}
                  </TableCell>
                  <TableCell className="text-right text-[10px] tabular-nums text-slate-700">
                    {r.cajas ?? "—"} / {r.bobinas ?? "—"} / {r.etiquetas ?? "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[8rem] truncate text-[10px]"
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
