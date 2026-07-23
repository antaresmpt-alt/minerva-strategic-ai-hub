"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HojaRutaContenedorPanel } from "@/components/produccion/hoja-ruta/hoja-ruta-contenedor-panel";
import {
  STEP_ACCENT_STYLES,
  STEP_BADGE_STYLES,
} from "@/components/produccion/hoja-ruta/hoja-ruta-step-styles";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchHojaRutaLoad,
  fetchHojaRutaOt,
  type HojaRutaData,
  type HojaRutaOtLoadResult,
  type HojaRutaPaso,
} from "@/lib/hoja-ruta/hoja-ruta-query";
import {
  buildCamposVista,
  fmtDate,
  fmtCantidad,
  tipoMaquinaLabel,
} from "@/lib/hoja-ruta/hoja-ruta-formatters";
import {
  computeHorasResumenOt,
  formatHorasResumenLine,
} from "@/lib/hoja-ruta/hoja-ruta-horas";
import {
  buildCartelitaPackFromHojaRutaLoad,
  cartelitaInputFromHojaRuta,
  exportHojaRutaCartelitaPdf,
} from "@/lib/hoja-ruta/hoja-ruta-cartelita-pdf";
import { exportHojaRutaContenedorPdf, exportHojaRutaPdf } from "@/lib/hoja-ruta/hoja-ruta-pdf";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { isOtPendienteRevision } from "@/lib/prod-ot-cierre";
import { puedeCerrarOt, type ProfileConPermisos } from "@/lib/prod-ot-cierre-permisos";
import {
  CierreOtDialog,
  type CierrePrevioChecklistData,
  type CierreOtFormData,
} from "@/components/produccion/hoja-ruta/cierre-ot-dialog";

function machineLabel(paso: HojaRutaPaso): string {
  const nombre = String(paso.maquinaNombre ?? "").trim();
  const tipo = tipoMaquinaLabel(paso.tipoMaquina);
  if (nombre && tipo) return `${nombre} · ${tipo}`;
  if (nombre) return nombre;
  if (tipo) return tipo;
  return "Sin máquina asignada";
}

