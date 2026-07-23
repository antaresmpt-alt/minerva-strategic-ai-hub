"use client";

import { useMemo } from "react";
import { ExternalLink, FileText, RefreshCw, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  STEP_ACCENT_STYLES,
  STEP_BADGE_STYLES,
} from "@/components/produccion/hoja-ruta/hoja-ruta-step-styles";
import {
  buildCamposVista,
  fmtCantidad,
  fmtDate,
  tipoMaquinaLabel,
} from "@/lib/hoja-ruta/hoja-ruta-formatters";
import {
  computeHorasResumenOt,
  formatHorasResumenLine,
} from "@/lib/hoja-ruta/hoja-ruta-horas";
import type { HojaRutaData, HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";

function machineLabel(paso: HojaRutaPaso): string {
  const nombre = String(paso.maquinaNombre ?? "").trim();
  const tipo = tipoMaquinaLabel(paso.tipoMaquina);
  if (nombre && tipo) return `${nombre} · ${tipo}`;
  if (nombre) return nombre;
  if (tipo) return tipo;
  return "Sin máquina asignada";
}

export function HojaRutaHeader({ data }: { data: HojaRutaData }) {
  const horasLine = useMemo(
    () => formatHorasResumenLine(computeHorasResumenOt(data.pasos)),
    [data.pasos],
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-sm font-semibold text-slate-800">
        {data.cliente ?? "—"} · {data.trabajo ?? "—"}
      </div>
      <div className="mt-1 grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="font-medium">Cantidad:</span> {fmtCantidad(data.cantidad)}
        </div>
        <div>
          <span className="font-medium">Entrega:</span> {fmtDate(data.fechaEntrega)}
        </div>
        <div>
          <span className="font-medium">Estado OT:</span> {data.estadoOt ?? "—"}
        </div>
        {horasLine ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="font-medium">Horas OT:</span> {horasLine}
          </div>
        ) : null}
      </div>
      {data.despacho ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
          {data.despacho.material ? (
            <span>
              <span className="font-medium">Material:</span> {data.despacho.material}
              {data.despacho.gramaje ? ` ${data.despacho.gramaje}g` : ""}
            </span>
          ) : null}
          {data.despacho.tamanoHoja ? (
            <span>
              <span className="font-medium">Formato compra:</span> {data.despacho.tamanoHoja}
            </span>
          ) : null}
          {data.despacho.tintas ? (
            <span>
              <span className="font-medium">Tintas:</span> {data.despacho.tintas}
            </span>
          ) : null}
          {data.despacho.troquel ? (
            <span>
              <span className="font-medium">Troquel:</span> {data.despacho.troquel}
              {data.despacho.poses ? ` (${data.despacho.poses})` : ""}
            </span>
          ) : null}
          {data.despacho.acabadoPral ? (
            <span>
              <span className="font-medium">Acabado:</span> {data.despacho.acabadoPral}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function HojaRutaPasosDetail({
  data,
  showProximamente = true,
}: {
  data: HojaRutaData;
  /** Botones stub "Recalcular / Ficha" — ocultos en histórico. */
  showProximamente?: boolean;
}) {
  return (
    <>
      {data.pasos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {data.pasos.map((p) => (
            <span
              key={p.pasoId}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                STEP_BADGE_STYLES[p.estado] ?? STEP_BADGE_STYLES.pendiente
              }`}
              title={`${p.orden} · ${p.procesoNombre ?? "—"} · ${p.estado}`}
            >
              <Route className="size-3" />
              {p.orden} · {p.procesoNombre ?? "—"}
            </span>
          ))}
        </div>
      ) : null}

      {showProximamente ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
          <span className="text-xs font-medium text-slate-600">Próximamente:</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-7 gap-1.5 text-xs opacity-60"
            title="Próximamente · Enlazará con FSC y cartelas de recepción de material"
          >
            <RefreshCw className="size-3.5" />
            Recalcular presupuesto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-7 gap-1.5 text-xs opacity-60"
            title="Próximamente · Vinculado a la pestaña de Fichas Técnicas"
          >
            <FileText className="size-3.5" />
            Ficha técnica
          </Button>
        </div>
      ) : null}

      {data.pasos.length === 0 ? (
        <p className="text-sm text-slate-600">Esta OT no tiene itinerario en base de datos.</p>
      ) : (
        <div className="space-y-3">
          {data.pasos.map((p) => {
            const camposVista = buildCamposVista(p.procesoId, p.datosProceso);
            return (
              <div
                key={p.pasoId}
                className={`rounded-lg border border-l-4 border-slate-200 bg-white p-3 ${
                  STEP_ACCENT_STYLES[p.estado] ?? STEP_ACCENT_STYLES.pendiente
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        STEP_BADGE_STYLES[p.estado] ?? STEP_BADGE_STYLES.pendiente
                      }`}
                    >
                      {p.orden} · {p.procesoNombre ?? "—"}
                    </span>
                    {p.esExterno ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                        <ExternalLink className="size-3" />
                        Externo
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-500">{p.estado}</span>
                </div>

                <div className="mt-2 grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                  <div>
                    <span className="font-medium">Máquina:</span> {machineLabel(p)}
                  </div>
                  <div>
                    <span className="font-medium">Fechas:</span> Disp.{" "}
                    {fmtDate(p.fechaDisponible)} · Inicio {fmtDate(p.fechaInicio)} · Fin{" "}
                    {fmtDate(p.fechaFin)}
                  </div>
                </div>

                {camposVista.length > 0 ? (
                  <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/60 p-2">
                    <p className="text-[11px] font-semibold text-[#002147]">Datos del proceso</p>
                    <div className="mt-1 grid gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                      {camposVista.map((c) => (
                        <div key={c.label}>
                          <span className="text-slate-500">{c.label}:</span>{" "}
                          <span className="font-medium">{c.valor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {p.ejecucion ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold text-[#002147]">Ejecución</p>
                    <p className="text-xs text-slate-600">
                      Estado: <span className="font-medium">{p.ejecucion.estado}</span>
                      {p.ejecucion.maquinista ? ` · Maquinista: ${p.ejecucion.maquinista}` : ""}
                      {p.ejecucion.horasReales != null
                        ? ` · Horas reales: ${p.ejecucion.horasReales}`
                        : ""}
                      {p.ejecucion.numPausas > 0 ? ` · Pausas: ${p.ejecucion.numPausas}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      Inicio real: {fmtDate(p.ejecucion.inicioRealAt)} · Fin real:{" "}
                      {fmtDate(p.ejecucion.finRealAt)}
                    </p>
                    {p.ejecucion.incidencia ? (
                      <p className="text-xs text-red-800">Incidencia: {p.ejecucion.incidencia}</p>
                    ) : null}
                    {p.ejecucion.accionCorrectiva ? (
                      <p className="text-xs text-slate-600">
                        Acción correctiva: {p.ejecucion.accionCorrectiva}
                      </p>
                    ) : null}
                    {p.ejecucion.observaciones ? (
                      <p className="text-xs text-slate-600">Obs: {p.ejecucion.observaciones}</p>
                    ) : null}
                  </div>
                ) : null}

                {p.externo ? (
                  <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/40 p-2">
                    <p className="text-[11px] font-semibold text-[#002147]">Externo</p>
                    <p className="text-xs text-slate-700">
                      Estado: <span className="font-medium">{p.externo.estado ?? "—"}</span>
                      {p.externo.proveedorNombre
                        ? ` · Proveedor: ${p.externo.proveedorNombre}`
                        : ""}
                      {p.externo.acabadoNombre ? ` · Acabado: ${p.externo.acabadoNombre}` : ""}
                    </p>
                    <p className="text-xs text-slate-600">
                      Envío: {fmtDate(p.externo.fechaEnvio)} · Previsto:{" "}
                      {fmtDate(p.externo.fechaPrevista)}
                      {p.externo.fechaRecepcionMuelle
                        ? ` · Muelle: ${fmtDate(p.externo.fechaRecepcionMuelle)}`
                        : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {p.externo.hojasEnviadas != null ? (
                        <span>
                          <span className="font-medium">Hojas enviadas:</span>{" "}
                          {fmtCantidad(p.externo.hojasEnviadas)}
                        </span>
                      ) : null}
                      {p.externo.hojasRecibidasMuelle != null ? (
                        <span>
                          <span className="font-medium">Hojas recibidas:</span>{" "}
                          {fmtCantidad(p.externo.hojasRecibidasMuelle)}
                        </span>
                      ) : null}
                      {p.externo.unidades != null ? (
                        <span>
                          <span className="font-medium">Unidades envío:</span>{" "}
                          {fmtCantidad(p.externo.unidades)}
                        </span>
                      ) : null}
                      {p.externo.unidadesRecibidasMuelle != null ? (
                        <span>
                          <span className="font-medium">Unidades recibidas:</span>{" "}
                          {fmtCantidad(p.externo.unidadesRecibidasMuelle)}
                        </span>
                      ) : null}
                      {p.externo.palets != null ? (
                        <span>
                          <span className="font-medium">Palets envío:</span>{" "}
                          {fmtCantidad(p.externo.palets)}
                        </span>
                      ) : null}
                      {p.externo.paletsRecibidosMuelle != null ? (
                        <span>
                          <span className="font-medium">Palets recibidos:</span>{" "}
                          {fmtCantidad(p.externo.paletsRecibidosMuelle)}
                        </span>
                      ) : null}
                    </div>
                    {p.externo.observaciones ? (
                      <p className="text-xs text-slate-600">Obs: {p.externo.observaciones}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
