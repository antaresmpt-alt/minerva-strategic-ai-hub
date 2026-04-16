import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import {
  clasesBadgeSemaforoOt,
  semaforoOtEntregaVariant,
  type OtsComprasUmbralesParametros,
} from "@/lib/sys-parametros-ots-compras";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { cn } from "@/lib/utils";

type OtNumeroSemaforoBadgeProps = {
  otNumero: string;
  fechaEntregaIso: string | null | undefined;
  umbrales: OtsComprasUmbralesParametros;
  className?: string;
};

/**
 * Nº OT en badge con semáforo por días hasta entrega; icono 💶 si sobrestock.
 */
export function OtNumeroSemaforoBadge({
  otNumero,
  fechaEntregaIso,
  umbrales,
  className,
}: OtNumeroSemaforoBadgeProps) {
  const d = diasDesdeHastaFecha(fechaEntregaIso);
  const variant = semaforoOtEntregaVariant(d, umbrales);
  const badgeCls = clasesBadgeSemaforoOt(variant);
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
      className={cn(
        "flex min-w-0 max-w-full items-center gap-0.5",
        className
      )}
      title={title}
    >
      <span
        className={cn(
          "box-border inline-flex h-6 min-h-6 min-w-0 max-w-full shrink-0 items-center justify-center truncate rounded-md px-2 font-mono text-[11px] font-normal tabular-nums leading-none antialiased",
          badgeCls
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
