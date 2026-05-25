"use client";

import { AlertTriangle, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string;
  existentes: ProdEtiquetasHojaRutaRow[];
  onAbrirExistente: (row: ProdEtiquetasHojaRutaRow) => void;
  onCancelar: () => void;
};

function fmtDateEs(iso: string | null | undefined): string {
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
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function EtiquetasHojaRutaDuplicadoDialog({
  open,
  onOpenChange,
  otNumero,
  existentes,
  onAbrirExistente,
  onCancelar,
}: Props) {
  const n = existentes.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-[#002147]">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden />
            OT ya en hoja de ruta
          </DialogTitle>
          <DialogDescription className="text-sm">
            La OT <span className="font-mono font-semibold">{otNumero}</span> ya
            está en hoja de ruta ({n} fila{n === 1 ? "" : "s"}). Para evitar
            duplicados, abre la existente y edítala.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
          {existentes.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2 text-xs"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[#002147]">
                    {r.ot_numero}
                  </span>
                  {r.finalizado ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Finalizada
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Activa
                    </span>
                  )}
                  {r.urgencia === "urgente" ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                      Urgente
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-slate-700" title={r.cliente ?? ""}>
                  <span className="text-slate-500">Cliente:</span>{" "}
                  {r.cliente?.trim() || "—"}
                </p>
                <p className="truncate text-slate-700" title={r.trabajo ?? ""}>
                  <span className="text-slate-500">Trabajo:</span>{" "}
                  {r.trabajo?.trim() || "—"}
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-500">Entrada depto.:</span>{" "}
                  {fmtDateEs(r.fecha_entrada_depto)}
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="shrink-0 gap-1.5 bg-[#002147]"
                onClick={() => onAbrirExistente(r)}
              >
                <Pencil className="size-3.5" aria-hidden />
                Abrir
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onCancelar();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
