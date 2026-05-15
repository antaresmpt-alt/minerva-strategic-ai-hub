"use client";

import {
  entregaPlazoSemaforo,
  entregaPlazoTitle,
  PLAZO_SEMAFORO_CLASS,
} from "@/lib/etiquetas-hoja-ruta-plazo";
import { cn } from "@/lib/utils";

type Props = {
  fechaEntregaOt: string | null | undefined;
  urgente?: boolean;
  className?: string;
};

/** Semáforo de plazo hasta entrega OT (rojo ≤4d, amarillo 5–14d, verde ≥15d). */
export function EntregaPlazoSemaforo({
  fechaEntregaOt,
  urgente = false,
  className,
}: Props) {
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
