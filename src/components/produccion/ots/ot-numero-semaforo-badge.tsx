import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import {
  clasesSemaforoOtSuave,
  semaforoOtEntregaVariant,
  type OtsComprasUmbralesParametros,
} from "@/lib/sys-parametros-ots-compras";
import { cn } from "@/lib/utils";

type OtNumeroSemaforoBadgeProps = {
  otNumero: string;
  fechaEntregaIso: string | null | undefined;
  umbrales: OtsComprasUmbralesParametros;
  className?: string;
};

/**
 * Nº OT con semáforo por días hasta entrega: pastilla suave (Maestro, Compras,
 * Externos, Muelle, Despachadas).
 */
export function OtNumeroSemaforoBadge({
  otNumero,
  fechaEntregaIso,
  umbrales,
  className,
}: OtNumeroSemaforoBadgeProps) {
  const d = diasDesdeHastaFecha(fechaEntregaIso);
  const variant = semaforoOtEntregaVariant(d, umbrales);
  const sobrestock =
    d !== null && Number.isFinite(d) && d > umbrales.sobrestockUmbral;
  const title =
    fechaEntregaIso?.trim() && d !== null
      ? `Entrega OT: ${formatFechaEsCorta(fechaEntregaIso)} · ${d} días`
      : fechaEntregaIso?.trim()
        ? `Entrega OT: ${formatFechaEsCorta(fechaEntregaIso)}`
        : "Sin fecha de entrega";

  return (
    <div
      className={cn("flex min-w-0 max-w-full items-center gap-0.5", className)}
      title={title}
    >
      <span
        className={cn(
          "inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 font-mono text-sm font-medium tabular-nums leading-snug",
          clasesSemaforoOtSuave(variant)
        )}
      >
        {otNumero}
      </span>
      {sobrestock ? (
        <span
          className="shrink-0 text-[13px] leading-none"
          role="img"
          aria-label="Sobrestock: entrega muy lejana"
        >
          💶
        </span>
      ) : null}
    </div>
  );
}
