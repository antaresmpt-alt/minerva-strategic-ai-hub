"use client";

import { CheckCircle2, EyeOff, Loader2 } from "lucide-react";
import { useMemo } from "react";

import {
  TurnoColumn,
} from "@/components/produccion/planificacion/mesa/turno-column";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  dailyContainerId,
  dailySlotKey,
} from "@/lib/planificacion-mesa-diaria";
import type { PlanificacionTipoMaquina } from "@/lib/planificacion-ambito";
import { cn } from "@/lib/utils";
import type {
  DayKey,
  MesaTrabajo,
  TurnoKey,
} from "@/types/planificacion-mesa";

export type MaquinaColumnData = {
  id: string;
  nombre: string;
  codigo: string;
  tipo_maquina: PlanificacionTipoMaquina;
  capacidad_horas_default_manana: number;
  capacidad_horas_default_tarde: number;
};

interface MaquinaColumnProps {
  maquina: MaquinaColumnData;
  dayKey: DayKey;
  itemsManana: MesaTrabajo[];
  itemsTarde: MesaTrabajo[];
  /** Capacidad efectiva por turno (con default por máquina si no hay override). */
  capacityManana: number;
  capacityTarde: number;
  onEditCapacity: (
    maquinaId: string,
    day: DayKey,
    turno: TurnoKey,
  ) => void;
  onAction: (
    trabajo: MesaTrabajo,
    action:
      | "lanzar"
      | "iniciar"
      | "pausar"
      | "reanudar"
      | "cancelar"
      | "finalizar",
    payload?: {
      horasEntrada: number | null;
      horasTiraje: number | null;
      horasTroquelado: number | null;
      horasEngomado: number | null;
      numHojas: number | null;
      cantidadUnidades: number | null;
      notas: string | null;
    },
  ) => void;
  actionLoadingId: string | null;
  disabled?: boolean;
  /** Confirmar todo lo borrador del día para esta máquina. */
  onConfirmColumn?: () => void;
  confirmingColumn?: boolean;
  /** Ocultar columna (la persistencia la gestiona el padre). */
  onHideColumn?: () => void;
}

/**
 * Calcula el estado agregado de la columna.
 * - `en_ejecucion`: si hay al menos uno en ejecución.
 * - `confirmado`: si hay items y todos los editables están en confirmado/finalizada.
 * - `borrador`: si hay al menos un borrador.
 * - `vacio`: si no hay nada.
 */
function aggregateColumnStatus(
  items: MesaTrabajo[],
): "vacio" | "borrador" | "confirmado" | "en_ejecucion" | "finalizada" {
  if (items.length === 0) return "vacio";
  let hasEjec = false;
  let hasBorrador = false;
  let hasConfirmado = false;
  let hasFinalizada = false;
  for (const it of items) {
    const e = it.estadoMesa;
    if (e === "en_ejecucion") hasEjec = true;
    else if (e === "borrador") hasBorrador = true;
    else if (e === "confirmado") hasConfirmado = true;
    else if (e === "finalizada") hasFinalizada = true;
  }
  if (hasEjec) return "en_ejecucion";
  if (hasBorrador) return "borrador";
  if (hasConfirmado) return "confirmado";
  if (hasFinalizada) return "finalizada";
  return "vacio";
}

