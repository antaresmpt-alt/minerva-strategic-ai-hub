"use client";

import { AlertTriangle, FileText, Link2, Timer } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  barnizBadgeClass,
  cardHeightPx,
} from "@/lib/planificacion-mesa";
import type { MaterialStatus } from "@/types/planificacion-mesa";

/**
 * PlanificacionCard
 * - Tarjeta compacta de 3 líneas usada en pool y mesa.
 * - 100% presentacional: el comportamiento DnD lo aporta el wrapper
 *   (Draggable/Sortable) en el componente padre.
 *
 * Líneas:
 *   1) OT en negrita + cliente truncado + alerta material
 *   2) Tintas + Barniz (badges con color por tipo)
 *   3) 📄 hojas | ⏱️ horas | papel (truncate)
 */

export interface PlanificacionCardData {
  ot: string;
  cliente: string;
  tintas: string;
  barniz: string | null;
  acabadoPral: string;
  papel: string;
  numHojas: number;
  horas: number;
  materialStatus: MaterialStatus;
}

interface PlanificacionCardProps {
  data: PlanificacionCardData;
  /** Indicador 🔗 si la siguiente tarjeta comparte acabado_pral. */
  linkedToNext?: boolean;
  /** Marca como "ghost" mientras se arrastra. */
  isDragging?: boolean;
  /** En sidebar evitamos escalar altura por horas. */
  fixedHeight?: boolean;
  /** Wrapper externo para listeners DnD. */
  className?: string;
  /** Estilo (transform DnD, etc.) inyectado por el wrapper sortable/draggable. */
  style?: CSSProperties;
  /** Slot para botones/listeners. Renderizado al fondo si se aporta. */
  footerSlot?: ReactNode;
  /** Indicador opcional (slot_orden, etc.). */
  badgeStart?: ReactNode;
}

function formatHoras(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "0";
  if (Math.abs(h - Math.round(h)) < 0.05) return String(Math.round(h));
  return h.toFixed(1).replace(/\.0$/, "");
}

function formatHojas(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}

function MaterialAlertIcon({ status }: { status: MaterialStatus }) {
  if (status === "verde") return null;
  const isCrit = status === "rojo";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1 py-0.5 text-[10px] font-semibold",
        isCrit
          ? "bg-red-100 text-red-800"
          : "bg-amber-100 text-amber-800",
      )}
      title={isCrit ? "Material crítico" : "Material parcial"}
    >
      <AlertTriangle className="size-3" aria-hidden />
    </span>
  );
}

function TintasBadge({ tintas }: { tintas: string }) {
  const t = tintas.trim();
  if (!t || t === "—") return null;
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
      {t}
    </span>
  );
}

function BarnizBadge({ value }: { value: string | null }) {
  const t = (value ?? "").trim();
  if (!t) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-[10rem] items-center truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        barnizBadgeClass(t),
      )}
      title={t}
    >
      {t}
    </span>
  );
}

export function PlanificacionCard({
  data,
  linkedToNext = false,
  isDragging = false,
  fixedHeight = false,
  className,
  style,
  footerSlot,
  badgeStart,
}: PlanificacionCardProps) {
  const heightPx = fixedHeight ? undefined : cardHeightPx(data.horas);

  const fallbackBarniz =
    data.barniz && data.barniz.trim().length > 0
      ? data.barniz
      : data.acabadoPral && data.acabadoPral.trim().length > 0
        ? data.acabadoPral
        : null;

  return (
    <div
      style={
        heightPx != null
          ? { ...(style ?? {}), minHeight: `${heightPx}px` }
          : style
      }
      className={cn(
        "relative flex w-full select-none flex-col justify-between gap-1 rounded-md border border-slate-200/90 bg-white px-2 py-1.5 text-left shadow-xs transition-[opacity,box-shadow,transform]",
        "hover:border-[#002147]/40 hover:shadow-sm",
        isDragging && "z-30 opacity-70 shadow-md ring-1 ring-[#C69C2B]/50",
        className,
      )}
      data-ot={data.ot}
    >
      {linkedToNext ? (
        <span
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-emerald-300 bg-emerald-50 p-0.5 text-emerald-700 shadow-xs"
          title="Mismo acabado que la siguiente OT"
          aria-label="Trabajos enlazados por acabado"
        >
          <Link2 className="size-3" aria-hidden />
        </span>
      ) : null}

      <div className="flex min-w-0 items-center gap-1.5">
        {badgeStart}
        <span className="font-mono text-xs font-semibold text-[#002147]">
          {data.ot || "—"}
        </span>
        <p
          className="min-w-0 flex-1 truncate text-[11px] text-slate-700"
          title={data.cliente}
        >
          {data.cliente || "—"}
        </p>
        <MaterialAlertIcon status={data.materialStatus} />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <TintasBadge tintas={data.tintas} />
        <BarnizBadge value={fallbackBarniz} />
      </div>

      <div className="flex min-w-0 items-center gap-2 text-[10px] text-slate-600">
        <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
          <FileText className="size-3" aria-hidden />
          {formatHojas(data.numHojas)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
          <Timer className="size-3" aria-hidden />
          {formatHoras(data.horas)}h
        </span>
        <span
          className="min-w-0 flex-1 truncate text-slate-500"
          title={data.papel}
        >
          {data.papel || "—"}
        </span>
      </div>

      {footerSlot}
    </div>
  );
}
