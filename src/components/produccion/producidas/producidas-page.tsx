"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Ban,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProducidaSnapshotDialog } from "@/components/produccion/producidas/producida-snapshot-dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { fmtCantidad, fmtDate } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import { exportProducidasAExcel } from "@/lib/prod-ot-producidas-export";
import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

const PAGE_SIZE = 500;

const LIST_SELECT =
  "id, ot_numero, ot_id, referencia_id, referencia_minerva, referencia_cliente, cliente, trabajo, cantidad_pedida, cantidad_producida, material, gramaje, formato, tintas, troquel, poses, acabado_pral, tipo_engomado, codigo_caja_embalaje, estuches_por_bulto, fsc, fecha_inicio_real, fecha_fin_real, fecha_cierre, horas_prep_impresion_reales, horas_tiraje_impresion_reales, horas_prep_troquelado_reales, horas_tiraje_troquelado_reales, horas_prep_engomado_reales, horas_tiraje_engomado_reales, horas_guillotina_reales, horas_ctp_reales, horas_desbroce_reales, horas_total_reales, merma_total, snapshot, snapshot_version, version, cerrada_por, cerrada_at, observaciones_revision, excluido_de_promedios, motivo_exclusion, reabierta_desde_id, reabierta_at, reabierta_por, created_at";

export function ProducidasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProdOtProducidaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soloExcluidas, setSoloExcluidas] = useState(false);
  const [selected, setSelected] = useState<ProdOtProducidaRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all: ProdOtProducidaRow[] = [];
      let from = 0;
      while (true) {
        const { data, error: err } = await supabase
          .from("prod_ot_producidas")
          .select(LIST_SELECT)
          .order("cerrada_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (err) throw err;
        const batch = (data ?? []) as unknown as ProdOtProducidaRow[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setRows(all);
    } catch (e) {
      console.error("[Producidas] load", e);
      setError(errorMessageFromUnknown(e, "No se pudo cargar el histórico."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (soloExcluidas && !r.excluido_de_promedios) return false;
      if (!needle) return true;
      const hay = [
        r.ot_numero,
        r.cliente,
        r.trabajo,
        r.material,
        r.troquel,
        r.referencia_minerva,
        r.referencia_cliente,
        r.codigo_caja_embalaje,
        r.acabado_pral,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, soloExcluidas]);

  const openRow = (row: ProdOtProducidaRow) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const handleRowUpdated = (updated: ProdOtProducidaRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected(updated);
  };

  const handleExportExcel = () => {
    try {
      exportProducidasAExcel(filtered);
      toast.success(`Exportadas ${filtered.length} filas a Excel.`);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo exportar Excel."));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#002147]">
            <Archive className="size-5" />
            Producidas / Histórico
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            OTs cerradas con snapshot inmutable. Fuente para promedios del maestro (Bloque 6).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || filtered.length === 0}
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="mr-2 size-4" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label htmlFor="producidas-q" className="text-xs text-slate-600">
            Buscar
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="producidas-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="OT, cliente, material, troquel, referencia…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id="solo-excluidas"
            checked={soloExcluidas}
            onCheckedChange={(c) => setSoloExcluidas(c === true)}
          />
          <Label htmlFor="solo-excluidas" className="cursor-pointer text-sm text-slate-700">
            Solo excluidas de promedios
          </Label>
        </div>
        <p className="pb-2 text-xs text-slate-500">
          {filtered.length} de {rows.length} filas
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando histórico…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No hay OTs producidas{q || soloExcluidas ? " con estos filtros" : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">OT</th>
                  <th className="px-3 py-2">Cliente / Trabajo</th>
                  <th className="px-3 py-2 text-right">Pedida</th>
                  <th className="px-3 py-2 text-right">Producida</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Troquel</th>
                  <th className="px-3 py-2 text-right">Horas</th>
                  <th className="px-3 py-2">Cierre</th>
                  <th className="px-3 py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                    onClick={() => openRow(r)}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-[#002147]">
                      {r.ot_numero}
                      {r.version > 1 ? (
                        <span className="ml-1 text-[10px] font-normal text-slate-500">
                          v{r.version}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[280px] px-3 py-2">
                      <div className="truncate font-medium text-slate-800">
                        {r.cliente ?? "—"}
                      </div>
                      <div className="truncate text-xs text-slate-500">{r.trabajo ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtCantidad(r.cantidad_pedida)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmtCantidad(r.cantidad_producida)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {r.material ?? "—"}
                      {r.gramaje != null ? ` ${r.gramaje}g` : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.troquel ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {r.horas_total_reales != null ? `${r.horas_total_reales}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {fmtDate(r.cerrada_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.excluido_de_promedios ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                            title={r.motivo_exclusion ?? "Excluida de promedios"}
                          >
                            <Ban className="size-3" />
                            Excl.
                          </span>
                        ) : null}
                        {r.reabierta_at ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                            <RotateCcw className="size-3" />
                            Reab.
                          </span>
                        ) : null}
                        {!r.excluido_de_promedios && !r.reabierta_at ? (
                          <span className="text-[10px] text-slate-400">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProducidaSnapshotDialog
        row={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRowUpdated={handleRowUpdated}
      />
    </div>
  );
}