function statusBadgeClasses(
  status: ReturnType<typeof aggregateColumnStatus>,
): string {
  switch (status) {
    case "en_ejecucion":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "confirmado":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "borrador":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "finalizada":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function statusLabel(
  status: ReturnType<typeof aggregateColumnStatus>,
): string {
  switch (status) {
    case "en_ejecucion":
      return "En ejecución";
    case "confirmado":
      return "Confirmado";
    case "borrador":
      return "Borrador";
    case "finalizada":
      return "Finalizada";
    default:
      return "Vacío";
  }
}

function tipoBadgeClasses(tipo: PlanificacionTipoMaquina): string {
  switch (tipo) {
    case "impresion":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "digital":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "troquelado":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    case "engomado":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function tipoLabelShort(tipo: PlanificacionTipoMaquina): string {
  switch (tipo) {
    case "impresion":
      return "Offset";
    case "digital":
      return "Digital";
    case "troquelado":
      return "Troquel";
    case "engomado":
      return "Engom.";
    default:
      return "";
  }
}

export function MaquinaColumn({
  maquina,
  dayKey,
  itemsManana,
  itemsTarde,
  capacityManana,
  capacityTarde,
  onEditCapacity,
  onAction,
  actionLoadingId,
  disabled,
  onConfirmColumn,
  confirmingColumn,
  onHideColumn,
}: MaquinaColumnProps) {
  const allItems = useMemo(
    () => [...itemsManana, ...itemsTarde],
    [itemsManana, itemsTarde],
  );
  const status = useMemo(() => aggregateColumnStatus(allItems), [allItems]);
  const totalHoras = useMemo(
    () =>
      allItems.reduce(
        (acc, it) =>
          acc +
          (Number.isFinite(it.horasPlanificadasSnapshot)
            ? it.horasPlanificadasSnapshot
            : 0),
        0,
      ),
    [allItems],
  );
  const capacidadTotal = capacityManana + capacityTarde;

  const hasBorrador = useMemo(
    () => allItems.some((it) => it.estadoMesa === "borrador"),
    [allItems],
  );

  return (
    <div
      className={cn(
        "flex min-w-[16rem] max-w-[20rem] flex-1 flex-col gap-2 rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm",
        "snap-start",
      )}
    >
      <header className="space-y-1.5 border-b border-slate-100 pb-2">
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-semibold text-[#002147]" title={maquina.nombre}>
              {maquina.nombre}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                  tipoBadgeClasses(maquina.tipo_maquina),
                )}
                title={`Tipo: ${maquina.tipo_maquina}`}
              >
                {tipoLabelShort(maquina.tipo_maquina)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                  statusBadgeClasses(status),
                )}
              >
                {statusLabel(status)}
              </span>
              <span
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600"
                title="Horas planificadas / capacidad total del día"
              >
                {totalHoras.toFixed(1)} / {capacidadTotal.toFixed(1)}h
              </span>
            </div>
          </div>
          {onHideColumn ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-slate-400 hover:text-[#002147]"
                    onClick={onHideColumn}
                    disabled={disabled}
                    aria-label={`Ocultar máquina ${maquina.nombre}`}
                  >
                    <EyeOff className="size-3.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Ocultar columna
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {onConfirmColumn ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-7 w-full justify-center gap-1.5 text-[11px]",
              hasBorrador
                ? "border-emerald-300 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100"
                : "border-slate-200 text-slate-500",
            )}
            onClick={onConfirmColumn}
            disabled={disabled || confirmingColumn || !hasBorrador}
            title={
              hasBorrador
                ? "Confirmar todos los borradores del día"
                : "No hay borradores que confirmar"
            }
          >
            {confirmingColumn ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-3.5" aria-hidden />
            )}
            Confirmar día
          </Button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-2">
        <TurnoColumn
          day={dayKey}
          turno="manana"
          items={itemsManana}
          capacityHoras={capacityManana}
          onEditCapacity={() => onEditCapacity(maquina.id, dayKey, "manana")}
          maquinaTipo={maquina.tipo_maquina}
          onAction={onAction}
          actionLoadingId={actionLoadingId}
          disabled={disabled}
          containerIdOverride={dailyContainerId(maquina.id, "manana")}
        />
        <TurnoColumn
          day={dayKey}
          turno="tarde"
          items={itemsTarde}
          capacityHoras={capacityTarde}
          onEditCapacity={() => onEditCapacity(maquina.id, dayKey, "tarde")}
          maquinaTipo={maquina.tipo_maquina}
          onAction={onAction}
          actionLoadingId={actionLoadingId}
          disabled={disabled}
          containerIdOverride={dailyContainerId(maquina.id, "tarde")}
        />
      </div>
    </div>
  );
}

/** Re-export para que el padre pueda calcular slot keys sin importar el helper. */
export { dailySlotKey };
