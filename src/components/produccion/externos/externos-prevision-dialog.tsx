"use client";

import { FileDown, Loader2, Telescope } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { HojaRutaOtDialog } from "@/components/produccion/hoja-ruta/hoja-ruta-ot-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { printElementInNewWindow } from "@/lib/calendario-detalle-dia-print";
import {
  fetchExternosPrevision,
  summarizeExternosPrevision,
  type ExternoPrevisionRow,
} from "@/lib/externos-prevision";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

const STEP_BADGE_STYLES: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-700",
  disponible: "bg-blue-100 text-blue-800",
  en_marcha: "bg-amber-100 text-amber-800",
  pausado: "bg-orange-100 text-orange-800",
  finalizado: "bg-emerald-100 text-emerald-800",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: SupabaseClient;
  queueOtNumeros: readonly string[];
  onCountChange?: (count: number) => void;
};

export function ExternosPrevisionDialog({
  open,
  onOpenChange,
  supabase,
  queueOtNumeros,
  onCountChange,
}: Props) {
  const [rows, setRows] = useState<ExternoPrevisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOt, setDetailOt] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExternosPrevision(supabase, queueOtNumeros);
      setRows(data);
      onCountChange?.(data.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "No se pudo cargar la previsión de externos.");
      setRows([]);
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [supabase, queueOtNumeros, onCountChange]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const summary = useMemo(() => summarizeExternosPrevision(rows), [rows]);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const ok = printElementInNewWindow(
      el,
      "Previsión faenas externas",
      `@media print { body { font-size: 11px; } }`,
    );
    if (!ok) toast.error("No se pudo abrir la ventana de impresión.");
  };

  return (
    <>
      <HojaRutaOtDialog
        otNumero={detailOt}
        open={detailOt != null}
        onOpenChange={(o) => {
          if (!o) setDetailOt(null);
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,52rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="externos-prevision-print-hide border-b px-4 py-3 pr-12">
            <DialogTitle className="flex items-center gap-2 text-[#002147]">
              <Telescope className="size-5 shrink-0 opacity-90" aria-hidden />
              Previsión faenas externas
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              OTs despachadas en curso con paso externo pendiente{" "}
              <strong>más adelante</strong> en el itinerario (no aparecen en la
              cola de arriba). Orden: más cercanas primero.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Cargando previsión…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No hay OTs en camino hacia un externo fuera de la cola actual.
              </p>
            ) : (
              <div ref={printRef} className="externos-prevision-print-root space-y-3">
                <div className="hidden print:block">
                  <h1 className="text-lg font-bold text-[#002147]">
                    Previsión faenas externas — Minerva
                  </h1>
                  <p className="text-xs text-slate-600">
                    Generado{" "}
                    {new Date().toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {summary.total} OT{summary.total === 1 ? "" : "s"} en camino
                  </p>
                </div>

                <p className="text-[11px] text-slate-600 print:text-[10px]">
                  A 1 paso: {summary.a1} · A 2+ pasos: {summary.a2Plus}
                </p>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/90">
                        <TableHead className="whitespace-nowrap px-2">OT</TableHead>
                        <TableHead className="px-2">Cliente</TableHead>
                        <TableHead className="min-w-[8rem] px-2">Trabajo</TableHead>
                        <TableHead className="whitespace-nowrap px-2 text-right">
                          Cant.
                        </TableHead>
                        <TableHead className="whitespace-nowrap px-2">
                          Entrega
                        </TableHead>
                        <TableHead className="px-2">Paso actual</TableHead>
                        <TableHead className="px-2">Próx. externo</TableHead>
                        <TableHead className="whitespace-nowrap px-2 text-center">
                          (N)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.otNumero}>
                          <TableCell className="whitespace-nowrap px-2 py-1.5">
                            <button
                              type="button"
                              className="font-mono text-sm font-semibold text-[#002147] underline-offset-2 hover:underline"
                              onClick={() => setDetailOt(row.otNumero)}
                            >
                              {row.otNumero}
                            </button>
                          </TableCell>
                          <TableCell className="max-w-[8rem] truncate px-2 py-1.5 text-xs">
                            {row.cliente?.trim() || "—"}
                          </TableCell>
                          <TableCell
                            className="max-w-[12rem] truncate px-2 py-1.5 text-xs"
                            title={row.trabajo ?? ""}
                          >
                            {row.trabajo?.trim() || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums">
                            {row.cantidad != null
                              ? Number(row.cantidad).toLocaleString("es-ES")
                              : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 py-1.5 text-xs">
                            {formatFechaEsCorta(row.fechaEntrega)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-xs">
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span className="max-w-[7rem] truncate">
                                {row.pasoActualNombre?.trim() || "—"}
                              </span>
                              {row.pasoActualEstado ? (
                                <span
                                  className={cn(
                                    "rounded px-1 py-0.5 text-[9px] font-semibold uppercase",
                                    STEP_BADGE_STYLES[row.pasoActualEstado] ??
                                      "bg-slate-100 text-slate-700",
                                  )}
                                >
                                  {row.pasoActualEstado.replace("_", " ")}
                                </span>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[9rem] truncate px-2 py-1.5 text-xs">
                            {row.proximoExternoNombre?.trim() || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 py-1.5 text-center font-mono text-sm font-semibold tabular-nums text-[#002147]">
                            ({row.pasosHastaExterno})
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="externos-prevision-print-hide border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || rows.length === 0}
              onClick={handlePrint}
            >
              <FileDown className="size-4" aria-hidden />
              <span className="ml-2">Imprimir</span>
            </Button>
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