function HojaRutaHeader({ data }: { data: HojaRutaData }) {
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

function HojaRutaPasosDetail({ data }: { data: HojaRutaData }) {
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
  const [loadResult, setLoadResult] = useState<HojaRutaOtLoadResult | null>(null);
  const [drillHijaOt, setDrillHijaOt] = useState<string | null>(null);
  const [hijaData, setHijaData] = useState<HojaRutaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hijaLoading, setHijaLoading] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Bloque 6 — Cierre de OT
  const [profile, setProfile] = useState<ProfileConPermisos | null>(null);
  const [pendienteRevision, setPendienteRevision] = useState(false);
  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [cerrandoOt, setCerrandoOt] = useState(false);

  const padreNumero =
    loadResult?.kind === "contenedor" ? loadResult.padre.otNumero : (otNumero ?? "");

  const goBackToBarco = useCallback(() => {
    setDrillHijaOt(null);
    setHijaData(null);
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && drillHijaOt) {
        goBackToBarco();
        return;
      }
      onOpenChange(next);
    },
    [drillHijaOt, goBackToBarco, onOpenChange],
  );

  const load = useCallback(async () => {
    if (!otNumero) return;
    setLoading(true);
    setError(null);
    setDrillHijaOt(null);
    setHijaData(null);
    try {
      const result = await fetchHojaRutaLoad(supabase, otNumero);
      setLoadResult(result);
      
      // Bloque 6 — Verificar si está pendiente de revisión (solo OTs simples)
      if (result?.kind === "ot") {
        const otTipo = (result.data as unknown as { ot_tipo?: string | null })?.ot_tipo;
        const pendiente = await isOtPendienteRevision(
          supabase,
          otNumero,
          otTipo,
          result.data.pasos
        );
        setPendienteRevision(pendiente);
      } else {
        setPendienteRevision(false);
      }
    } catch (e) {
      console.error("[Hoja de ruta] load", e);
      setError(e instanceof Error ? e.message : "No se pudo cargar la hoja de ruta.");
      setLoadResult(null);
      setPendienteRevision(false);
    } finally {
      setLoading(false);
    }
  }, [otNumero, supabase]);

  const loadHija = useCallback(
    async (hijaOt: string) => {
      setHijaLoading(true);
      setError(null);
      try {
        const result = await fetchHojaRutaOt(supabase, hijaOt);
        setHijaData(result);
        setDrillHijaOt(hijaOt);
      } catch (e) {
        console.error("[Hoja de ruta] load hija", e);
        setError(e instanceof Error ? e.message : "No se pudo cargar la hoja de la hija.");
      } finally {
        setHijaLoading(false);
      }
    },
    [supabase],
  );

  // Bloque 6 — Cargar perfil del usuario para permisos
  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, puede_cerrar_ot, puede_reabrir_ot")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof as ProfileConPermisos | null);
    } catch (e) {
      console.error("[Hoja de ruta] load profile", e);
      setProfile(null);
    }
  }, [supabase]);

  // Bloque 6 — Cerrar OT y enviar a histórico
  const cerrarOt = useCallback(
    async (formData: CierreOtFormData) => {
      if (!otNumero || loadResult?.kind !== "ot") return;
      
      setCerrandoOt(true);
      try {
        const snapshot = await fetchHojaRutaOt(supabase, otNumero);
        if (!snapshot) throw new Error("No se pudo cargar el snapshot de la OT.");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay sesión activa.");

        // Cargar datos adicionales de despacho (campos no incluidos en snapshot)
        const { data: despRow } = await supabase
          .from("produccion_ot_despachadas")
          .select("referencia_id, tipo_engomado, codigo_caja_embalaje, fsc")
          .eq("ot_numero", otNumero)
          .order("despachado_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Extraer datos planos del snapshot para las columnas de prod_ot_producidas
        const desp = snapshot.despacho;
        
        // Extraer horas reales de ejecuciones + datos_proceso
        let horasPrepImpresion: number | null = null;
        let horasTirajeImpresion: number | null = null;
        let horasPrepTroquelado: number | null = null;
        let horasTirajeTroquelado: number | null = null;
        
        for (const paso of snapshot.pasos) {
          const dp = paso.datosProceso as Record<string, unknown> | null;
          const procesId = paso.procesoId;
          
          // Impresión (offset=1, digital=2)
          if (procesId === 1 || procesId === 2) {
            horasPrepImpresion = (dp?.horas_entrada_real as number) ?? null;
            horasTirajeImpresion = (dp?.horas_impresion_real as number) ?? null;
          }
          // Troquelado (3)
          if (procesId === 3) {
            horasPrepTroquelado = (dp?.horas_preparacion_real as number) ?? null;
            horasTirajeTroquelado = (dp?.horas_tiraje_real as number) ?? null;
          }
        }

        // Cantidad producida: buscar en ejecuciones
        let cantidadProducida: number | null = null;
        for (const paso of snapshot.pasos) {
          if (paso.ejecucion?.cantidadUnidades != null) {
            cantidadProducida = paso.ejecucion.cantidadUnidades;
            break;
          }
        }

        // INSERT en prod_ot_producidas
        const { error: insertError } = await supabase.from("prod_ot_producidas").insert({
          ot_numero: otNumero,
          ot_id: snapshot.otId ?? null,
          referencia_id: despRow?.referencia_id ?? null,
          referencia_minerva: null, // TODO: obtener si está disponible
          referencia_cliente: null, // TODO: obtener si está disponible
          cliente: snapshot.cliente,
          trabajo: snapshot.trabajo,
          cantidad_pedida: snapshot.cantidad,
          cantidad_producida: cantidadProducida,
          material: desp?.material ?? null,
          gramaje: desp?.gramaje ?? null,
          formato: desp?.tamanoHoja ?? null,
          tintas: desp?.tintas ?? null,
          troquel: desp?.troquel ?? null,
          poses: desp?.poses ?? null,
          acabado_pral: desp?.acabadoPral ?? null,
          tipo_engomado: despRow?.tipo_engomado ?? null,
          codigo_caja_embalaje: despRow?.codigo_caja_embalaje ?? null,
          estuches_por_bulto: null, // No disponible en snapshot actual
          fsc: despRow?.fsc ?? false,
          horas_prep_impresion_reales: horasPrepImpresion,
          horas_tiraje_impresion_reales: horasTirajeImpresion,
          horas_prep_troquelado_reales: horasPrepTroquelado,
          horas_tiraje_troquelado_reales: horasTirajeTroquelado,
          // Engomado: NULL — no mapear el campo único "tiempo"
          horas_prep_engomado_reales: null,
          horas_tiraje_engomado_reales: null,
          snapshot,
          snapshot_version: 1,
          version: 1,
          cerrada_por: user.id,
          observaciones_revision: formData.observacionesRevision || null,
          excluido_de_promedios: formData.excluidoDePromedios,
          motivo_exclusion: formData.excluidoDePromedios ? formData.motivoExclusion : null,
        });

        if (insertError) throw insertError;

        toast.success(`OT ${otNumero} cerrada y enviada a histórico.`);
        setCierreDialogOpen(false);
        await load(); // Recargar para que el botón desaparezca
      } catch (e) {
        console.error("[Hoja de ruta] cerrar OT", e);
        const msg = errorMessageFromUnknown(e, "No se pudo cerrar la OT.");
        toast.error(msg);
      } finally {
        setCerrandoOt(false);
      }
    },
    [otNumero, loadResult, supabase, load],
  );

  useEffect(() => {
    if (open && otNumero) void load();
    if (!open) {
      setLoadResult(null);
      setDrillHijaOt(null);
      setHijaData(null);
      setError(null);
      setPendienteRevision(false);
    }
  }, [open, otNumero, load]);

  useEffect(() => {
    if (open) void loadProfile();
  }, [open, loadProfile]);

  const isContenedorView = loadResult?.kind === "contenedor" && !drillHijaOt;
  const canExportPdf =
    (drillHijaOt && hijaData) ||
    loadResult?.kind === "ot" ||
    (loadResult?.kind === "contenedor" && loadResult.hijas.length > 0);

  // Bloque 6 — Mostrar botón de cierre solo si puede y está pendiente
  const puedeVerBotonCierre = puedeCerrarOt(profile) && pendienteRevision && loadResult?.kind === "ot";

  // Checklist para el diálogo de cierre
  const checklist = useMemo((): CierrePrevioChecklistData => {
    if (loadResult?.kind !== "ot") {
      return {
        pasosFinalizados: false,
        cantidadProducida: false,
        horasCoherentes: false,
        incidenciasRevisadas: false,
        embalajeInformado: false,
      };
    }
    const data = loadResult.data;
    const pasosOk = data.pasos.length > 0 && data.pasos.every(p => 
      String(p.estado ?? "").trim().toLowerCase() === "finalizado"
    );
    const cantidadOk = data.pasos.some(p => p.ejecucion?.cantidadUnidades != null);
    const horasOk = data.pasos.some(p => p.ejecucion?.horasReales != null && p.ejecucion.horasReales > 0);
    const incidenciasOk = !data.pasos.some(p => p.ejecucion?.incidencia);
    const embalajeOk = true; // Aviso no bloqueante; datos de embalaje se obtienen en el cierre
    
    return {
      pasosFinalizados: pasosOk,
      cantidadProducida: cantidadOk,
      horasCoherentes: horasOk,
      incidenciasRevisadas: incidenciasOk,
      embalajeInformado: embalajeOk,
    };
  }, [loadResult]);

  const handlePdfExport = useCallback(async () => {
    if (drillHijaOt && hijaData) {
      exportHojaRutaPdf(hijaData);
      return;
    }
    if (loadResult?.kind === "ot") {
      exportHojaRutaPdf(loadResult.data);
      return;
    }
    if (loadResult?.kind !== "contenedor" || loadResult.hijas.length === 0) return;

    setPdfExporting(true);
    setError(null);
    try {
      const hijasFull = await Promise.all(
        loadResult.hijas.map((h) => fetchHojaRutaOt(supabase, h.otNumero)),
      );
      exportHojaRutaContenedorPdf(
        loadResult,
        hijasFull.filter((h): h is HojaRutaData => h != null),
      );
    } catch (e) {
      console.error("[Hoja de ruta] export PDF barco", e);
      setError(errorMessageFromUnknown(e, "No se pudo generar el PDF del barco."));
    } finally {
      setPdfExporting(false);
    }
  }, [drillHijaOt, hijaData, loadResult, supabase]);

  const handlePdfSimplificada = useCallback(async () => {
    if (drillHijaOt && hijaData) {
      exportHojaRutaCartelitaPdf(cartelitaInputFromHojaRuta(hijaData));
      return;
    }
    if (loadResult?.kind === "ot") {
      exportHojaRutaCartelitaPdf(cartelitaInputFromHojaRuta(loadResult.data));
      return;
    }
    if (loadResult?.kind !== "contenedor" || loadResult.hijas.length === 0) return;

    setPdfExporting(true);
    setError(null);
    try {
      const hijasFull = await Promise.all(
        loadResult.hijas.map((h) => fetchHojaRutaOt(supabase, h.otNumero)),
      );
      const pack = buildCartelitaPackFromHojaRutaLoad(
        loadResult,
        hijasFull.filter((h): h is HojaRutaData => h != null),
      );
      exportHojaRutaCartelitaPdf(pack);
    } catch (e) {
      console.error("[Hoja de ruta] export PDF simplificada", e);
      setError(
        errorMessageFromUnknown(e, "No se pudo generar la hoja de ruta simplificada."),
      );
    } finally {
      setPdfExporting(false);
    }
  }, [drillHijaOt, hijaData, loadResult, supabase]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(94vh,880px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          {drillHijaOt && padreNumero ? (
            <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono hover:bg-slate-100 hover:text-[#002147]"
                onClick={goBackToBarco}
              >
                <ChevronLeft className="size-3.5" />
                {padreNumero}
              </button>
              <span aria-hidden>›</span>
              <span className="font-mono font-semibold text-[#002147]">{drillHijaOt}</span>
            </div>
          ) : null}
          <DialogTitle className="text-base">
            Hoja de ruta · OT{" "}
            <span className="font-mono text-sm font-semibold text-[#002147]">
              {drillHijaOt ?? otNumero ?? ""}
            </span>
            {isContenedorView ? (
              <span className="ml-1.5 text-xs font-normal text-indigo-700">(barco)</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isContenedorView
              ? "Resumen comercial del pedido y avance agregado de las hijas de ejecución."
              : "Itinerario completo con datos capturados por proceso, ejecución real y externos."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading || hijaLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Cargando hoja de ruta…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="size-4" />
              {error}
            </div>
          ) : !loadResult ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No se encontró información para esta OT.
            </div>
          ) : drillHijaOt && hijaData ? (
            <div className="space-y-4">
              <HojaRutaHeader data={hijaData} />
              <HojaRutaPasosDetail data={hijaData} />
            </div>
          ) : loadResult.kind === "contenedor" ? (
            <div className="space-y-4">
              <HojaRutaHeader data={loadResult.padre} />
              <HojaRutaContenedorPanel data={loadResult} onVerHoja={(h) => void loadHija(h)} />
            </div>
          ) : (
            <div className="space-y-4">
              <HojaRutaHeader data={loadResult.data} />
              <HojaRutaPasosDetail data={loadResult.data} />
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:px-5">
          <div className="flex flex-wrap gap-2">
            {puedeVerBotonCierre ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setCierreDialogOpen(true)}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <Archive className="size-4" />
                Cerrar y enviar a histórico
              </Button>
            ) : null}
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
              variant="outline"
              size="sm"
              disabled={loading || hijaLoading}
              onClick={() => {
                if (drillHijaOt) void loadHija(drillHijaOt);
                else void load();
              }}
              title="Recargar datos de la hoja de ruta"
            >
              <RefreshCw
                className={`mr-2 size-4 ${loading || hijaLoading ? "animate-spin" : ""}`}
              />
              Recargar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={loading || hijaLoading || pdfExporting || !canExportPdf}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                title="Descargar PDF de la hoja de ruta"
              >
                <Download
                  className={`size-4 ${pdfExporting ? "animate-pulse" : ""}`}
                />
                {pdfExporting ? "Generando…" : "PDF"}
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">
                <DropdownMenuLabel>Tipo de PDF</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  disabled={pdfExporting}
                  onClick={() => void handlePdfExport()}
                >
                  <FileText className="size-4 opacity-70" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Completa</span>
                    <span className="text-muted-foreground text-xs">
                      {isContenedorView
                        ? "Resumen barco + anexo por hija"
                        : "Itinerario con datos de proceso y ejecución"}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  disabled={pdfExporting}
                  onClick={() => void handlePdfSimplificada()}
                >
                  <Download className="size-4 opacity-70" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Simplificada (A5)</span>
                    <span className="text-muted-foreground text-xs">
                      {isContenedorView
                        ? "Portada barco + 1 hoja por forma"
                        : "Cartelita para planta (itinerario + firmas)"}
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001a38]"
            onClick={() => {
              if (drillHijaOt) goBackToBarco();
              else onOpenChange(false);
            }}
          >
            {drillHijaOt ? "Volver al barco" : "Cerrar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Bloque 6 — Diálogo de cierre */}
      {puedeVerBotonCierre ? (
        <CierreOtDialog
          open={cierreDialogOpen}
          onOpenChange={setCierreDialogOpen}
          otNumero={otNumero ?? ""}
          checklist={checklist}
          onConfirm={cerrarOt}
          saving={cerrandoOt}
        />
      ) : null}
    </Dialog>
  );
}
