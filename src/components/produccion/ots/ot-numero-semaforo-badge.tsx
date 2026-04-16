import { diasDesdeHastaFecha } from "@/lib/compras-material-prioridad";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import {
  clasesPuntoSemaforoOt,
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
  /**
   * - `soft`: etiqueta muy suave (maestro, compras, despachadas, muelle).
   * - `externos-inline`: punto de color + nº OT en texto sobre fondo de celda (Gestión Externos).
   */
  appearance?: "soft" | "externos-inline";
};

/**
 * Nº OT con semáforo por días hasta entrega (sin pastillas sólidas intrusivas).
 */
export function OtNumeroSemaforoBadge({
  otNumero,
  fechaEntregaIso,
  umbrales,
  className,
  appearance = "soft",
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

  if (appearance === "externos-inline") {
    return (
      <div
        className={cn(
          "flex min-w-0 max-w-full items-center justify-start gap-1.5",
          className
        )}
        title={title}
      >
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            clasesPuntoSemaforoOt(variant)
          )}
          aria-hidden
        />
        <span className="truncate font-mono text-[11px] font-normal tabular-nums text-slate-800">
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

  return (
    <div
      className={cn("flex min-w-0 max-w-full items-center gap-0.5", className)}
      title={title}
    >
      <span
        className={cn(
          "inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 font-mono text-[11px] font-normal tabular-nums leading-snug",
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
