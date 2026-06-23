"use client";

import { ChevronDown, ChevronRight, Loader2, Ship } from "lucide-react";

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
  const hijasLabel =
    display.hijasCount != null && display.hijasCount > 0
      ? `${display.hijasCount} hija${display.hijasCount === 1 ? "" : "s"}`
      : null;

  return (
    <div
      className={cn(
        "flex min-h-6 min-w-0 items-center gap-0.5 px-0.5 py-0",
        isHija && "pl-4",
      )}
    >
      {isContenedor ? (
        <button
          type="button"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-slate-100"
          onClick={onToggleExpand}
          title={
            loadingExpand
              ? "Cargando hijas…"
              : hijasLabel
                ? `Expandir ${hijasLabel}`
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
        <span className="inline-flex size-6 shrink-0 items-center justify-center text-slate-300">
          └
        </span>
      ) : null}

      <div className="flex min-w-0 flex-col gap-0">
        <div className="flex min-w-0 items-center gap-1">
          <OtNumeroSemaforoBadge
            otNumero={otNumero}
            fechaEntregaIso={fechaEntregaIso}
            umbrales={umbrales}
          />
          {isContenedor ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded border border-[#002147]/20 bg-[#002147]/5 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[#002147]"
              title="OT contenedor (barco)"
            >
              <Ship className="size-2.5" aria-hidden />
              {hijasLabel ?? "barco"}
            </span>
          ) : null}
        </div>
        {isHija ? (
          <span
            className="truncate pl-0.5 text-[9px] leading-tight text-slate-500"
            title={formatOtContenedorHijaSubtitle({
              otNumero,
              formaDescripcion: display.formaDescripcion,
              tipoHija: display.tipoHija,
              titulo,
            })}
          >
            {formatOtContenedorHijaSubtitle({
              otNumero,
              formaDescripcion: display.formaDescripcion,
              tipoHija: display.tipoHija,
              titulo,
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
