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
  className?: string;
};

export function EtiquetasHojaRutaMaquinaButtons({
  rowId,
  konica,
  troqueladora,
  numeradora,
  togglingMaquina,
  onToggle,
  className,
}: Props) {
  const values = { konica, troqueladora, numeradora };

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
        return (
          <button
            key={field}
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
        );
      })}
    </div>
  );
}
