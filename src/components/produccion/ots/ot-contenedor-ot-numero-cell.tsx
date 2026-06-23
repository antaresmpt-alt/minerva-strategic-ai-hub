"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { formatOtContenedorHijaSubtitle } from "@/lib/ots-contenedor-display";
import type { OtContenedorDisplayFields } from "@/lib/ots-contenedor-display";
import type { PlanificacionOtTipoFiltroUi } from "@/lib/planificacion-contenedor-query";
import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import { cn } from "@/lib/utils";

type Props = {
  otNumero: string;
  fechaEntregaIso?: string | null;
  umbrales: OtsComprasUmbralesParametros;
  display: OtContenedorDisplayFields;
  otTipoFilter: PlanificacionOtTipoFiltroUi;
  expanded?: boolean;
  loadingExpand?: boolean;
  onToggleExpand?: () => void;
  titulo?: string | null;
};

export function OtContenedorOtNumeroCell({
  otNumero,
  fechaEntregaIso,
  umbrales,
  display,
  otTipoFilter,
  expanded,
  loadingExpand,
  onToggleExpand,
  titulo,
}: Props) {
  const isContenedor =
    display.displayOtTipo === "contenedor" && otTipoFilter === "agrupado" && !display.isHijaRow;
  const isHija = display.isHijaRow === true;
  const hijasCount = display.hijasCount ?? 0;

  const cellTitle = isContenedor
    ? hijasCount > 0
      ? `OT contenedor ${otNumero} · ${hijasCount} hija${hijasCount === 1 ? "" : "s"}`
      : `OT contenedor ${otNumero}`
    : isHija
      ? formatOtContenedorHijaSubtitle({
          otNumero,
          formaDescripcion: display.formaDescripcion,
          tipoHija: display.tipoHija,
          titulo,
        })
      : undefined;

  return (
    <div
      className={cn(
        "flex min-h-6 min-w-0 items-center gap-0.5 px-0.5 py-0",
        isHija && "pl-3",
      )}
      title={cellTitle}
    >
      {isContenedor ? (
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-slate-100"
          onClick={onToggleExpand}
          title={
            loadingExpand
              ? "Cargando hijas…"
              : hijasCount > 0
                ? `Expandir ${hijasCount} hija${hijasCount === 1 ? "" : "s"}`
                : "Expandir hijas"
          }
          aria-expanded={expanded === true}
        >
          {loadingExpand ? (
            <Loader2 className="size-3.5 animate-spin text-slate-400" />
          ) : expanded ? (
            <ChevronDown className="size-3.5 text-slate-500" />
          ) : (
            <ChevronRight className="size-3.5 text-slate-500" />
          )}
        </button>
      ) : isHija ? (
        <span
          className="inline-flex w-3 shrink-0 items-center justify-center text-[10px] text-slate-300"
          aria-hidden
        >
          └
        </span>
      ) : null}

      <OtNumeroSemaforoBadge
        otNumero={otNumero}
        fechaEntregaIso={fechaEntregaIso}
        umbrales={umbrales}
        className="min-w-0 flex-1"
      />
    </div>
  );
}
