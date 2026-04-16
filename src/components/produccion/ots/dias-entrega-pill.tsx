"use client";

import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import {
  clasesBadgeSemaforoOt,
  semaforoOtEntregaVariant,
  type OtsComprasUmbralesParametros,
} from "@/lib/sys-parametros-ots-compras";
import { cn } from "@/lib/utils";

/** Misma caja que el badge de OT: alineación estable en tablas. */
const PILL_FIXED =
  "box-border inline-flex h-6 w-16 min-w-[65px] max-w-16 shrink-0 items-center justify-center overflow-hidden rounded-md font-mono text-[11px] font-normal tabular-nums leading-none antialiased";

type DiasEntregaPillProps = {
  fechaEntregaIso: string | null | undefined;
  umbrales: OtsComprasUmbralesParametros;
  className?: string;
};

/**
 * Días naturales hasta entrega OT, misma paleta semáforo que el badge de OT.
 */
export function DiasEntregaPill({
  fechaEntregaIso,
  umbrales,
  className,
}: DiasEntregaPillProps) {
  const days = diasDesdeHastaFecha(fechaEntregaIso);
  const tooltipLabel = fechaEntregaIso?.trim()
    ? `Entrega OT: ${formatFechaEsCorta(fechaEntregaIso)}`
    : "Sin fecha de entrega en maestro";
  const title =
    days !== null && fechaEntregaIso?.trim()
      ? `${tooltipLabel} · ${days} días`
      : tooltipLabel;

  if (!fechaEntregaIso?.trim() || days === null) {
    return (
      <span
        className={cn(PILL_FIXED, clasesBadgeSemaforoOt("sin_fecha"), className)}
        title={title}
      >
        —
      </span>
    );
  }

  const variant = semaforoOtEntregaVariant(days, umbrales);
  return (
    <span
      className={cn(PILL_FIXED, clasesBadgeSemaforoOt(variant), className)}
      title={title}
    >
      {days}
    </span>
  );
}

type DiasExternoVentanaPillProps = {
  /** Días entre envío y fecha prevista (externo); null → "—". */
  dias: number | null;
  className?: string;
};

/**
 * Días en circuito externo: misma geometría que {@link DiasEntregaPill}, tono neutro.
 */
export function DiasExternoVentanaPill({
  dias,
  className,
}: DiasExternoVentanaPillProps) {
  return (
    <span
      className={cn(
        PILL_FIXED,
        dias != null
          ? "bg-slate-600 text-white"
          : clasesBadgeSemaforoOt("sin_fecha"),
        className
      )}
      title={
        dias != null
          ? `Días en externo (envío → previsto): ${dias}`
          : "Sin fechas de envío o prevista"
      }
    >
      {dias != null ? dias : "—"}
    </span>
  );
}
