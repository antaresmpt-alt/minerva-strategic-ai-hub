"use client";

import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { forwardRef, useMemo } from "react";

import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import { barnizBadgeClass } from "@/lib/planificacion-mesa";
import type { PlanificacionTipoMaquina } from "@/lib/planificacion-ambito";
import type { OtsComprasUmbralesParametros } from "@/lib/sys-parametros-ots-compras";
import { cn } from "@/lib/utils";
import type {
  DayKey,
  MesaTrabajo,
  TurnoKey,
} from "@/types/planificacion-mesa";

/**
 * Plantilla de impresión de la Mesa diaria — PDF visual para reunión.
 * Diseñada para A4 landscape, oculta off-screen en uso normal y solo
 * visible durante `useReactToPrint` (mismo patrón que `externos-print-parte`).
 */

export type MesaDiariaPrintMaquina = {
  id: string;
  nombre: string;
  tipo_maquina: PlanificacionTipoMaquina;
  capacidad_horas_default_manana: number;
  capacidad_horas_default_tarde: number;
};

export type MesaDiariaPrintCapacidad = {
  maquina_id: string;
  fecha: DayKey;
  turno: TurnoKey;
  capacidadHoras: number;
};

export interface MesaDiariaPrintTemplateProps {
  ambitoLabel: string;
  dayKey: DayKey;
  currentDay: Date;
  maquinas: MesaDiariaPrintMaquina[];
  mesaItems: MesaTrabajo[];
  capacidades: MesaDiariaPrintCapacidad[];
  trabajoByOt: Record<string, string>;
  umbrales: OtsComprasUmbralesParametros;
  generadoPor: string | null;
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

function tipoBadgeClasses(tipo: PlanificacionTipoMaquina): string {
  switch (tipo) {
    case "impresion":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "digital":
      return "border-violet-300 bg-violet-50 text-violet-800";
    case "troquelado":
      return "border-indigo-300 bg-indigo-50 text-indigo-800";
    case "engomado":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

function formatHoras(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "0";
  if (Math.abs(h - Math.round(h)) < 0.05) return String(Math.round(h));
  return h.toFixed(1).replace(/\.0$/, "");
}

function formatHojas(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}

function pctClass(pct: number): string {
  if (pct >= 100) return "bg-red-100 text-red-800 border-red-300";
  if (pct >= 85) return "bg-amber-100 text-amber-900 border-amber-300";
  if (pct > 0) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
}

function materialBadgeClass(status: string): string {
  if (status === "rojo") return "bg-red-100 text-red-800 border-red-300";
  if (status === "amarillo" || status === "naranja")
    return "bg-amber-100 text-amber-900 border-amber-300";
  if (status === "verde") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function troquelBadgeClass(status: string): string {
  if (status === "rojo" || status === "sin_troquel")
    return "bg-red-100 text-red-800 border-red-300";
  if (status === "amarillo" || status === "naranja")
    return "bg-amber-100 text-amber-900 border-amber-300";
  if (status === "verde" || status === "ok")
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function estadoBadgeClass(estado: string): string {
  if (estado === "en_ejecucion")
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (estado === "confirmado")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (estado === "borrador")
    return "bg-amber-100 text-amber-900 border-amber-300";
  if (estado === "finalizada")
    return "bg-slate-200 text-slate-700 border-slate-300";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function estadoLabel(estado: string): string {
  if (estado === "en_ejecucion") return "EJEC";
  if (estado === "confirmado") return "Conf.";
  if (estado === "borrador") return "Bdor.";
  if (estado === "finalizada") return "Fin.";
  return estado;
}

function TrabajoPrintCard({
  item,
  trabajoTitulo,
  umbrales,
}: {
  item: MesaTrabajo;
  trabajoTitulo: string | undefined;
  umbrales: OtsComprasUmbralesParametros;
}) {
  const cliente = (item.clienteSnapshot ?? "").trim() || "—";
  const trabajo = (trabajoTitulo ?? "").trim();
  const tintas = (item.tintasSnapshot ?? "").trim();
  const barniz = (item.barnizSnapshot ?? "").trim();
  const acabado = (item.acabadoPralSnapshot ?? "").trim();
  const papel = (item.papelSnapshot ?? "").trim();

  return (
    <div className="break-inside-avoid rounded-md border border-slate-300 bg-white p-1.5 text-[8.5pt] leading-tight shadow-none">
      <div className="flex items-start justify-between gap-1">
        <OtNumeroSemaforoBadge
          otNumero={item.ot}
          fechaEntregaIso={item.fechaEntrega}
          umbrales={umbrales}
          className="min-w-0 max-w-[60%]"
        />
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md border px-1 py-px text-[7.5pt] font-semibold",
            estadoBadgeClass(item.estadoMesa),
          )}
        >
          {estadoLabel(item.estadoMesa)}
        </span>
      </div>
      <p className="mt-0.5 truncate font-medium text-[#002147]">{cliente}</p>
      {trabajo ? (
        <p className="line-clamp-2 text-[8pt] text-slate-700">{trabajo}</p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {tintas && tintas !== "—" ? (
          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-1 py-px font-mono text-[7.5pt] font-semibold text-slate-700">
            {tintas}
          </span>
        ) : null}
        {barniz ? (
          <span
            className={cn(
              "inline-flex max-w-[10rem] items-center truncate rounded-md px-1 py-px text-[7.5pt] font-medium",
              barnizBadgeClass(barniz),
            )}
          >
            {barniz}
          </span>
        ) : null}
        {acabado && acabado !== "—" && acabado.toLowerCase() !== barniz.toLowerCase() ? (
          <span className="inline-flex max-w-[9rem] items-center truncate rounded-md border border-slate-300 bg-slate-50 px-1 py-px text-[7.5pt] font-medium text-slate-700">
            {acabado}
          </span>
        ) : null}
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-1 py-px text-[7.5pt] font-semibold",
            materialBadgeClass(item.materialStatus),
          )}
          title="Material"
        >
          M: {item.materialStatus}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-1 py-px text-[7.5pt] font-semibold",
            troquelBadgeClass(item.troquelStatus),
          )}
          title="Troquel"
        >
          T: {item.troquelStatus}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[7.5pt] text-slate-600">
        <span className="truncate" title={papel}>
          📄 {papel || "—"}
        </span>
        <span className="tabular-nums">
          {formatHojas(item.numHojasBrutasSnapshot)} hj · {formatHoras(item.horasPlanificadasSnapshot)}h
        </span>
      </div>
    </div>
  );
}

function TurnoPrintBlock({
  label,
  items,
  capacidad,
  umbrales,
  trabajoByOt,
}: {
  label: string;
  items: MesaTrabajo[];
  capacidad: number;
  umbrales: OtsComprasUmbralesParametros;
  trabajoByOt: Record<string, string>;
}) {
  const horas = items.reduce(
    (acc, it) =>
      acc + (Number.isFinite(it.horasPlanificadasSnapshot) ? it.horasPlanificadasSnapshot : 0),
    0,
  );
  const pct = capacidad > 0 ? Math.round((horas / capacidad) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[8pt] font-semibold uppercase tracking-wide text-[#002147]">
        <span>{label}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-1 py-px text-[7.5pt] font-semibold tabular-nums",
            pctClass(pct),
          )}
        >
          {formatHoras(horas)} / {formatHoras(capacidad)}h · {pct}%
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded border border-dashed border-slate-200 bg-slate-50 px-1.5 py-1 text-[8pt] italic text-slate-400">
          Sin trabajos planificados.
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((it) => (
            <TrabajoPrintCard
              key={it.id}
              item={it}
              trabajoTitulo={trabajoByOt[it.ot]}
              umbrales={umbrales}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const MesaDiariaPrintTemplate = forwardRef<
  HTMLDivElement,
  MesaDiariaPrintTemplateProps
>(function MesaDiariaPrintTemplate(
  {
    ambitoLabel,
    dayKey,
    currentDay,
    maquinas,
    mesaItems,
    capacidades,
    trabajoByOt,
    umbrales,
    generadoPor,
  },
  ref,
) {
  /**
   * Agrupa los items del día por (maquinaId, turno). El propio padre ya filtra
   * `mesaItems` al día actual, pero filtramos por `dayKey` también por seguridad.
   */
  const itemsByMaquinaTurno = useMemo(() => {
    const map = new Map<string, { manana: MesaTrabajo[]; tarde: MesaTrabajo[] }>();
    for (const m of maquinas) {
      map.set(m.id, { manana: [], tarde: [] });
    }
    for (const it of mesaItems) {
      if (!it.maquinaId) continue;
      if (it.fechaPlanificada !== dayKey) continue;
      const bucket = map.get(it.maquinaId);
      if (!bucket) continue;
      if (it.turno === "manana") bucket.manana.push(it);
      else if (it.turno === "tarde") bucket.tarde.push(it);
    }
    for (const v of map.values()) {
      v.manana.sort((a, b) => a.slotOrden - b.slotOrden);
      v.tarde.sort((a, b) => a.slotOrden - b.slotOrden);
    }
    return map;
  }, [maquinas, mesaItems, dayKey]);

  const capacityFor = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const c of capacidades) {
      byKey.set(`${c.maquina_id}::${c.turno}`, c.capacidadHoras);
    }
    return (maquinaId: string, turno: TurnoKey, fallback: number): number =>
      byKey.get(`${maquinaId}::${turno}`) ?? fallback;
  }, [capacidades]);

  /** Resumen global: horas planificadas y capacidad total para el día. */
  const totales = useMemo(() => {
    let horas = 0;
    let cap = 0;
    let trabajos = 0;
    for (const m of maquinas) {
      const bucket = itemsByMaquinaTurno.get(m.id);
      if (!bucket) continue;
      const all = [...bucket.manana, ...bucket.tarde];
      for (const it of all) {
        if (Number.isFinite(it.horasPlanificadasSnapshot)) {
          horas += it.horasPlanificadasSnapshot;
        }
      }
      trabajos += all.length;
      cap +=
        capacityFor(m.id, "manana", m.capacidad_horas_default_manana ?? 8) +
        capacityFor(m.id, "tarde", m.capacidad_horas_default_tarde ?? 8);
    }
    const pct = cap > 0 ? Math.round((horas / cap) * 100) : 0;
    return { horas, cap, pct, trabajos };
  }, [maquinas, itemsByMaquinaTurno, capacityFor]);

  const fechaLabel = format(currentDay, "EEEE, d 'de' LLLL yyyy", {
    locale: esLocale,
  });

  return (
    <div
      ref={ref}
      className="mesa-diaria-print-root pointer-events-none fixed top-0 -left-[9999px] z-[-5] w-[297mm] max-w-[100vw] bg-white p-8 text-[10pt] leading-snug text-black opacity-0 print:pointer-events-auto print:static print:left-0 print:z-0 print:max-w-none print:opacity-100"
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
              {ambitoLabel}
            </h1>
            <p className="text-[9pt] capitalize text-slate-700">{fechaLabel}</p>
          </div>
        </div>
        <div className="text-right text-[8.5pt] text-slate-600">
          <p className="font-semibold text-[#002147]">
            Documento para reunión
          </p>
          <p>
            {maquinas.length} máquina{maquinas.length === 1 ? "" : "s"} ·{" "}
            {totales.trabajos} trabajo{totales.trabajos === 1 ? "" : "s"}
          </p>
          <p className="tabular-nums">
            Carga total: {formatHoras(totales.horas)} / {formatHoras(totales.cap)}h ·{" "}
            <span
              className={cn(
                "rounded-md border px-1 py-px text-[8pt] font-semibold",
                pctClass(totales.pct),
              )}
            >
              {totales.pct}%
            </span>
          </p>
          <p className="mt-0.5 text-[7.5pt] text-slate-500">
            Generado {format(new Date(), "dd/MM/yyyy HH:mm", { locale: esLocale })}
            {generadoPor ? ` · ${generadoPor}` : ""}
          </p>
        </div>
      </header>

      {maquinas.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          No hay máquinas visibles en el ámbito. Activa al menos una para imprimir el plan.
        </p>
      ) : (
        <div
          className="mesa-diaria-print-grid grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.max(maquinas.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {maquinas.map((m) => {
            const bucket = itemsByMaquinaTurno.get(m.id) ?? {
              manana: [],
              tarde: [],
            };
            const capMan = capacityFor(
              m.id,
              "manana",
              m.capacidad_horas_default_manana ?? 8,
            );
            const capTar = capacityFor(
              m.id,
              "tarde",
              m.capacidad_horas_default_tarde ?? 8,
            );
            const horasDia = [...bucket.manana, ...bucket.tarde].reduce(
              (acc, it) =>
                acc +
                (Number.isFinite(it.horasPlanificadasSnapshot)
                  ? it.horasPlanificadasSnapshot
                  : 0),
              0,
            );
            const capDia = capMan + capTar;
            const pctDia = capDia > 0 ? Math.round((horasDia / capDia) * 100) : 0;
            return (
              <section
                key={m.id}
                className="flex flex-col gap-1.5 rounded-md border border-slate-300 bg-white p-1.5 break-inside-avoid"
              >
                <header className="space-y-1 border-b border-slate-200 pb-1">
                  <div className="flex items-start justify-between gap-1">
                    <p
                      className="truncate text-[10pt] font-bold text-[#002147]"
                      title={m.nombre}
                    >
                      {m.nombre}
                    </p>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[7.5pt] font-semibold",
                        tipoBadgeClasses(m.tipo_maquina),
                      )}
                    >
                      {tipoLabelShort(m.tipo_maquina)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-1 py-px text-[7.5pt] tabular-nums text-slate-700">
                      {formatHoras(horasDia)} / {formatHoras(capDia)}h
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-1 py-px text-[7.5pt] font-semibold tabular-nums",
                        pctClass(pctDia),
                      )}
                    >
                      {pctDia}%
                    </span>
                  </div>
                </header>

                <TurnoPrintBlock
                  label="Mañana"
                  items={bucket.manana}
                  capacidad={capMan}
                  umbrales={umbrales}
                  trabajoByOt={trabajoByOt}
                />
                <TurnoPrintBlock
                  label="Tarde"
                  items={bucket.tarde}
                  capacidad={capTar}
                  umbrales={umbrales}
                  trabajoByOt={trabajoByOt}
                />
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-4 border-t border-slate-200 pt-2 text-[7.5pt] text-slate-500">
        MINERVA Strategic AI Hub — Documento operativo interno. Plan diario ·{" "}
        {ambitoLabel} · {dayKey}
      </footer>
    </div>
  );
});
