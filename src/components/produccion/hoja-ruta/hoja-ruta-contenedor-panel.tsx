"use client";

import { ChevronRight, Route, Ship } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fmtCantidad } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type {
  HojaRutaContenedorData,
  HojaRutaHijaResumen,
  HojaRutaPasoResumen,
} from "@/lib/hoja-ruta/hoja-ruta-query";
import { formatHijaDisplayLabel } from "@/lib/planificacion-contenedor-query";

import { STEP_BADGE_STYLES } from "@/components/produccion/hoja-ruta/hoja-ruta-step-styles";

function PasoChip({ paso }: { paso: HojaRutaPasoResumen }) {
  const estado = String(paso.estado ?? "pendiente").trim().toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        STEP_BADGE_STYLES[estado] ?? STEP_BADGE_STYLES.pendiente
      }`}
      title={`${paso.orden} · ${paso.procesoNombre ?? "—"} · ${estado}`}
    >
      {paso.procesoNombre ?? `Paso ${paso.orden}`}
    </span>
  );
}

function HijaRow({
  hija,
  onVerHoja,
}: {
  hija: HojaRutaHijaResumen;
  onVerHoja: (otNumero: string) => void;
}) {
  const label = formatHijaDisplayLabel({
    ot: hija.otNumero,
    formaDescripcion: hija.formaDescripcion,
    trabajo: hija.trabajo,
  });
  const pasoActual = hija.pasoActual;
  const pasoEstado = pasoActual
    ? String(pasoActual.estado).trim().toLowerCase()
    : hija.pasosTotal > 0 && hija.pasosCompletados === hija.pasosTotal
      ? "finalizado"
      : "pendiente";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#002147]">{hija.otNumero}</span>
            <span className="text-xs text-slate-600">{label}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {hija.cantidad != null ? (
              <span>
                <span className="font-medium">Cant.:</span> {fmtCantidad(hija.cantidad)}
              </span>
            ) : null}
            {hija.pasosTotal > 0 ? (
              <span>
                <span className="font-medium">Pasos:</span> {hija.pasosCompletados}/{hija.pasosTotal}
              </span>
            ) : (
              <span>Sin itinerario</span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 text-xs"
          onClick={() => onVerHoja(hija.otNumero)}
        >
          Ver hoja
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {pasoActual ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Paso actual:</span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              STEP_BADGE_STYLES[pasoEstado] ?? STEP_BADGE_STYLES.pendiente
            }`}
          >
            {pasoActual.orden} · {pasoActual.procesoNombre ?? "—"}
          </span>
          <span className="text-slate-500">({pasoEstado})</span>
        </div>
      ) : hija.pasosTotal > 0 && hija.pasosCompletados === hija.pasosTotal ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">Itinerario completo</p>
      ) : null}

      {hija.pasos.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {hija.pasos.map((p) => (
            <PasoChip key={p.pasoId} paso={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HojaRutaContenedorPanel({
  data,
  onVerHoja,
}: {
  data: HojaRutaContenedorData;
  onVerHoja: (otNumero: string) => void;
}) {
  const { progress, progressLabel } = data;
  const pct = progress.pct ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Ship className="size-4 text-indigo-700" aria-hidden />
          <span className="text-sm font-semibold text-indigo-900">Vista agregada del barco</span>
        </div>
        <p className="mt-1 text-xs text-indigo-800/90">
          El contenedor agrupa la compra y el pedido comercial. La ejecución va por cada hija; abre
          su hoja para ver datos de proceso y ejecución.
        </p>
        {progressLabel ? (
          <p className="mt-2 font-mono text-xs font-semibold text-indigo-900">{progressLabel}</p>
        ) : null}
        {progress.pasosTotal > 0 ? (
          <div className="mt-2">
            <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-indigo-700">
              {progress.pasosCompletados} de {progress.pasosTotal} pasos finalizados (todas las hijas)
            </p>
          </div>
        ) : null}
      </div>

      {data.hijas.length === 0 ? (
        <p className="text-sm text-slate-600">Este contenedor no tiene hijas registradas.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Route className="size-3.5" />
            Hijas ({data.hijas.length})
          </div>
          {data.hijas.map((hija) => (
            <HijaRow key={hija.otNumero} hija={hija} onVerHoja={onVerHoja} />
          ))}
        </div>
      )}
    </div>
  );
}
