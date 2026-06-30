"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  CTP_REQUISITO_DEFS,
  ctpRequisitosPendientes,
  listCtpRequisitosEstado,
  type CtpRequisitoHechoKey,
} from "@/lib/ctp-despacho";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import { cn } from "@/lib/utils";

type CtpEjecucionRequisitosBlockProps = {
  datos: DatosProcesoGenerico;
  onDatosChange: (datos: DatosProcesoGenerico) => void;
  readonly?: boolean;
  compact?: boolean;
};

export function CtpEjecucionRequisitosBlock({
  datos,
  onDatosChange,
  readonly = false,
  compact = false,
}: CtpEjecucionRequisitosBlockProps) {
  const estados = listCtpRequisitosEstado(datos);
  const pendientes = ctpRequisitosPendientes(datos);
  const hayRequeridos = estados.some((e) => e.requerido);

  const toggleHecho = (hechoKey: CtpRequisitoHechoKey, checked: boolean) => {
    if (readonly) return;
    const next = { ...datos };
    if (checked) {
      next[hechoKey] = true;
    } else {
      delete next[hechoKey];
    }
    onDatosChange(next);
  };

  if (compact) {
    const chips = estados.filter((e) => e.requerido || e.hecho);
    if (chips.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {chips.map((e) => (
          <span
            key={e.hechoKey}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              e.requerido
                ? e.hecho
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
                : e.hecho
                  ? "bg-slate-200 text-slate-800"
                  : "bg-slate-100 text-slate-600",
            )}
          >
            {e.hecho ? (
              <CheckCircle2 className="size-3" aria-hidden />
            ) : e.requerido ? (
              <AlertTriangle className="size-3" aria-hidden />
            ) : null}
            {e.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold text-[#002147]">
          Tareas CTP
        </p>
        <p className="text-[11px] text-slate-600">
          Lo sombreado es lo pedido al despachar. Puedes marcar también otras
          tareas si surgen durante el trabajo (FSC, retoque, etc.).
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {CTP_REQUISITO_DEFS.map((def) => {
          const estado = estados.find((e) => e.hechoKey === def.hechoKey)!;
          const id = `ctp-req-${def.hechoKey}`;
          return (
            <label
              key={def.hechoKey}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                estado.requerido
                  ? estado.hecho
                    ? "border-emerald-300 bg-emerald-50/90 shadow-sm"
                    : "border-amber-300 bg-amber-50/80 shadow-sm"
                  : estado.hecho
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50/50",
                readonly && "cursor-default opacity-80",
              )}
            >
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={estado.hecho}
                disabled={readonly}
                onCheckedChange={(v) => toggleHecho(def.hechoKey, v === true)}
              />
              <span>
                <span className="font-medium text-slate-800">{def.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[10px]",
                    estado.requerido
                      ? estado.hecho
                        ? "text-emerald-700"
                        : "text-amber-800"
                      : estado.hecho
                        ? "text-slate-600"
                        : "text-slate-400",
                  )}
                >
                  {estado.requerido
                    ? estado.hecho
                      ? "Hecho (pedido en despacho)"
                      : "Pendiente — pedido en despacho"
                    : estado.hecho
                      ? "Hecho (adicional)"
                      : "Opcional"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {hayRequeridos ? (
        pendientes.length > 0 ? (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {pendientes.length} tarea{pendientes.length !== 1 ? "s" : ""} pedida
            {pendientes.length !== 1 ? "s" : ""} en despacho sin confirmar al
            cerrar.
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-800">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Todas las tareas pedidas en despacho están confirmadas.
          </p>
        )
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          Sin tareas marcadas en despacho. Marca aquí lo que hagáis en CTP.
        </p>
      )}
    </div>
  );
}

export function CtpEjecucionRequisitosChips(props: CtpEjecucionRequisitosBlockProps) {
  return <CtpEjecucionRequisitosBlock {...props} compact />;
}
