"use client";

import { CheckCircle2 } from "lucide-react";

import {
  entregaPlazoSemaforo,
  entregaPlazoTitle,
  PLAZO_SEMAFORO_CLASS,
} from "@/lib/etiquetas-hoja-ruta-plazo";
import { cn } from "@/lib/utils";

type Props = {
  fechaEntregaOt: string | null | undefined;
  urgente?: boolean;
  finalizado?: boolean;
  className?: string;
};

/** Semáforo de plazo hasta entrega OT (rojo ≤4d, amarillo 5–14d, verde ≥15d). */
export function EntregaPlazoSemaforo({
  fechaEntregaOt,
  urgente = false,
  finalizado = false,
  className,
}: Props) {
  if (finalizado) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        title="Trabajo finalizado"
      >
        <CheckCircle2
          className="size-4 shrink-0 text-emerald-600"
          strokeWidth={3}
          aria-hidden
        />
        <span className="sr-only">Trabajo finalizado</span>
      </span>
    );
  }

  const nivel = entregaPlazoSemaforo(fechaEntregaOt);
  const title = entregaPlazoTitle(fechaEntregaOt);
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      title={urgente ? `${title} · Marcada urgente` : title}
    >
      <span
        className={cn(
          "size-3 shrink-0 rounded-full",
          PLAZO_SEMAFORO_CLASS[nivel],
          urgente && nivel !== "rojo" && "ring-2 ring-red-300"
        )}
        aria-hidden
      />
      <span className="sr-only">{title}</span>
    </span>
  );
}
