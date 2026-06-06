"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Route,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchHojaRutaOt,
  type HojaRutaData,
  type HojaRutaPaso,
} from "@/lib/hoja-ruta/hoja-ruta-query";
import {
  getCamposConfigByProcesoId,
  type CampoDefinicion,
} from "@/lib/hoja-ruta-campos-config";

const STEP_BADGE_STYLES: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-700",
  disponible: "bg-blue-100 text-blue-800",
  en_marcha: "bg-amber-100 text-amber-800",
  pausado: "bg-orange-100 text-orange-800",
  finalizado: "bg-emerald-100 text-emerald-800",
};

function fmtDate(v: string | null | undefined): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtCantidad(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-ES").format(v);
}

function tipoMaquinaLabel(v: string | null | undefined): string {
  const t = String(v ?? "").trim().toLowerCase();
  if (t === "impresion") return "Impresión";
  if (t === "digital") return "Digital";
  if (t === "troquelado") return "Troquelado";
  if (t === "engomado") return "Engomado";
  return "";
}

function machineLabel(paso: HojaRutaPaso): string {
  const nombre = String(paso.maquinaNombre ?? "").trim();
  const tipo = tipoMaquinaLabel(paso.tipoMaquina);
  if (nombre && tipo) return `${nombre} · ${tipo}`;
  if (nombre) return nombre;
  if (tipo) return tipo;
  return "Sin máquina asignada";
}

function formatValor(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) {
    const items = value
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0);
    return items.length > 0 ? items.join(", ") : null;
  }
  const raw = String(value).trim();
  return raw.length > 0 ? raw : null;
}

type CampoVista = { label: string; valor: string };

/**
 * Extrae solo los campos rellenados de `datos_proceso` según la config del
 * proceso, en orden, gestionando previsto/real. No muestra campos vacíos.
 */
function buildCamposVista(
  procesoId: number | null,
  datos: Record<string, unknown> | null,
): CampoVista[] {
  if (procesoId == null || !datos) return [];
  const config = getCamposConfigByProcesoId(procesoId);
  if (!config) return [];
  const out: CampoVista[] = [];
  const suffix = (campo: CampoDefinicion, v: string) =>
    campo.suffix ? `${v} ${campo.suffix}` : v;

  for (const campo of config.campos) {
    if (campo.hasPrevistoReal) {
      const prev = formatValor(datos[`${campo.id}_previsto`]);
      const real = formatValor(datos[`${campo.id}_real`]);
      if (prev != null) out.push({ label: `${campo.label} (prev.)`, valor: suffix(campo, prev) });
      if (real != null) out.push({ label: `${campo.label} (real)`, valor: suffix(campo, real) });
      continue;
    }
    const v = formatValor(datos[campo.id]);
    if (v != null) out.push({ label: campo.label, valor: suffix(campo, v) });
  }
  return out;
}

export function HojaRutaOtDialog({
  otNumero,
  open,
  onOpenChange,
}: {
  otNumero: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [data, setData] = useState<HojaRutaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!otNumero) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHojaRutaOt(supabase, otNumero);
      setData(result);
    } catch (e) {
      console.error("[Hoja de ruta] load", e);
      setError(e instanceof Error ? e.message : "No se pudo cargar la hoja de ruta.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [otNumero, supabase]);

  useEffect(() => {
    if (open && otNumero) void load();
    if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, otNumero, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94vh,880px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="text-base">
            Hoja de ruta · OT{" "}
            <span className="font-mono text-sm font-semibold text-[#002147]">
              {otNumero ?? ""}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Itinerario completo con datos capturados por proceso, ejecución real y externos.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Cargando hoja de ruta…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="size-4" />
              {error}
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No se encontró información para esta OT.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cabecera */}
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
                        <span className="font-medium">Formato:</span> {data.despacho.tamanoHoja}
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

              {/* Tags de ruta */}
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

              {/* Pasos detallados */}
              {data.pasos.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Esta OT no tiene itinerario en base de datos.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.pasos.map((p) => {
                    const camposVista = buildCamposVista(p.procesoId, p.datosProceso);
                    return (
                      <div
                        key={p.pasoId}
                        className="rounded-lg border border-slate-200 bg-white p-3"
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

                        {/* Datos del proceso (datos_proceso) */}
                        {camposVista.length > 0 ? (
                          <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/60 p-2">
                            <p className="text-[11px] font-semibold text-[#002147]">
                              Datos del proceso
                            </p>
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

                        {/* Ejecución real */}
                        {p.ejecucion ? (
                          <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                            <p className="text-[11px] font-semibold text-[#002147]">Ejecución</p>
                            <p className="text-xs text-slate-600">
                              Estado:{" "}
                              <span className="font-medium">{p.ejecucion.estado}</span>
                              {p.ejecucion.maquinista
                                ? ` · Maquinista: ${p.ejecucion.maquinista}`
                                : ""}
                              {p.ejecucion.horasReales != null
                                ? ` · Horas reales: ${p.ejecucion.horasReales}`
                                : ""}
                              {p.ejecucion.numPausas > 0
                                ? ` · Pausas: ${p.ejecucion.numPausas}`
                                : ""}
                            </p>
                            <p className="text-xs text-slate-500">
                              Inicio real: {fmtDate(p.ejecucion.inicioRealAt)} · Fin real:{" "}
                              {fmtDate(p.ejecucion.finRealAt)}
                            </p>
                            {p.ejecucion.incidencia ? (
                              <p className="text-xs text-red-800">
                                Incidencia: {p.ejecucion.incidencia}
                              </p>
                            ) : null}
                            {p.ejecucion.accionCorrectiva ? (
                              <p className="text-xs text-slate-600">
                                Acción correctiva: {p.ejecucion.accionCorrectiva}
                              </p>
                            ) : null}
                            {p.ejecucion.observaciones ? (
                              <p className="text-xs text-slate-600">
                                Obs: {p.ejecucion.observaciones}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Externo */}
                        {p.externo ? (
                          <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/40 p-2">
                            <p className="text-[11px] font-semibold text-[#002147]">Externo</p>
                            <p className="text-xs text-slate-700">
                              Estado:{" "}
                              <span className="font-medium">{p.externo.estado ?? "—"}</span>
                              {p.externo.proveedorNombre
                                ? ` · Proveedor: ${p.externo.proveedorNombre}`
                                : ""}
                            </p>
                            <p className="text-xs text-slate-600">
                              Envío: {fmtDate(p.externo.fechaEnvio)} · Previsto:{" "}
                              {fmtDate(p.externo.fechaPrevista)}
                            </p>
                            {p.externo.observaciones ? (
                              <p className="text-xs text-slate-600">
                                Obs: {p.externo.observaciones}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/produccion/ots?tab=despachadas")}
          >
            <Route className="mr-2 size-4" />
            Ver en Despachadas
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001a38]"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
