"use client";

import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { forwardRef } from "react";

import {
  labelCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
import type { DetalleDiaDraftSlot } from "@/lib/calendario-detalle-dia";

export type CalendarioDetalleDiaPrintProps = {
  dayYmd: string;
  dayLabel: string;
  ambito: CalendarioAmbito;
  maquinaNombre: string;
  draft: readonly DetalleDiaDraftSlot[];
  trabajoByOt: Map<string, string>;
  generadoPor?: string | null;
};

export const CalendarioDetalleDiaPrintTemplate = forwardRef<
  HTMLDivElement,
  CalendarioDetalleDiaPrintProps
>(function CalendarioDetalleDiaPrintTemplate(
  {
    dayYmd,
    dayLabel,
    ambito,
    maquinaNombre,
    draft,
    trabajoByOt,
    generadoPor,
  },
  ref,
) {
  const manana = draft
    .filter((d) => d.turno === "manana")
    .sort((a, b) => a.slotOrden - b.slotOrden);
  const tarde = draft
    .filter((d) => d.turno === "tarde")
    .sort((a, b) => a.slotOrden - b.slotOrden);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed top-0 -left-[9999px] z-[-5] w-[210mm] bg-white p-8 text-[10pt] leading-snug text-black opacity-0 print:pointer-events-auto print:static print:left-0 print:z-0 print:opacity-100"
      aria-hidden
    >
      <header className="mb-4 flex items-end justify-between gap-4 border-b-2 border-[#002147] pb-3">
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/minerva-logo.svg"
            alt="Minerva Global"
            className="h-12 w-auto object-contain object-left"
          />
          <div>
            <p className="text-[9pt] font-semibold uppercase tracking-wide text-[#C69C2B]">
              Plan diario de producción
            </p>
            <h1 className="font-heading text-[15pt] font-bold leading-tight text-[#002147]">
              {labelCalendarioAmbito(ambito)}
            </h1>
            <p className="text-[9pt] capitalize text-slate-700">{dayLabel}</p>
          </div>
        </div>
        <div className="text-right text-[8.5pt] text-slate-600">
          <p className="font-semibold text-[#002147]">Documento para reunión</p>
          <p className="font-medium text-[#002147]">{maquinaNombre}</p>
          <p>
            {manana.length + tarde.length} trabajo
            {manana.length + tarde.length === 1 ? "" : "s"} · mañana{" "}
            {manana.length} · tarde {tarde.length}
          </p>
          <p className="mt-0.5 text-[7.5pt] text-slate-500">
            Generado{" "}
            {format(new Date(), "dd/MM/yyyy HH:mm", { locale: esLocale })}
            {generadoPor ? ` · ${generadoPor}` : ""}
          </p>
        </div>
      </header>

      <TurnoBlock
        label="Mañana"
        items={manana}
        trabajoByOt={trabajoByOt}
      />
      <TurnoBlock
        label="Tarde"
        items={tarde}
        trabajoByOt={trabajoByOt}
        className="mt-3"
      />

      <footer className="mt-4 border-t border-slate-200 pt-2 text-[7.5pt] text-slate-500">
        MINERVA — Detalle del día · {labelCalendarioAmbito(ambito)} · {dayYmd}.
        No lanza ejecución.
      </footer>
    </div>
  );
});

function TurnoBlock({
  label,
  items,
  trabajoByOt,
  className,
}: {
  label: string;
  items: DetalleDiaDraftSlot[];
  trabajoByOt: Map<string, string>;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border border-slate-300 bg-white p-2 break-inside-avoid ${className ?? ""}`}
    >
      <h2 className="mb-1.5 border-b border-slate-200 pb-1 text-[10pt] font-bold text-[#002147]">
        {label}
        <span className="ml-2 text-[8.5pt] font-normal text-slate-500">
          ({items.length})
        </span>
      </h2>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-[8.5pt] text-slate-500">Sin trabajos.</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it) => (
            <li
              key={`${it.turno}-${it.calendarioOtId}`}
              className="flex items-baseline gap-2 border-b border-slate-100 py-0.5 last:border-0"
            >
              <span className="w-5 shrink-0 text-right text-[8.5pt] font-bold tabular-nums text-slate-500">
                {it.slotOrden}.
              </span>
              <span className="shrink-0 font-mono text-[10pt] font-bold text-[#002147]">
                {it.otNumero}
              </span>
              <span className="min-w-0 flex-1 truncate text-[9pt] text-slate-700">
                {trabajoByOt.get(it.otNumero) ?? "—"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
