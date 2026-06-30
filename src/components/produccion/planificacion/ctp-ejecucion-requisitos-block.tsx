"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  CTP_REQUISITO_DEFS,
  ctpRequisitosPendientes,
  ctpRequisitosRequeridos,
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
  const requeridos = ctpRequisitosRequeridos(datos);
  const pendientes = ctpRequisitosPendientes(datos);

  if (requeridos.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600",
          compact && "py-1.5",
        )}
      >
        Sin instrucciones CTP marcadas en despacho. Si la OT es anterior al
        wizard, redespacha o marca requisitos en datos del proceso.
      </div>
    );
  }

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
    return (
      <div className="flex flex-wrap gap-1">
        {requeridos.map((r) => (
          <span
            key={r.hechoKey}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              r.hecho
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900",
            )}
          >
            {r.hecho ? (
              <CheckCircle2 className="size-3" aria-hidden />
            ) : (
              <AlertTriangle className="size-3" aria-hidden />
            )}
            {r.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold text-[#002147]">
          Instrucciones CTP (despacho)
        </p>
        <p className="text-[11px] text-slate-600">
          Marca cada tarea como hecha al completarla. Solo se exige lo marcado al
          despachar.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {CTP_REQUISITO_DEFS.map((def) => {
          const estado = requeridos.find((r) => r.hechoKey === def.hechoKey);
          if (!estado) return null;
          const id = `ctp-req-${def.hechoKey}`;
          return (
            <label
              key={def.hechoKey}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                estado.hecho
                  ? "border-emerald-200 bg-emerald-50/80"
                  : "border-amber-200 bg-white",
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
                    estado.hecho ? "text-emerald-700" : "text-amber-800",
                  )}
                >
                  {estado.hecho ? "Hecho" : "Pendiente de confirmar"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {pendientes.length > 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {pendientes.length} tarea{pendientes.length !== 1 ? "s" : ""} pendiente
          {pendientes.length !== 1 ? "s" : ""} de confirmar al cerrar.
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-800">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Todas las tareas requeridas están confirmadas.
        </p>
      )}
    </div>
  );
}

export function CtpEjecucionRequisitosChips(props: CtpEjecucionRequisitosBlockProps) {
  return <CtpEjecucionRequisitosBlock {...props} compact />;
}
