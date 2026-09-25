"use client";

import { Check, Loader2 } from "lucide-react";

import type { MaquinaHojaRutaField } from "@/lib/etiquetas-hoja-ruta-maquina";
import { cn } from "@/lib/utils";

export const MAQUINA_PASOS: {
  field: MaquinaHojaRutaField;
  label: string;
  title: string;
}[] = [
  { field: "konica", label: "I", title: "Impresión (Konica)" },
  { field: "troqueladora", label: "T", title: "Troquelado" },
  { field: "numeradora", label: "N", title: "Numerado" },
];

type Props = {
  rowId: string;
  konica: boolean;
  troqueladora: boolean;
  numeradora: boolean;
  togglingMaquina: string | null;
  onToggle: (field: MaquinaHojaRutaField, next: boolean) => void;
  /** «Hoy» por proceso (sesión sin cerrar). */
  hoyByField?: Partial<Record<MaquinaHojaRutaField, boolean>>;
  enCursoByField?: Partial<Record<MaquinaHojaRutaField, boolean>>;
  togglingHoy?: string | null;
  onToggleHoy?: (field: MaquinaHojaRutaField, next: boolean) => void;
  className?: string;
};

export function EtiquetasHojaRutaMaquinaButtons({
  rowId,
  konica,
  troqueladora,
  numeradora,
  togglingMaquina,
  onToggle,
  hoyByField,
  enCursoByField,
  togglingHoy,
  onToggleHoy,
  className,
}: Props) {
  const values = { konica, troqueladora, numeradora };
  const showHoy = typeof onToggleHoy === "function";

  return (
    <div
      className={cn("grid grid-cols-3 gap-2", className)}
      role="group"
      aria-label="Pasos de producción"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {MAQUINA_PASOS.map(({ field, label, title }) => {
        const checked = values[field];
        const busy = togglingMaquina === `${rowId}:${field}`;
        const hoyOn = Boolean(hoyByField?.[field]);
        const enCurso = Boolean(enCursoByField?.[field]);
        const hoyBusy = togglingHoy === `${rowId}:${field}`;
        return (
          <div
            key={field}
            className={cn(
              "flex flex-col gap-1 rounded-lg",
              enCurso && "bg-orange-50/90 ring-1 ring-orange-200/80"
            )}
          >
            <button
              type="button"
              disabled={busy}
              title={title}
              aria-label={`${title}${checked ? " — hecho" : ""}`}
              aria-pressed={checked}
              className={cn(
                "flex min-h-[3rem] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1 text-sm font-bold transition-colors",
                checked
                  ? "border-[#C69C2B]/60 bg-[#002147] text-white shadow-sm"
                  : "border-slate-200 bg-white text-[#002147] hover:border-[#002147]/30 hover:bg-slate-50",
                busy && "opacity-60"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(field, !checked);
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {label}
              </span>
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : checked ? (
                <Check className="size-5" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className="size-5" aria-hidden />
              )}
            </button>
            {showHoy ? (
              <button
                type="button"
                disabled={hoyBusy || checked}
                title={
                  checked
                    ? "Proceso ya terminado"
                    : hoyOn
                      ? "Quitar «Hoy» (trabajé este proceso hoy)"
                      : "Marcar «Hoy»: trabajé este proceso hoy sin terminarlo"
                }
                aria-label={`${title} — Hoy`}
                aria-pressed={hoyOn}
                className={cn(
                  "min-h-8 touch-manipulation rounded-md border px-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  hoyOn
                    ? "border-orange-400 bg-orange-100 text-orange-950"
                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50",
                  (hoyBusy || checked) && "opacity-50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (checked) return;
                  onToggleHoy?.(field, !hoyOn);
                }}
              >
                {hoyBusy ? (
                  <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden />
                ) : (
                  "Hoy"
                )}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
