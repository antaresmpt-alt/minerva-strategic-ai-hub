"use client";

import { Archive, Ban } from "lucide-react";

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
  HojaRutaHeader,
  HojaRutaPasosDetail,
} from "@/components/produccion/hoja-ruta/hoja-ruta-ot-view";
import { fmtCantidad, fmtDate } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type { HojaRutaData } from "@/lib/hoja-ruta/hoja-ruta-query";
import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

function parseSnapshot(raw: unknown): HojaRutaData | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.pasos)) return null;
  return raw as HojaRutaData;
}

export function ProducidaSnapshotDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ProdOtProducidaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const snapshot = row ? parseSnapshot(row.snapshot) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94vh,880px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <Archive className="size-4 text-emerald-700" />
            Producida · OT{" "}
            <span className="font-mono text-sm font-semibold text-[#002147]">
              {row?.ot_numero ?? ""}
            </span>
            {row?.version != null ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                v{row.version}
              </span>
            ) : null}
            {row?.excluido_de_promedios ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                <Ban className="size-3" />
                Excluida de promedios
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Snapshot inmutable del cierre
            {row?.cerrada_at ? ` · ${fmtDate(row.cerrada_at)}` : ""}. Solo lectura.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {!row ? (
            <p className="py-8 text-center text-sm text-slate-500">Sin datos.</p>
          ) : (
            <div className="space-y-4">
              {/* Resumen columnas planas */}
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-slate-700">
                <p className="mb-2 text-[11px] font-semibold text-emerald-900">
                  Datos indexados (columnas planas)
                </p>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-slate-500">Cant. pedida:</span>{" "}
                    <span className="font-medium">{fmtCantidad(row.cantidad_pedida)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cant. producida:</span>{" "}
                    <span className="font-medium">{fmtCantidad(row.cantidad_producida)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Horas total:</span>{" "}
                    <span className="font-medium">
                      {row.horas_total_reales != null ? `${row.horas_total_reales} h` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Impresión prep/tiraje:</span>{" "}
                    <span className="font-medium">
                      {row.horas_prep_impresion_reales ?? "—"} /{" "}
                      {row.horas_tiraje_impresion_reales ?? "—"} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Troquel prep/tiraje:</span>{" "}
                    <span className="font-medium">
                      {row.horas_prep_troquelado_reales ?? "—"} /{" "}
                      {row.horas_tiraje_troquelado_reales ?? "—"} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">CTP / Guillo / Desbroce:</span>{" "}
                    <span className="font-medium">
                      {row.horas_ctp_reales ?? "—"} / {row.horas_guillotina_reales ?? "—"} /{" "}
                      {row.horas_desbroce_reales ?? "—"} h
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Embalaje:</span>{" "}
                    <span className="font-medium">
                      {row.codigo_caja_embalaje ?? "—"}
                      {row.estuches_por_bulto != null
                        ? ` · ${row.estuches_por_bulto} un/bulto`
                        : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Merma hojas:</span>{" "}
                    <span className="font-medium">{fmtCantidad(row.merma_total)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Referencia:</span>{" "}
                    <span className="font-medium">
                      {row.referencia_minerva ?? "—"}
                      {row.referencia_cliente ? ` / ${row.referencia_cliente}` : ""}
                    </span>
                  </div>
                </div>
                {row.observaciones_revision ? (
                  <p className="mt-2 border-t border-emerald-100 pt-2 text-slate-600">
                    <span className="font-medium">Obs. revisión:</span>{" "}
                    {row.observaciones_revision}
                  </p>
                ) : null}
                {row.excluido_de_promedios && row.motivo_exclusion ? (
                  <p className="mt-1 text-amber-800">
                    <span className="font-medium">Motivo exclusión:</span> {row.motivo_exclusion}
                  </p>
                ) : null}
              </div>

              {snapshot ? (
                <>
                  <HojaRutaHeader data={snapshot} />
                  <HojaRutaPasosDetail data={snapshot} showProximamente={false} />
                </>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  El snapshot no tiene el formato esperado de hoja de ruta.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-5">
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001a38]"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
