"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Map as MapIcon,
  Pause,
  Play,
  RefreshCcw,
  Truck,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Json } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasoAdminActions } from "@/components/produccion/planificacion/paso-admin-actions";
import { CerrarProcesoDialog } from "@/components/produccion/planificacion/cerrar-proceso-dialog";
import type { ProfileConPermisos } from "@/lib/prod-ot-cierre-permisos";
import { CtpEjecucionRequisitosBlock } from "@/components/produccion/planificacion/ctp-ejecucion-requisitos-block";
import { aplicarConsumoCartelaSiCorresponde, validarCartelaConsumoAntesCerrar } from "@/lib/cartela-stock-consumo";
import { procesoUsaCartela, type PasoItinerarioConsumo } from "@/lib/cartela-ejecucion";
import {
  derivarOtAImpresionExterna,
  devolverHuecoMesaAlPool,
} from "@/lib/derivar-impresion-externa";
import { PROCESO_DIGITAL_ID, PROCESO_OFFSET_ID, PROCESO_TROQUEL_ID } from "@/lib/despacho-wizard-shared";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  exportEjecucionesExcel,
  exportEjecucionesPdf,
} from "@/lib/planificacion-ejecucion-export";
import {
  applyHorasMesaToDatosProceso,
  buildEjecucionHorasSyncPatch,
  computeHorasMesaNetas,
} from "@/lib/planificacion-ejecucion-horas";
import {
  etiquetaAmbitoPlanificacion,
  getPlanificacionTipoMaquinaFilter,
  PLANIFICACION_TIPOS_MAQUINA,
} from "@/lib/planificacion-ambito";
import {
  contenedorCtpVirtualId,
  crearEjecucionLigeraCtp,
  fetchContenedorCtpPasosDisponibles,
  fetchMaquinaCtpActiva,
  isContenedorCtpVirtualId,
  parseContenedorCtpVirtualId,
  type ContenedorCtpPaso,
} from "@/lib/contenedor-ctp";
import {
  contenedorTroquelVirtualId,
  crearEjecucionLigeraTroquel,
  fetchContenedorTroquelPasosDisponibles,
  fetchMaquinasTroquelActivas,
  isContenedorTroquelVirtualId,
  parseContenedorTroquelVirtualId,
  type ContenedorTroquelMaquina,
  type ContenedorTroquelPaso,
} from "@/lib/contenedor-troquel";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import { useFormatoMargenParametros } from "@/hooks/use-formato-margen-parametros";
import { useSysParametrosSobreproduccion } from "@/hooks/use-sys-parametros-sobreproduccion";
import { formatoCabeAvisoEjecucion } from "@/lib/formato-cabe-ejecucion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import { cn } from "@/lib/utils";
import {
  getCamposConfigByProcesoId,
  PROCESO_CAMPOS_CONFIG,
  PROCESO_CTP_ID,
  PROCESO_DESBROCE_ID,
} from "@/lib/hoja-ruta-campos-config";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import {
  CTP_REQUISITO_DEFS,
  ctpRequisitosPendientes,
} from "@/lib/ctp-despacho";
import {
  buildComponentesDesbroceSeed,
  hojasNetasFormaFromComponentes,
  shouldShowNoMezclarBanner,
  TABLE_HIJA_COMPONENTES,
  totalEstuchesFormaComponentes,
  type HijaComponenteRow,
  type OtHijaMeta,
} from "@/lib/desbroce-hija-componentes";
import {
  margenSobreproduccionPorProceso,
  type SobreproduccionMargenesParametros,
} from "@/lib/sys-parametros-sobreproduccion";
import {
  aplicarPrefillFormatoEncadenado,
  buildFormatoAnteriorByOtPasoId,
  type PasoItinerarioFormato,
} from "@/lib/hoja-ruta-formato-encadenado";
import { resolveSalidaAnteriorPorItinerario } from "@/lib/hoja-ruta-salida-encadenado";
import { DatosProcesoForm } from "@/components/produccion/hoja-ruta/datos-proceso-form";
import { HojaRutaOtDialog } from "@/components/produccion/hoja-ruta/hoja-ruta-ot-dialog";
import type {
  EstadoEjecucionMesa,
  MesaEjecucion,
  MesaEjecucionPausa,
  MotivoPausa,
  MotivoPausaCategoria,
} from "@/types/planificacion-mesa";

const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_EJECUCIONES_PAUSAS = "prod_mesa_ejecuciones_pausas";
const TABLE_MOTIVOS_PAUSA = "sys_motivos_pausa";
const TABLE_MAQUINAS = "prod_maquinas";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_OT_PASOS = "prod_ot_pasos";
const TABLE_DESPACHO = "produccion_ot_despachadas";
const TABLE_DESPACHO_MATERIALES_LINEAS = "prod_despacho_materiales_lineas";
const TABLE_OTS_GENERAL = "prod_ots_general";
const TABLE_TROQUELES = "prod_troqueles";

/** Igual espíritu que calendario: OTs lab ≥98000 ocultas por defecto. */
const STORAGE_EJECUCION_MOSTRAR_PRUEBAS = "minerva.ejecucion.mostrarPruebas";
const STORAGE_EJECUCION_SOLO_EJECUTABLE_CTP =
  "minerva.ejecucion.contenedorCtp.soloEjecutable";

function readLocalFlag(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return defaultValue;
}

function buildContenedorCtpVirtualRow(
  paso: ContenedorCtpPaso,
  maquina: { id: string; nombre: string; tipoMaquina: string },
): MesaEjecucion {
  const nowIso = new Date().toISOString();
  return {
    id: contenedorCtpVirtualId(paso.otPasoId),
    mesaTrabajoId: null,
    otPasoId: paso.otPasoId,
    otId: paso.otId,
    procesoId: PROCESO_CTP_ID,
    datosProcesoJson: paso.datosProceso,
    procesoAnteriorId: null,
    salidaProcesoAnterior: null,
    salidaProcesoAnteriorNombre: null,
    formatoAnterior: null,
    formatoAnteriorOrigenNombre: null,
    ot: paso.otNumero,
    maquinaId: maquina.id,
    maquinaNombre: maquina.nombre,
    maquinaTipo: maquina.tipoMaquina,
    fechaPlanificada: null,
    turno: null,
    slotOrden: null,
    liberadaAt: null,
    inicioRealAt: null,
    finRealAt: null,
    estadoEjecucion: "pendiente_inicio",
    pausaActivaDesde: null,
    motivoPausaActiva: null,
    motivoPausaCategoriaActiva: null,
    motivoPausaColorHexActiva: null,
    haEstadoPausada: false,
    numPausas: 0,
    minutosPausadaAcum: 0,
    horasPlanificadasSnapshot: 0.25,
    horasReales: null,
    horasRealesEntrada: null,
    horasRealesTiraje: null,
    horasRealesTroquelado: null,
    horasRealesEngomado: null,
    numHojasProducidas: null,
    cantidadUnidades: null,
    incidencia: null,
    accionCorrectiva: null,
    maquinista: null,
    densidadesJson: null,
    observaciones: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    origenContenedorCtp: true,
  };
}

function buildContenedorTroquelVirtualRow(
  paso: ContenedorTroquelPaso,
): MesaEjecucion {
  const nowIso = new Date().toISOString();
  return {
    id: contenedorTroquelVirtualId(paso.otPasoId),
    mesaTrabajoId: null,
    otPasoId: paso.otPasoId,
    otId: paso.otId,
    procesoId: PROCESO_TROQUEL_ID,
    datosProcesoJson: paso.datosProceso,
    procesoAnteriorId: null,
    salidaProcesoAnterior: null,
    salidaProcesoAnteriorNombre: null,
    formatoAnterior: null,
    formatoAnteriorOrigenNombre: null,
    ot: paso.otNumero,
    // Claim al iniciar: aún sin máquina concreta.
    maquinaId: "",
    maquinaNombre: "Troquelado (elegir al iniciar)",
    maquinaTipo: "troquelado",
    fechaPlanificada: null,
    turno: null,
    slotOrden: null,
    liberadaAt: null,
    inicioRealAt: null,
    finRealAt: null,
    estadoEjecucion: "pendiente_inicio",
    pausaActivaDesde: null,
    motivoPausaActiva: null,
    motivoPausaCategoriaActiva: null,
    motivoPausaColorHexActiva: null,
    haEstadoPausada: false,
    numPausas: 0,
    minutosPausadaAcum: 0,
    horasPlanificadasSnapshot: paso.horasPlanificadas,
    horasReales: null,
    horasRealesEntrada: null,
    horasRealesTiraje: null,
    horasRealesTroquelado: null,
    horasRealesEngomado: null,
    numHojasProducidas: null,
    cantidadUnidades: null,
    incidencia: null,
    accionCorrectiva: null,
    maquinista: null,
    densidadesJson: null,
    observaciones: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    origenContenedorTroquel: true,
  };
}

const EJECUCION_COLUMNS =
  "id, mesa_trabajo_id, ot_paso_id, ot_numero, maquina_id, fecha_planificada, turno, slot_orden, liberada_at, inicio_real_at, fin_real_at, estado_ejecucion, ha_estado_pausada, num_pausas, minutos_pausada_acum, horas_planificadas_snapshot, horas_reales, horas_reales_entrada, horas_reales_tiraje, horas_reales_troquelado, horas_reales_engomado, num_hojas_producidas, cantidad_unidades, incidencia, accion_correctiva, maquinista, densidades_json, observaciones, created_at, updated_at, prod_maquinas(nombre,tipo_maquina), prod_ot_pasos(ot_id,orden,proceso_id,datos_proceso)";

const ESTADOS_ACTIVAS: EstadoEjecucionMesa[] = [
  "pendiente_inicio",
  "en_curso",
  "pausada",
];
const HISTORICO_EJECUCION_LIMIT = 200;

function startOfLocalDayIso(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

type OtMetaInfo = {
  otTipo: string | null;
  otPadreNumero: string | null;
  tipoHija: string | null;
  formaDescripcion: string | null;
};

type DespachoInfo = {
  cliente: string | null;
  cantidad: number | null;
  titulo: string | null;
  material: string | null;
  gramaje: number | null;
  tamanoHoja: string | null;
  hojasBrutas: number | null;
  hojasNetas: number | null;
  tintas: string | null;
  acabadoPral: string | null;
  troquel: string | null;
  poses: number | null;
  tamanoCorte: string | null;
  pinza: number | null;
  expulsor: "mascle" | "femella" | "completo" | null;
  cauchoAcrilico: string | null;
  horasEntrada: number | null;
  horasTiraje: number | null;
  horasTroquelado: number | null;
  horasEngomadoPrep: number | null;
  horasEngomadoTiraje: number | null;
  horasEngomado: number | null;
  tipoEngomado: string | null;
  fechaEntrega: string | null;
  materiales: MaterialLineaInfo[];
};

type MaterialLineaInfo = {
  descripcion: string;
  tipo: string | null;
  orden: number | null;
  soporteImpresion: boolean;
};

type TroquelInfoRow = {
  num_troquel: string | null;
  mides: string | null;
  num_figuras: number | string | null;
  figuras_hoja: number | string | null;
  pinza: number | string | null;
  expulsion: string | null;
  num_expulsion: string | null;
  caucho_acrilico: string | null;
};

type EjecucionRow = {
  id: string;
  mesa_trabajo_id: string | null;
  ot_paso_id: string | null;
  ot_numero: string;
  maquina_id: string;
  prod_maquinas?: { nombre: string | null; tipo_maquina: string | null } | null;
  prod_ot_pasos?: {
    ot_id: string | null;
    orden: number | null;
    proceso_id: number | null;
    datos_proceso: Record<string, unknown> | null;
  } | null;
  fecha_planificada: string | null;
  turno: string | null;
  slot_orden: number | null;
  liberada_at: string | null;
  inicio_real_at: string | null;
  fin_real_at: string | null;
  estado_ejecucion: EstadoEjecucionMesa;
  ha_estado_pausada: boolean | null;
  num_pausas: number | string | null;
  minutos_pausada_acum: number | string | null;
  horas_planificadas_snapshot: number | string | null;
  horas_reales: number | string | null;
  horas_reales_entrada: number | string | null;
  horas_reales_tiraje: number | string | null;
  horas_reales_troquelado: number | string | null;
  horas_reales_engomado: number | string | null;
  num_hojas_producidas: number | string | null;
  cantidad_unidades: number | string | null;
  incidencia: string | null;
  accion_correctiva: string | null;
  maquinista: string | null;
  densidades_json: Record<string, unknown> | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

type MotivoPausaRow = {
  id: string;
  slug: string;
  label: string;
  categoria: MotivoPausaCategoria;
  color_hex: string;
  activo: boolean;
  orden: number | string | null;
  tipos_maquina: string[] | null;
};

type PausaRow = {
  id: string;
  ejecucion_id: string;
  paused_at: string;
  resumed_at: string | null;
  motivo_id: string;
  observaciones_pausa: string | null;
  minutos_pausa: number | string | null;
  created_at: string | null;
  sys_motivos_pausa?: MotivoPausaRow | MotivoPausaRow[] | null;
};

function parseNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTroquelKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function mapExpulsor(value: unknown): DespachoInfo["expulsor"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("complet")) return "completo";
  if (raw.includes("mascle") || raw.includes("macho")) return "mascle";
  if (raw.includes("femella") || raw.includes("hembra")) return "femella";
  return null;
}

function parseMeasurementNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  return parseNum(match[0]);
}

function isDatoProcesoEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

/**
 * Desbroce: hojas de entrada = salida real del troquel cuando existe.
 * Las netas de componentes/wizard son solo fallback de plan (p. ej. 600);
 * si troquel dejó 575, el formulario debe arrancar en 575 y recalcular estuches.
 */
function enrichDesbroceDatosProceso(
  datos: DatosProcesoGenerico,
  opts: {
    salidaProcesoAnterior: number | null | undefined;
    hijaComponentes: HijaComponenteRow[];
    despachoPoses: number | null | undefined;
  },
): DatosProcesoGenerico {
  const next: DatosProcesoGenerico = { ...datos };
  const comps = opts.hijaComponentes;
  const salida =
    opts.salidaProcesoAnterior != null &&
    Number.isFinite(opts.salidaProcesoAnterior) &&
    opts.salidaProcesoAnterior > 0
      ? Math.max(0, Math.trunc(opts.salidaProcesoAnterior))
      : null;

  if (salida != null) {
    next.hojas_entrada = salida;
  } else if (isDatoProcesoEmpty(next.hojas_entrada)) {
    const hojasNetas = hojasNetasFormaFromComponentes(comps);
    if (hojasNetas != null && hojasNetas > 0) {
      next.hojas_entrada = hojasNetas;
    }
  }

  if (isDatoProcesoEmpty(next.poses)) {
    const posesComp = comps[0]?.poses_en_forma;
    if (posesComp != null && posesComp > 0) {
      next.poses = posesComp;
    } else if (opts.despachoPoses != null && opts.despachoPoses > 0) {
      next.poses = opts.despachoPoses;
    }
  }

  const hojas = toFiniteNum(next.hojas_entrada);
  const poses = toFiniteNum(next.poses);
  if (hojas != null && poses != null && poses > 0) {
    // Con salida real del anterior, siempre alinear estuches a hojas×poses
    // (evita dejar el pedido teórico 2400 con 575 hojas).
    if (salida != null || isDatoProcesoEmpty(next.estuches_desbrozados)) {
      next.estuches_desbrozados = Math.max(0, Math.floor(hojas * poses));
    }
  } else if (isDatoProcesoEmpty(next.estuches_desbrozados) && comps.length > 0) {
    const total = totalEstuchesFormaComponentes(comps);
    if (total > 0) next.estuches_desbrozados = total;
  }

  if (
    comps.length > 0 &&
    (isDatoProcesoEmpty(next.componentes_forma) || !Array.isArray(next.componentes_forma))
  ) {
    next.componentes_forma = buildComponentesDesbroceSeed(comps);
  }

  return next;
}

/**
 * Troquel ejecución form expects poses / hojas_troquelar / pinza / etc.
 * Despacho seed historically wrote num_figuras / hojas_a_troquelar only,
 * and skipped catalog fill when datos_proceso was already non-empty.
 */
function enrichTroquelDatosProceso(
  datos: DatosProcesoGenerico,
  despacho: DespachoInfo | null | undefined,
  salidaProcesoAnterior: number | null | undefined,
): DatosProcesoGenerico {
  const next: DatosProcesoGenerico = { ...datos };

  if (isDatoProcesoEmpty(next.poses) && !isDatoProcesoEmpty(next.num_figuras)) {
    next.poses = next.num_figuras;
  }

  if (despacho) {
    if (isDatoProcesoEmpty(next.troquel) && despacho.troquel) {
      next.troquel = despacho.troquel;
    }
    if (isDatoProcesoEmpty(next.poses) && despacho.poses != null) {
      next.poses = despacho.poses;
    }
    if (isDatoProcesoEmpty(next.tamano_corte) && despacho.tamanoCorte) {
      next.tamano_corte = despacho.tamanoCorte;
    }
    if (isDatoProcesoEmpty(next.pinza) && despacho.pinza != null) {
      next.pinza = despacho.pinza;
    }
    if (isDatoProcesoEmpty(next.expulsor) && despacho.expulsor) {
      next.expulsor = despacho.expulsor;
    }
    if (isDatoProcesoEmpty(next.codigo_caucho) && despacho.cauchoAcrilico) {
      next.codigo_caucho = despacho.cauchoAcrilico;
    }
  }

  // Hojas de trabajo: salida real del proceso anterior pisa el plan de despacho
  // (igual que Desbroce). El plan se guarda en hojas_troquelar_plan.
  const salida =
    salidaProcesoAnterior != null && Number.isFinite(salidaProcesoAnterior)
      ? Math.max(0, Math.trunc(salidaProcesoAnterior))
      : null;
  if (salida != null && salida > 0) {
    const prevWorking = toFiniteNum(next.hojas_troquelar);
    if (
      isDatoProcesoEmpty(next.hojas_troquelar_plan) &&
      prevWorking != null &&
      prevWorking > 0 &&
      prevWorking !== salida
    ) {
      next.hojas_troquelar_plan = prevWorking;
    }
    next.hojas_troquelar = salida;
    const prevTroqueladas = toFiniteNum(next.hojas_troqueladas);
    if (prevTroqueladas == null || prevTroqueladas === prevWorking) {
      next.hojas_troqueladas = salida;
      if (isDatoProcesoEmpty(next.hojas_merma)) next.hojas_merma = 0;
    }
  } else if (isDatoProcesoEmpty(next.hojas_troquelar)) {
    if (!isDatoProcesoEmpty(next.hojas_a_troquelar)) {
      next.hojas_troquelar = next.hojas_a_troquelar;
    } else if (despacho?.hojasBrutas != null && despacho.hojasBrutas > 0) {
      next.hojas_troquelar = Math.max(0, Math.trunc(despacho.hojasBrutas));
    }
  }

  return next;
}

/**
 * Engomado: despacho seed wrote unidades_por_paquete; form expects estuches_por_bulto.
 * Bultos/palet come from prod_cajas_embalaje.bultos_por_palet_default when caja is set.
 */
function enrichEngomadoDatosProceso(
  datos: DatosProcesoGenerico,
  cajasDefaultByCodigo: Map<string, number>,
): DatosProcesoGenerico {
  const next: DatosProcesoGenerico = { ...datos };

  if (
    isDatoProcesoEmpty(next.estuches_por_bulto) &&
    !isDatoProcesoEmpty(next.unidades_por_paquete)
  ) {
    next.estuches_por_bulto = next.unidades_por_paquete;
  }

  const caja = String(next.codigo_caja_embalaje ?? "").trim();
  if (caja && isDatoProcesoEmpty(next.bultos_por_palet)) {
    const def = cajasDefaultByCodigo.get(caja);
    if (def != null) next.bultos_por_palet = def;
  }

  const estuches =
    toFiniteNum(next.estuches_engomados) ??
    toFiniteNum(next.cantidad_total) ??
    toFiniteNum(next.estuches_realizar);
  const porBulto = toFiniteNum(next.estuches_por_bulto);
  const bultosPorPalet = toFiniteNum(next.bultos_por_palet);
  const reparto = computeEngomadoReparto(estuches, porBulto, bultosPorPalet);
  if (reparto.bultos_completos != null) next.bultos_completos = reparto.bultos_completos;
  if (reparto.pico != null) next.pico = reparto.pico;
  if (reparto.bultos_totales != null) next.bultos_totales = reparto.bultos_totales;
  if (reparto.palets != null) next.palets = reparto.palets;

  return next;
}

function isTruthyDatoProceso(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * Manipulados: paquetes retractilar/etiquetar +, si Encajar, mismo reparto que Engomado.
 * No alias `unidades_por_paquete` → `estuches_por_bulto` (ese id es retractilar).
 */
function enrichManipuladoDatosProceso(
  datos: DatosProcesoGenerico,
  cajasDefaultByCodigo: Map<string, number>,
): DatosProcesoGenerico {
  const next: DatosProcesoGenerico = { ...datos };
  const unidades = toFiniteNum(next.unidades);
  const udsRetractilar = toFiniteNum(next.unidades_por_paquete);
  const udsEtiqueta = toFiniteNum(next.unidades_por_paquete_etiqueta);

  if (unidades != null && udsRetractilar != null && udsRetractilar > 0) {
    next.num_paquetes = Math.ceil(unidades / udsRetractilar);
  }
  if (unidades != null && udsEtiqueta != null && udsEtiqueta > 0) {
    next.num_paquetes_etiqueta = Math.ceil(unidades / udsEtiqueta);
  }

  const encajar =
    isTruthyDatoProceso(next.encajar) ||
    String(next.codigo_caja_embalaje ?? "").trim() !== "" ||
    toFiniteNum(next.estuches_por_bulto) != null;
  if (!encajar) return next;

  const caja = String(next.codigo_caja_embalaje ?? "").trim();
  if (caja && isDatoProcesoEmpty(next.bultos_por_palet)) {
    const def = cajasDefaultByCodigo.get(caja);
    if (def != null) next.bultos_por_palet = def;
  }

  const porBulto = toFiniteNum(next.estuches_por_bulto);
  const bultosPorPalet = toFiniteNum(next.bultos_por_palet);
  const reparto = computeEngomadoReparto(unidades, porBulto, bultosPorPalet);
  if (reparto.bultos_completos != null) next.bultos_completos = reparto.bultos_completos;
  if (reparto.pico != null) next.pico = reparto.pico;
  if (reparto.bultos_totales != null) next.bultos_totales = reparto.bultos_totales;
  if (reparto.palets != null) next.palets = reparto.palets;

  return next;
}

function seedRealValuesFromPrevistos(
  procesoId: number | null | undefined,
  datos: DatosProcesoGenerico,
): DatosProcesoGenerico {
  if (!procesoId) return datos;
  const config = getCamposConfigByProcesoId(procesoId);
  if (!config) return datos;

  let changed = false;
  const next: DatosProcesoGenerico = { ...datos };
  for (const campo of config.campos) {
    if (!campo.hasPrevistoReal) continue;
    const previstoKey = `${campo.id}_previsto`;
    const realKey = `${campo.id}_real`;
    const previsto = next[previstoKey];
    if (isDatoProcesoEmpty(previsto) || !isDatoProcesoEmpty(next[realKey])) continue;
    next[realKey] = previsto;
    changed = true;
  }

  return changed ? next : datos;
}

const PROCESOS_IMPRESION = new Set([1, 2]);
const PROCESO_ENGOMADO = 12;
const PROCESO_MANIPULADOS = 15;

type CajaEmbalajeOption = {
  codigo: string;
  descripcion: string | null;
  bultos_por_palet_default: number | null;
};

type CatalogosEjecucion = {
  motivos: MotivoPausa[];
  cajas: CajaEmbalajeOption[];
  tiposEngomado: string[];
  maqRows: Array<{ id: string; nombre: string; tipo_maquina: string | null }>;
};

/**
 * Tolerancia de bultos "sueltos" que se aceptan apilados sobre un palet ya
 * existente antes de abrir uno nuevo. Regla de logística (Gabri): es preferible
 * un palet algo cargado que dos casi vacíos por un pico de pocas cajas.
 */
const PALET_TOLERANCIA_BULTOS = 1;

function toFiniteNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Hojas plan de impresión: proceso anterior → netas plan → brutas plan → despacho. */
function hojasEntradaImpresionEjecucion(
  salidaAnterior: number | null | undefined,
  datos: DatosProcesoGenerico,
  despacho: DespachoInfo | null | undefined,
): number | null {
  if (
    salidaAnterior != null &&
    Number.isFinite(salidaAnterior) &&
    salidaAnterior > 0
  ) {
    return Math.trunc(salidaAnterior);
  }
  const netasPlan =
    toFiniteNum(datos.hojas_netas) ?? toFiniteNum(datos.hojas_impresas);
  if (netasPlan != null && netasPlan > 0) return netasPlan;
  const brutasPlan = toFiniteNum(datos.hojas_brutas);
  if (brutasPlan != null && brutasPlan > 0) return brutasPlan;
  const netasDespacho = despacho?.hojasNetas;
  if (netasDespacho != null && netasDespacho > 0) return netasDespacho;
  if (despacho?.hojasBrutas != null && despacho.hojasBrutas > 0) {
    return despacho.hojasBrutas;
  }
  return null;
}

/**
 * Reparto en bultos/picos/palets para Engomado.
 * - bultos_completos = floor(estuches / estuches_por_bulto)
 * - pico = resto (estuches del bulto incompleto)
 * - bultos_totales = completos + (pico > 0 ? 1 : 0)
 * - palets: con tolerancia, no abre palet nuevo por un pico de <= tolerancia bultos.
 */
function computeEngomadoReparto(
  estuches: number | null,
  porBulto: number | null,
  bultosPorPalet: number | null,
): {
  bultos_completos?: number;
  pico?: number;
  bultos_totales?: number;
  palets?: number;
} {
  const result: {
    bultos_completos?: number;
    pico?: number;
    bultos_totales?: number;
    palets?: number;
  } = {};
  if (estuches == null || porBulto == null || porBulto <= 0) return result;

  const completos = Math.floor(estuches / porBulto);
  const pico = estuches - completos * porBulto;
  const totales = completos + (pico > 0 ? 1 : 0);
  result.bultos_completos = completos;
  result.pico = pico;
  result.bultos_totales = totales;

  if (bultosPorPalet != null && bultosPorPalet > 0 && totales > 0) {
    const full = Math.floor(totales / bultosPorPalet);
    const resto = totales - full * bultosPorPalet;
    let palets: number;
    if (resto === 0) {
      palets = full;
    } else if (full >= 1 && resto <= PALET_TOLERANCIA_BULTOS) {
      palets = full; // el pico se sube encima de un palet existente
    } else {
      palets = full + 1;
    }
    result.palets = Math.max(palets, 1);
  } else if (totales > 0) {
    result.palets = undefined;
  }

  return result;
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isLikelyImpressionSupport(value: unknown): boolean {
  const raw = normalizeSearchText(value);
  if (!raw) return false;
  if (/(microcanal|onduforma|ondulado|contracol|canal|carton ondulado)/.test(raw)) {
    return false;
  }
  if (/(dorso gris|folding|cartoncill|estucad|couche|cartulina|zenith|aliking|offset|kraft)/.test(raw)) {
    return true;
  }
  return true;
}

function materialOptionsForDespacho(despacho: DespachoInfo | null): { value: string; label: string }[] {
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];
  const push = (value: unknown, labelSuffix?: string) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    const key = normalizeSearchText(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ value: text, label: labelSuffix ? `${text} · ${labelSuffix}` : text });
  };

  const sorted = [...(despacho?.materiales ?? [])].sort((a, b) => {
    if (a.soporteImpresion !== b.soporteImpresion) return a.soporteImpresion ? -1 : 1;
    return (a.orden ?? 9999) - (b.orden ?? 9999);
  });
  for (const linea of sorted) {
    push(linea.descripcion, linea.tipo?.trim() || undefined);
  }
  push(despacho?.material, "material despacho");
  return options;
}

function pickMaterialImpresion(despacho: DespachoInfo | null): string | null {
  const options = materialOptionsForDespacho(despacho).map((opt) => opt.value);
  const marcado = despacho?.materiales.find((m) => m.soporteImpresion && m.descripcion.trim());
  if (marcado) return marcado.descripcion.trim();
  return options.find(isLikelyImpressionSupport) ?? options[0] ?? null;
}

/**
 * Deriva campos para reducir picado en planta:
 * - Impresión: buenas ↔ merma desde brutas (papel a máquina).
 * - Troquelado: troqueladas ↔ merma desde hojas a troquelar.
 * - Engomado: cantidad total = estuches engomados y palets por embalaje.
 */
function computeDerivedDatosProceso(
  procesoId: number | null | undefined,
  datos: DatosProcesoGenerico,
  changedFieldId: string,
): DatosProcesoGenerico {
  if (!procesoId) return datos;

  if (PROCESOS_IMPRESION.has(procesoId)) {
    const base = toFiniteNum(datos.hojas_brutas) ?? toFiniteNum(datos.hojas_netas);
    if (base == null) return datos;

    if (changedFieldId === "hojas_merma") {
      const merma = toFiniteNum(datos.hojas_merma);
      if (merma == null) return datos;
      return { ...datos, hojas_impresas: Math.max(0, base - merma) };
    }

    if (changedFieldId === "hojas_impresas") {
      const buenas = toFiniteNum(datos.hojas_impresas);
      if (buenas == null) return datos;
      return { ...datos, hojas_merma: Math.max(0, base - buenas) };
    }

    // Si cambian las bases, recalculamos buenas desde la merma conocida.
    if (changedFieldId === "hojas_netas" || changedFieldId === "hojas_brutas") {
      const merma = toFiniteNum(datos.hojas_merma) ?? 0;
      return { ...datos, hojas_impresas: Math.max(0, base - merma) };
    }
  }

  if (procesoId === 10) {
    const base = toFiniteNum(datos.hojas_troquelar);
    if (base == null) return datos;

    if (changedFieldId === "hojas_merma") {
      const merma = toFiniteNum(datos.hojas_merma);
      if (merma == null) return datos;
      return { ...datos, hojas_troqueladas: Math.max(0, base - merma) };
    }

    if (changedFieldId === "hojas_troqueladas") {
      const troqueladas = toFiniteNum(datos.hojas_troqueladas);
      if (troqueladas == null) return datos;
      return { ...datos, hojas_merma: Math.max(0, base - troqueladas) };
    }

    if (changedFieldId === "hojas_troquelar") {
      const merma = toFiniteNum(datos.hojas_merma) ?? 0;
      return { ...datos, hojas_troqueladas: Math.max(0, base - merma) };
    }
  }

  if (procesoId === 12) {
    const next: DatosProcesoGenerico = { ...datos };
    const engomados = toFiniteNum(next.estuches_engomados);

    if (engomados != null) {
      next.cantidad_total = engomados;
    }

    const estuches = toFiniteNum(next.estuches_engomados) ?? toFiniteNum(next.cantidad_total);
    const porBulto = toFiniteNum(next.estuches_por_bulto);
    const bultosPorPalet = toFiniteNum(next.bultos_por_palet);

    const reparto = computeEngomadoReparto(estuches, porBulto, bultosPorPalet);
    if (reparto.bultos_completos != null) next.bultos_completos = reparto.bultos_completos;
    if (reparto.pico != null) next.pico = reparto.pico;
    if (reparto.bultos_totales != null) next.bultos_totales = reparto.bultos_totales;
    if (reparto.palets != null) next.palets = reparto.palets;

    return next;
  }

  if (procesoId === PROCESO_DESBROCE_ID) {
    // Solo recalcular al cambiar hojas/poses; si editan estuches a mano, respetar.
    if (
      changedFieldId !== "hojas_entrada" &&
      changedFieldId !== "poses"
    ) {
      return datos;
    }
    const hojas = toFiniteNum(datos.hojas_entrada);
    const poses = toFiniteNum(datos.poses);
    if (hojas != null && poses != null && poses > 0) {
      return {
        ...datos,
        estuches_desbrozados: Math.max(0, Math.floor(hojas * poses)),
      };
    }
  }

  if (procesoId === PROCESO_MANIPULADOS) {
    const next: DatosProcesoGenerico = { ...datos };
    const unidades = toFiniteNum(next.unidades);
    const udsRetractilar = toFiniteNum(next.unidades_por_paquete);
    const udsEtiqueta = toFiniteNum(next.unidades_por_paquete_etiqueta);

    if (unidades != null && udsRetractilar != null && udsRetractilar > 0) {
      next.num_paquetes = Math.ceil(unidades / udsRetractilar);
    }
    if (unidades != null && udsEtiqueta != null && udsEtiqueta > 0) {
      next.num_paquetes_etiqueta = Math.ceil(unidades / udsEtiqueta);
    }

    const encajar =
      isTruthyDatoProceso(next.encajar) ||
      String(next.codigo_caja_embalaje ?? "").trim() !== "" ||
      toFiniteNum(next.estuches_por_bulto) != null;
    if (encajar) {
      const porBulto = toFiniteNum(next.estuches_por_bulto);
      const bultosPorPalet = toFiniteNum(next.bultos_por_palet);
      const reparto = computeEngomadoReparto(unidades, porBulto, bultosPorPalet);
      if (reparto.bultos_completos != null) next.bultos_completos = reparto.bultos_completos;
      if (reparto.pico != null) next.pico = reparto.pico;
      if (reparto.bultos_totales != null) next.bultos_totales = reparto.bultos_totales;
      if (reparto.palets != null) next.palets = reparto.palets;
    }
    return next;
  }

  return datos;
}

function mapTroquelRow(row: TroquelInfoRow) {
  const poses = parseNum(row.num_figuras) ?? parseNum(row.figuras_hoja);
  return {
    tamanoCorte: row.mides?.trim() || null,
    poses,
    pinza: parseMeasurementNumber(row.pinza),
    expulsor: mapExpulsor(row.expulsion ?? row.num_expulsion),
    cauchoAcrilico: row.caucho_acrilico?.trim() || null,
  };
}

function mapMotivoRow(row: MotivoPausaRow): MotivoPausa {
  const tiposMaquina = Array.isArray(row.tipos_maquina)
    ? row.tipos_maquina.map((t) => String(t).trim()).filter(Boolean)
    : null;
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    categoria: row.categoria,
    colorHex: row.color_hex,
    activo: Boolean(row.activo),
    orden: Math.trunc(parseNum(row.orden) ?? 0),
    tiposMaquina,
  };
}

function motivoAplicaATipoMaquina(
  motivo: MotivoPausa,
  tipoMaquina: string | null | undefined,
): boolean {
  const tipos = motivo.tiposMaquina ?? [];
  if (tipos.length === 0) return true;
  const tipo = String(tipoMaquina ?? "").trim();
  if (!tipo) return true;
  return tipos.includes(tipo);
}

function pickMotivoJoin(value: PausaRow["sys_motivos_pausa"]): MotivoPausaRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type SalidaAnteriorInfo = {
  procesoAnteriorId: number;
  salida: number;
  nombre: string;
};

function salidaAnteriorKey(otId: string, procesoId: number | null | undefined): string | null {
  if (!otId || !procesoId) return null;
  return `${otId}::${procesoId}`;
}

function pasosItinerarioParaConsumo(pasos: PasoItinerarioFormato[]): PasoItinerarioConsumo[] {
  return pasos.map((p) => ({ procesoId: p.procesoId, orden: p.orden }));
}

function mapRow(
  r: EjecucionRow,
  pausesByExecutionId: Map<string, MesaEjecucionPausa[]>,
  salidaAnteriorByPasoKey: Map<string, SalidaAnteriorInfo>,
  formatoAnteriorByOtPasoId: Map<string, { formato: string; origenNombre: string }>,
): MesaEjecucion {
  const pauses = pausesByExecutionId.get(r.id) ?? [];
  const openPause = pauses.find((p) => p.resumedAt == null) ?? null;
  const pasoJoin = r.prod_ot_pasos;
  const pid = pasoJoin?.proceso_id;
  const otId = String(pasoJoin?.ot_id ?? "").trim();
  const salidaKey = salidaAnteriorKey(otId, pid);
  const salidaAnterior = salidaKey ? salidaAnteriorByPasoKey.get(salidaKey) ?? null : null;
  const otPasoId = String(r.ot_paso_id ?? "").trim();
  const formatoAnteriorInfo = otPasoId ? formatoAnteriorByOtPasoId.get(otPasoId) ?? null : null;
  return {
    id: r.id,
    mesaTrabajoId: r.mesa_trabajo_id,
    otPasoId: r.ot_paso_id,
    otId: otId || null,
    procesoId: typeof pid === "number" && Number.isFinite(pid) ? pid : null,
    datosProcesoJson: pasoJoin?.datos_proceso ?? null,
    procesoAnteriorId: salidaAnterior?.procesoAnteriorId ?? null,
    salidaProcesoAnterior: salidaAnterior?.salida ?? null,
    salidaProcesoAnteriorNombre: salidaAnterior?.nombre ?? null,
    formatoAnterior: formatoAnteriorInfo?.formato ?? null,
    formatoAnteriorOrigenNombre: formatoAnteriorInfo?.origenNombre ?? null,
    ot: r.ot_numero,
    maquinaId: r.maquina_id,
    maquinaNombre: r.prod_maquinas?.nombre ?? "—",
    maquinaTipo: r.prod_maquinas?.tipo_maquina ?? null,
    fechaPlanificada: r.fecha_planificada,
    turno: r.turno === "manana" || r.turno === "tarde" ? r.turno : null,
    slotOrden: r.slot_orden,
    liberadaAt: r.liberada_at,
    inicioRealAt: r.inicio_real_at,
    finRealAt: r.fin_real_at,
    estadoEjecucion: r.estado_ejecucion,
    pausaActivaDesde: openPause?.pausedAt ?? null,
    motivoPausaActiva: openPause?.motivoLabel ?? null,
    motivoPausaCategoriaActiva: openPause?.motivoCategoria ?? null,
    motivoPausaColorHexActiva: openPause?.motivoColorHex ?? null,
    haEstadoPausada: Boolean(r.ha_estado_pausada) || pauses.length > 0,
    numPausas: Math.max(0, Math.trunc(parseNum(r.num_pausas) ?? pauses.length)),
    minutosPausadaAcum: Number(parseNum(r.minutos_pausada_acum) ?? 0),
    horasPlanificadasSnapshot: parseNum(r.horas_planificadas_snapshot),
    horasReales: parseNum(r.horas_reales),
    horasRealesEntrada: parseNum(r.horas_reales_entrada),
    horasRealesTiraje: parseNum(r.horas_reales_tiraje),
    horasRealesTroquelado: parseNum(r.horas_reales_troquelado),
    horasRealesEngomado: parseNum(r.horas_reales_engomado),
    numHojasProducidas: parseNum(r.num_hojas_producidas),
    cantidadUnidades: parseNum(r.cantidad_unidades),
    incidencia: r.incidencia,
    accionCorrectiva: r.accion_correctiva,
    maquinista: r.maquinista,
    densidadesJson: r.densidades_json,
    observaciones: r.observaciones,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type FiltroEstadoEjecucion = "activas" | "terminadas_hoy" | EstadoEjecucionMesa | "all";

function estadoLabel(e: EstadoEjecucionMesa): string {
  if (e === "pendiente_inicio") return "Por hacer";
  if (e === "en_curso") return "En curso";
  if (e === "pausada") return "Pausada";
  if (e === "finalizada") return "Finalizada";
  return "Cancelada";
}

function estadoColaClass(e: EstadoEjecucionMesa): string {
  if (e === "pendiente_inicio") return "bg-sky-100 text-sky-800";
  if (e === "en_curso") return "bg-emerald-100 text-emerald-800";
  if (e === "pausada") return "bg-amber-100 text-amber-800";
  if (e === "finalizada") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-500";
}

function estadoColaRowClass(e: EstadoEjecucionMesa): string {
  if (e === "pendiente_inicio") return "border-l-sky-400 bg-sky-50/70";
  if (e === "en_curso") return "border-l-emerald-500 bg-emerald-50/80";
  if (e === "pausada") return "border-l-amber-400 bg-amber-50/80";
  if (e === "finalizada") return "border-l-slate-300 bg-slate-50";
  return "border-l-slate-300 bg-white";
}

function colaRank(e: EstadoEjecucionMesa): number {
  if (e === "en_curso") return 0;
  if (e === "pausada") return 1;
  if (e === "pendiente_inicio") return 2;
  if (e === "finalizada") return 3;
  return 4;
}

function isSameLocalDay(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTerminadaHoy(row: MesaEjecucion, now = new Date()): boolean {
  if (row.estadoEjecucion !== "finalizada") return false;
  return isSameLocalDay(row.finRealAt, now) || (!row.finRealAt && isSameLocalDay(row.updatedAt, now));
}

function formatDuracionHoras(h: number | null): string {
  if (h == null || !Number.isFinite(h) || h < 0) return "—";
  const totalMin = Math.max(0, Math.round(h * 60));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return `${mm} min`;
  return `${hh} h ${String(mm).padStart(2, "0")} min`;
}

function tiempoColaLabel(
  row: MesaEjecucion,
  pauses: MesaEjecucionPausa[],
  now: Date,
): string {
  if (row.estadoEjecucion === "pendiente_inicio") return "—";
  const horas =
    row.estadoEjecucion === "finalizada" && row.horasReales != null
      ? row.horasReales
      : computeHorasMesaNetas({
          inicioRealAt: row.inicioRealAt,
          finRealAt: row.estadoEjecucion === "finalizada" ? row.finRealAt : null,
          minutosPausadaAcum: row.minutosPausadaAcum,
          pauses: pauses.map((p) => ({
            pausedAt: p.pausedAt,
            resumedAt: p.resumedAt,
            minutosPausa: p.minutosPausa,
          })),
          now,
        });
  const base = formatDuracionHoras(horas);
  if (row.estadoEjecucion === "pausada") {
    return base === "—" ? "Pausa" : `${base} · pausa`;
  }
  return base;
}

export function PlanificacionOtsEjecucionTab({
  tabletMode = false,
}: {
  tabletMode?: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { margenes: margenesSobreproduccion } =
    useSysParametrosSobreproduccion();
  const [rows, setRows] = useState<MesaEjecucion[]>([]);
  const [pausesByExecutionId, setPausesByExecutionId] = useState<Record<string, MesaEjecucionPausa[]>>({});
  const [despachoByOt, setDespachoByOt] = useState<Record<string, DespachoInfo>>({});
  const [otMetaByOt, setOtMetaByOt] = useState<Record<string, OtMetaInfo>>({});
  const [hijaComponentesByOt, setHijaComponentesByOt] = useState<Record<string, HijaComponenteRow[]>>({});
  const [motivosPausa, setMotivosPausa] = useState<MotivoPausa[]>([]);
  const [cajasEmbalaje, setCajasEmbalaje] = useState<CajaEmbalajeOption[]>([]);
  const [tipoEngomadoOptions, setTipoEngomadoOptions] = useState<string[]>([]);
  const [maquinas, setMaquinas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [maquinasTroquel, setMaquinasTroquel] = useState<ContenedorTroquelMaquina[]>(
    [],
  );
  const [selectedMaquina, setSelectedMaquina] = useState<string>("all");
  const [estado, setEstado] = useState<FiltroEstadoEjecucion>("activas");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [mostrarPruebas, setMostrarPruebas] = useState(() =>
    readLocalFlag(STORAGE_EJECUCION_MOSTRAR_PRUEBAS, false),
  );
  const [soloEjecutableCtp, setSoloEjecutableCtp] = useState(() =>
    readLocalFlag(STORAGE_EJECUCION_SOLO_EJECUTABLE_CTP, true),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const hasAutoExpandedRef = useRef(false);
  const catalogosRef = useRef<CatalogosEjecucion | null>(null);
  const roleRef = useRef<string | null>(null);
  const roleLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [planificacionRole, setPlanificacionRole] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<ProfileConPermisos | null>(null);
  const [hojaRutaOt, setHojaRutaOt] = useState<string | null>(null);
  const [pasosItinerarioPorOtId, setPasosItinerarioPorOtId] = useState<
    Map<string, PasoItinerarioFormato[]>
  >(new Map());

  const etiquetaAmbitoEjecucion = useMemo(
    () => etiquetaAmbitoPlanificacion(getPlanificacionTipoMaquinaFilter(planificacionRole)),
    [planificacionRole],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let roleRead: string | null = null;
      if (!roleLoadedRef.current) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        const uid =
          typeof authUser?.id === "string" && authUser.id.trim().length > 0
            ? authUser.id.trim()
            : null;
        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, role, puede_cerrar_ot, puede_reabrir_ot")
            .eq("id", uid)
            .maybeSingle();
          roleRead =
            prof && typeof (prof as { role?: unknown }).role === "string"
              ? String((prof as { role: string }).role).trim() || null
              : null;
          setAdminProfile(prof as ProfileConPermisos | null);
        } else {
          setAdminProfile(null);
        }
        roleRef.current = roleRead;
        roleLoadedRef.current = true;
        setPlanificacionRole(roleRead);
      } else {
        roleRead = roleRef.current;
      }
      const tipoFiltro = getPlanificacionTipoMaquinaFilter(roleRead);

      let catalogos = catalogosRef.current;
      if (!catalogos) {
        let maqQuery = supabase
          .from(TABLE_MAQUINAS)
          .select("id, nombre, tipo_maquina, activa")
          .eq("activa", true)
          .order("nombre");
        if (tipoFiltro) {
          maqQuery = maqQuery.eq("tipo_maquina", tipoFiltro);
        } else {
          maqQuery = maqQuery.in("tipo_maquina", PLANIFICACION_TIPOS_MAQUINA);
        }

        const [maqRes, motivosRes, cajasRes, engomadoRes] = await Promise.all([
          maqQuery,
          supabase
            .from(TABLE_MOTIVOS_PAUSA)
            .select("id, slug, label, categoria, color_hex, activo, orden, tipos_maquina")
            .eq("activo", true)
            .order("categoria", { ascending: true })
            .order("orden", { ascending: true }),
          supabase
            .from("prod_cajas_embalaje")
            .select("codigo, descripcion, bultos_por_palet_default")
            .eq("activo", true)
            .order("orden", { ascending: true })
            .order("codigo", { ascending: true }),
          supabase
            .from("prod_despacho_catalogo")
            .select("label")
            .eq("tipo", "tipo_engomado")
            .eq("activo", true)
            .order("orden", { ascending: true })
            .order("label", { ascending: true }),
        ]);
        if (maqRes.error) throw maqRes.error;
        if (motivosRes.error) throw motivosRes.error;
        const tiposPlan = new Set<string>(PLANIFICACION_TIPOS_MAQUINA);
        const maqRowsRaw = (maqRes.data ?? []) as Array<{
          id: string;
          nombre: string;
          tipo_maquina: string | null;
        }>;
        catalogos = {
          motivos: ((motivosRes.data ?? []) as MotivoPausaRow[]).map(mapMotivoRow),
          cajas: (cajasRes.error ? [] : (cajasRes.data ?? [])) as CajaEmbalajeOption[],
          tiposEngomado: (engomadoRes.error ? [] : (engomadoRes.data ?? []))
            .map((r) => String((r as { label?: string | null }).label ?? "").trim())
            .filter(Boolean),
          maqRows: maqRowsRaw.filter((m) =>
            tiposPlan.has(String(m.tipo_maquina ?? "").trim()),
          ),
        };
        catalogosRef.current = catalogos;
        setMotivosPausa(catalogos.motivos);
        setCajasEmbalaje(catalogos.cajas);
        setTipoEngomadoOptions(catalogos.tiposEngomado);
        setMaquinas(catalogos.maqRows.map((m) => ({ id: m.id, nombre: m.nombre })));
      }

      const motivos = catalogos.motivos;
      const allowedMaquinaIds = new Set(catalogos.maqRows.map((m) => m.id));

      const fetchEjecuciones = async (): Promise<EjecucionRow[]> => {
        const asRows = (data: unknown): EjecucionRow[] =>
          ((data ?? []) as unknown as EjecucionRow[]).filter((r) =>
            allowedMaquinaIds.has(String(r.maquina_id ?? "").trim()),
          );
        if (estado === "all") {
          const [activasRes, histRes] = await Promise.all([
            supabase
              .from(TABLE_EJECUCIONES)
              .select(EJECUCION_COLUMNS)
              .in("estado_ejecucion", ESTADOS_ACTIVAS)
              .order("updated_at", { ascending: false }),
            supabase
              .from(TABLE_EJECUCIONES)
              .select(EJECUCION_COLUMNS)
              .in("estado_ejecucion", ["finalizada", "cancelada"])
              .order("updated_at", { ascending: false })
              .limit(HISTORICO_EJECUCION_LIMIT),
          ]);
          if (activasRes.error) throw activasRes.error;
          if (histRes.error) throw histRes.error;
          const byId = new Map<string, EjecucionRow>();
          for (const row of [...asRows(activasRes.data), ...asRows(histRes.data)]) {
            byId.set(row.id, row);
          }
          return [...byId.values()];
        }

        let query = supabase.from(TABLE_EJECUCIONES).select(EJECUCION_COLUMNS);
        if (estado === "activas") {
          query = query.in("estado_ejecucion", ESTADOS_ACTIVAS);
        } else if (estado === "terminadas_hoy") {
          query = query
            .eq("estado_ejecucion", "finalizada")
            .gte("fin_real_at", startOfLocalDayIso());
        } else if (estado === "finalizada" || estado === "cancelada") {
          query = query.eq("estado_ejecucion", estado).limit(HISTORICO_EJECUCION_LIMIT);
        } else {
          query = query.eq("estado_ejecucion", estado);
        }
        const execRes = await query.order("updated_at", { ascending: false });
        if (execRes.error) throw execRes.error;
        return asRows(execRes.data);
      };

      const execRows = await fetchEjecuciones();
      const executionIds = execRows.map((r) => r.id);
      const pauseMap = new Map<string, MesaEjecucionPausa[]>();
      if (executionIds.length > 0) {
        const pauseData = await fetchAllInChunks(executionIds, 80, async (chunk) => {
          const { data, error } = await supabase
            .from(TABLE_EJECUCIONES_PAUSAS)
            .select("id, ejecucion_id, paused_at, resumed_at, motivo_id, observaciones_pausa, minutos_pausa, created_at, sys_motivos_pausa(slug,label,categoria,color_hex)")
            .in("ejecucion_id", chunk)
            .order("paused_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as unknown as PausaRow[];
        });
        for (const p of pauseData) {
          const executionId = String(p.ejecucion_id ?? "").trim();
          if (!executionId) continue;
          const motivo = pickMotivoJoin(p.sys_motivos_pausa);
          const fallbackMotivo = motivos.find((m) => m.id === p.motivo_id);
          const entry: MesaEjecucionPausa = {
            id: String(p.id),
            ejecucionId: executionId,
            pausedAt: String(p.paused_at),
            resumedAt: p.resumed_at ?? null,
            motivoId: p.motivo_id,
            motivoLabel: motivo?.label ?? fallbackMotivo?.label ?? "Sin motivo",
            motivoCategoria: motivo?.categoria ?? fallbackMotivo?.categoria ?? "operativos",
            motivoColorHex: motivo?.color_hex ?? fallbackMotivo?.colorHex ?? "#64748B",
            observacionesPausa: p.observaciones_pausa ?? null,
            minutosPausa: parseNum(p.minutos_pausa),
            createdAt: String(p.created_at ?? ""),
          };
          const list = pauseMap.get(executionId) ?? [];
          list.push(entry);
          pauseMap.set(executionId, list);
        }
      }
      const otNumeros = [...new Set(execRows.map((r) => r.ot_numero.trim()).filter(Boolean))];
      const despachoMap: Record<string, DespachoInfo> = {};
      const otMetaMap: Record<string, OtMetaInfo> = {};
      const hijaComponentesMap: Record<string, HijaComponenteRow[]> = {};

      if (otNumeros.length > 0) {
        const [despData, generalData, materialesData] = await Promise.all([
          fetchAllInChunks(otNumeros, 100, async (chunk) => {
            const { data, error } = await supabase
              .from(TABLE_DESPACHO)
              .select(`
            ot_numero,
            material,
            gramaje,
            tamano_hoja,
            num_hojas_brutas,
            num_hojas_netas,
            tintas,
            acabado_pral,
            troquel,
            poses,
            horas_entrada,
            horas_tiraje,
            horas_estimadas_troquelado,
            horas_engomado_preparacion,
            horas_engomado_tiraje,
            horas_estimadas_engomado,
            tipo_engomado
          `)
              .in("ot_numero", chunk);
            if (error) throw error;
            return data ?? [];
          }),
          fetchAllInChunks(otNumeros, 100, async (chunk) => {
            const { data, error } = await supabase
              .from(TABLE_OTS_GENERAL)
              .select("num_pedido, cliente, cantidad, titulo, fecha_entrega, ot_tipo, ot_padre_numero, tipo_hija, forma_descripcion")
              .in("num_pedido", chunk);
            if (error) throw error;
            return data ?? [];
          }),
          fetchAllInChunks(otNumeros, 100, async (chunk) => {
            const { data, error } = await supabase
              .from(TABLE_DESPACHO_MATERIALES_LINEAS)
              .select("ot_numero, tipo, descripcion, orden, soporte_impresion")
              .in("ot_numero", chunk)
              .order("ot_numero", { ascending: true })
              .order("orden", { ascending: true });
            if (error) throw error;
            return data ?? [];
          }),
        ]);
        const generalMap = new Map<string, { cliente: string | null; cantidad: number | null; titulo: string | null; fechaEntrega: string | null }>();
        for (const g of generalData as Array<{ 
          num_pedido?: string; 
          cliente?: string | null; 
          cantidad?: number | null; 
          titulo?: string | null; 
          fecha_entrega?: string | null;
          ot_tipo?: string | null;
          ot_padre_numero?: string | null;
          tipo_hija?: string | null;
          forma_descripcion?: string | null;
        }>) {
          const ot = String(g.num_pedido ?? "").trim();
          if (ot) {
            generalMap.set(ot, {
              cliente: g.cliente ?? null,
              cantidad: typeof g.cantidad === "number" ? g.cantidad : null,
              titulo: g.titulo ?? null,
              fechaEntrega: g.fecha_entrega ?? null,
            });
            otMetaMap[ot] = {
              otTipo: g.ot_tipo ?? null,
              otPadreNumero: g.ot_padre_numero ?? null,
              tipoHija: g.tipo_hija ?? null,
              formaDescripcion: g.forma_descripcion ?? null,
            };
          }
        }
        const materialesByOt = new Map<string, MaterialLineaInfo[]>();
        for (const m of materialesData as Array<{
          ot_numero?: string | null;
          tipo?: string | null;
          descripcion?: string | null;
          orden?: number | string | null;
          soporte_impresion?: boolean | null;
        }>) {
          const ot = String(m.ot_numero ?? "").trim();
          const descripcion = String(m.descripcion ?? "").trim();
          if (!ot || !descripcion) continue;
          const list = materialesByOt.get(ot) ?? [];
          list.push({
            descripcion,
            tipo: m.tipo ?? null,
            orden: parseNum(m.orden),
            soporteImpresion: Boolean(m.soporte_impresion),
          });
          materialesByOt.set(ot, list);
        }
        const troquelNums = [
          ...new Set(
            (despData as Array<{ troquel?: string | null }>)
              .map((d) => String(d.troquel ?? "").trim())
              .filter(Boolean),
          ),
        ];
        const troquelMap = new Map<string, ReturnType<typeof mapTroquelRow>>();
        if (troquelNums.length > 0) {
          const troqData = await fetchAllInChunks(troquelNums, 100, async (chunk) => {
            const { data, error } = await supabase
              .from(TABLE_TROQUELES)
              .select("num_troquel,mides,num_figuras,figuras_hoja,pinza,expulsion,num_expulsion,caucho_acrilico")
              .in("num_troquel", chunk);
            if (error) throw error;
            return (data ?? []) as TroquelInfoRow[];
          });
          for (const t of troqData) {
            const key = normalizeTroquelKey(t.num_troquel);
            if (key) troquelMap.set(key, mapTroquelRow(t));
          }
        }
        for (const d of despData as Array<{
          ot_numero?: string;
          material?: string | null;
          gramaje?: number | null;
          tamano_hoja?: string | null;
          num_hojas_brutas?: number | null;
          num_hojas_netas?: number | null;
          tintas?: string | null;
          acabado_pral?: string | null;
          troquel?: string | null;
          poses?: number | null;
          horas_entrada?: number | null;
          horas_tiraje?: number | null;
          horas_estimadas_troquelado?: number | null;
          horas_engomado_preparacion?: number | null;
          horas_engomado_tiraje?: number | null;
          horas_estimadas_engomado?: number | null;
          tipo_engomado?: string | null;
        }>) {
          const ot = String(d.ot_numero ?? "").trim();
          if (!ot) continue;
          const gen = generalMap.get(ot);
          const troq = troquelMap.get(normalizeTroquelKey(d.troquel));
          const materiales = materialesByOt.get(ot) ?? [];
          despachoMap[ot] = {
            cliente: gen?.cliente ?? null,
            cantidad: gen?.cantidad ?? null,
            titulo: gen?.titulo ?? null,
            material: d.material ?? null,
            gramaje: typeof d.gramaje === "number" ? d.gramaje : null,
            tamanoHoja: d.tamano_hoja ?? null,
            hojasBrutas: typeof d.num_hojas_brutas === "number" ? d.num_hojas_brutas : null,
            hojasNetas: typeof d.num_hojas_netas === "number" ? d.num_hojas_netas : null,
            tintas: d.tintas ?? null,
            acabadoPral: d.acabado_pral ?? null,
            troquel: d.troquel ?? null,
            poses: parseNum(d.poses) ?? troq?.poses ?? null,
            tamanoCorte: troq?.tamanoCorte ?? null,
            pinza: troq?.pinza ?? null,
            expulsor: troq?.expulsor ?? null,
            cauchoAcrilico: troq?.cauchoAcrilico ?? null,
            horasEntrada: typeof d.horas_entrada === "number" ? d.horas_entrada : null,
            horasTiraje: typeof d.horas_tiraje === "number" ? d.horas_tiraje : null,
            horasTroquelado: typeof d.horas_estimadas_troquelado === "number" ? d.horas_estimadas_troquelado : null,
            horasEngomadoPrep:
              typeof d.horas_engomado_preparacion === "number"
                ? d.horas_engomado_preparacion
                : null,
            horasEngomadoTiraje:
              typeof d.horas_engomado_tiraje === "number"
                ? d.horas_engomado_tiraje
                : null,
            horasEngomado: typeof d.horas_estimadas_engomado === "number" ? d.horas_estimadas_engomado : null,
            tipoEngomado: d.tipo_engomado ?? null,
            fechaEntrega: gen?.fechaEntrega ?? null,
            materiales,
          };
        }

        // Fallback despacho para hijas (Bloque 8.2)
        const hijasSinDespacho = otNumeros.filter((ot) => {
          const meta = otMetaMap[ot];
          return (
            meta?.otTipo === "hija" &&
            meta.otPadreNumero &&
            !despachoMap[ot]
          );
        });
        const padresNeeded = [
          ...new Set(
            hijasSinDespacho
              .map((h) => otMetaMap[h]?.otPadreNumero)
              .filter((p): p is string => Boolean(p))
          ),
        ];
        if (padresNeeded.length > 0) {
          const [padreDespData, padreGeneralData, padreMaterialesData] = await Promise.all([
            fetchAllInChunks(padresNeeded, 100, async (chunk) => {
              const { data, error } = await supabase
                .from(TABLE_DESPACHO)
                .select(`
              ot_numero,
              material,
              gramaje,
              tamano_hoja,
              num_hojas_brutas,
              num_hojas_netas,
              tintas,
              acabado_pral,
              troquel,
              poses,
              horas_entrada,
              horas_tiraje,
              horas_estimadas_troquelado,
              horas_engomado_preparacion,
              horas_engomado_tiraje,
              horas_estimadas_engomado,
              tipo_engomado
            `)
                .in("ot_numero", chunk);
              if (error) throw error;
              return data ?? [];
            }),
            fetchAllInChunks(padresNeeded, 100, async (chunk) => {
              const { data, error } = await supabase
                .from(TABLE_OTS_GENERAL)
                .select("num_pedido, cliente, titulo, fecha_entrega")
                .in("num_pedido", chunk);
              if (error) throw error;
              return data ?? [];
            }),
            fetchAllInChunks(padresNeeded, 100, async (chunk) => {
              const { data, error } = await supabase
                .from(TABLE_DESPACHO_MATERIALES_LINEAS)
                .select("ot_numero, tipo, descripcion, orden, soporte_impresion")
                .in("ot_numero", chunk)
                .order("ot_numero", { ascending: true })
                .order("orden", { ascending: true });
              if (error) throw error;
              return data ?? [];
            }),
          ]);

          const padreGeneralMap = new Map<string, { cliente: string | null; titulo: string | null; fechaEntrega: string | null }>();
          for (const pg of padreGeneralData as Array<{
            num_pedido?: string;
            cliente?: string | null;
            titulo?: string | null;
            fecha_entrega?: string | null;
          }>) {
            const ot = String(pg.num_pedido ?? "").trim();
            if (ot) {
              padreGeneralMap.set(ot, {
                cliente: pg.cliente ?? null,
                titulo: pg.titulo ?? null,
                fechaEntrega: pg.fecha_entrega ?? null,
              });
            }
          }

          const padreMaterialesByOt = new Map<string, MaterialLineaInfo[]>();
          for (const pm of padreMaterialesData as Array<{
            ot_numero?: string | null;
            tipo?: string | null;
            descripcion?: string | null;
            orden?: number | string | null;
            soporte_impresion?: boolean | null;
          }>) {
            const ot = String(pm.ot_numero ?? "").trim();
            const descripcion = String(pm.descripcion ?? "").trim();
            if (!ot || !descripcion) continue;
            const list = padreMaterialesByOt.get(ot) ?? [];
            list.push({
              descripcion,
              tipo: pm.tipo ?? null,
              orden: parseNum(pm.orden),
              soporteImpresion: Boolean(pm.soporte_impresion),
            });
            padreMaterialesByOt.set(ot, list);
          }

          const padreTroquelNums = [
            ...new Set(
              (padreDespData as Array<{ troquel?: string | null }>)
                .map((d) => String(d.troquel ?? "").trim())
                .filter(Boolean),
            ),
          ];
          const padreTroquelMap = new Map<string, ReturnType<typeof mapTroquelRow>>();
          if (padreTroquelNums.length > 0) {
            const troqData = await fetchAllInChunks(padreTroquelNums, 100, async (chunk) => {
              const { data, error } = await supabase
                .from(TABLE_TROQUELES)
                .select("num_troquel,mides,num_figuras,figuras_hoja,pinza,expulsion,num_expulsion,caucho_acrilico")
                .in("num_troquel", chunk);
              if (error) throw error;
              return (data ?? []) as TroquelInfoRow[];
            });
            for (const t of troqData) {
              const key = normalizeTroquelKey(t.num_troquel);
              if (key) padreTroquelMap.set(key, mapTroquelRow(t));
            }
          }

          const padreDespachoMap: Record<string, DespachoInfo> = {};
          for (const pd of padreDespData as Array<{
            ot_numero?: string;
            material?: string | null;
            gramaje?: number | null;
            tamano_hoja?: string | null;
            num_hojas_brutas?: number | null;
            num_hojas_netas?: number | null;
            tintas?: string | null;
            acabado_pral?: string | null;
            troquel?: string | null;
            poses?: number | null;
            horas_entrada?: number | null;
            horas_tiraje?: number | null;
            horas_estimadas_troquelado?: number | null;
            horas_engomado_preparacion?: number | null;
            horas_engomado_tiraje?: number | null;
            horas_estimadas_engomado?: number | null;
            tipo_engomado?: string | null;
          }>) {
            const ot = String(pd.ot_numero ?? "").trim();
            if (!ot) continue;
            const gen = padreGeneralMap.get(ot);
            const troq = padreTroquelMap.get(normalizeTroquelKey(pd.troquel));
            const materiales = padreMaterialesByOt.get(ot) ?? [];
            padreDespachoMap[ot] = {
              cliente: gen?.cliente ?? null,
              cantidad: null,
              titulo: gen?.titulo ?? null,
              material: pd.material ?? null,
              gramaje: typeof pd.gramaje === "number" ? pd.gramaje : null,
              tamanoHoja: pd.tamano_hoja ?? null,
              hojasBrutas: typeof pd.num_hojas_brutas === "number" ? pd.num_hojas_brutas : null,
              hojasNetas: typeof pd.num_hojas_netas === "number" ? pd.num_hojas_netas : null,
              tintas: pd.tintas ?? null,
              acabadoPral: pd.acabado_pral ?? null,
              troquel: pd.troquel ?? null,
              poses: parseNum(pd.poses) ?? troq?.poses ?? null,
              tamanoCorte: troq?.tamanoCorte ?? null,
              pinza: troq?.pinza ?? null,
              expulsor: troq?.expulsor ?? null,
              cauchoAcrilico: troq?.cauchoAcrilico ?? null,
              horasEntrada: typeof pd.horas_entrada === "number" ? pd.horas_entrada : null,
              horasTiraje: typeof pd.horas_tiraje === "number" ? pd.horas_tiraje : null,
              horasTroquelado: typeof pd.horas_estimadas_troquelado === "number" ? pd.horas_estimadas_troquelado : null,
              horasEngomadoPrep:
                typeof pd.horas_engomado_preparacion === "number"
                  ? pd.horas_engomado_preparacion
                  : null,
              horasEngomadoTiraje:
                typeof pd.horas_engomado_tiraje === "number"
                  ? pd.horas_engomado_tiraje
                  : null,
              horasEngomado: typeof pd.horas_estimadas_engomado === "number" ? pd.horas_estimadas_engomado : null,
              tipoEngomado: pd.tipo_engomado ?? null,
              fechaEntrega: gen?.fechaEntrega ?? null,
              materiales,
            };
          }

          for (const hijaOt of hijasSinDespacho) {
            const meta = otMetaMap[hijaOt];
            const padreOt = meta?.otPadreNumero;
            if (!padreOt) continue;
            const padreDesp = padreDespachoMap[padreOt];
            if (!padreDesp) continue;
            const hijaGen = generalMap.get(hijaOt);
            despachoMap[hijaOt] = {
              ...padreDesp,
              cantidad: hijaGen?.cantidad ?? null,
              titulo: meta.formaDescripcion ?? hijaGen?.titulo ?? padreDesp.titulo,
            };
          }
        }

        // Cargar componentes de hijas para desbroce (Bloque 8.3)
        const hijasForma = otNumeros.filter((ot) => {
          const meta = otMetaMap[ot];
          return meta?.otTipo === "hija" && meta?.tipoHija === "forma";
        });
        if (hijasForma.length > 0) {
          const compData = await fetchAllInChunks(hijasForma, 100, async (chunk) => {
            const { data, error } = await supabase
              .from(TABLE_HIJA_COMPONENTES)
              .select("ot_hija_numero, referencia_codigo, referencia_descripcion, poses_en_forma, cantidad_objetivo, orden")
              .in("ot_hija_numero", chunk)
              .order("ot_hija_numero", { ascending: true })
              .order("orden", { ascending: true });
            if (error) throw error;
            return data ?? [];
          });
          for (const c of compData as Array<{
            ot_hija_numero?: string | null;
            referencia_codigo?: string | null;
            referencia_descripcion?: string | null;
            poses_en_forma?: number | null;
            cantidad_objetivo?: number | null;
            orden?: number | null;
          }>) {
            const ot = String(c.ot_hija_numero ?? "").trim();
            if (!ot) continue;
            const list = hijaComponentesMap[ot] ?? [];
            list.push({
              referencia_codigo: String(c.referencia_codigo ?? "").trim(),
              referencia_descripcion: c.referencia_descripcion ?? null,
              poses_en_forma: typeof c.poses_en_forma === "number" ? c.poses_en_forma : 0,
              cantidad_objetivo: typeof c.cantidad_objetivo === "number" ? c.cantidad_objetivo : null,
              orden: typeof c.orden === "number" ? c.orden : 0,
            });
            hijaComponentesMap[ot] = list;
          }
          for (const ot of hijasForma) {
            const comps = hijaComponentesMap[ot];
            if (!comps?.length || !despachoMap[ot]) continue;
            const netasForma = hojasNetasFormaFromComponentes(comps);
            if (netasForma != null && netasForma > 0) {
              despachoMap[ot] = { ...despachoMap[ot], hojasNetas: netasForma };
            }
          }
        }
      }

      // Cargar salidas del paso anterior para el encadenado (Bloque 2.5)
      const salidaAnteriorByPasoKey = new Map<string, SalidaAnteriorInfo>();
      const formatoAnteriorByOtPasoId = new Map<string, { formato: string; origenNombre: string }>();
      const pasosItinerarioPorOtId = new Map<string, PasoItinerarioFormato[]>();
      const otIds = [
        ...new Set(
          execRows
            .map((r) => String(r.prod_ot_pasos?.ot_id ?? "").trim())
            .filter(Boolean),
        ),
      ];
      if (otIds.length > 0) {
        const pasosItinerarioData = await fetchAllInChunks(otIds, 80, async (chunk) => {
          const { data, error } = await supabase
            .from(TABLE_OT_PASOS)
            .select("id, ot_id, proceso_id, estado, datos_proceso, orden")
            .in("ot_id", chunk)
            .order("ot_id")
            .order("orden", { ascending: true });
          if (error) throw error;
          return data ?? [];
        });
        const pasosData = (
          pasosItinerarioData as Array<{
            ot_id: string;
            proceso_id: number | null;
            estado: string;
            datos_proceso: Record<string, unknown> | null;
            orden: number | null;
          }>
        ).filter((p) => p.estado === "finalizado");

        for (const p of pasosItinerarioData as Array<{
          id: string;
          ot_id: string;
          proceso_id: number | null;
          datos_proceso: Record<string, unknown> | null;
          orden: number | null;
        }>) {
          const otId = String(p.ot_id ?? "").trim();
          if (!otId) continue;
          const list = pasosItinerarioPorOtId.get(otId) ?? [];
          list.push({
            id: String(p.id),
            otId,
            procesoId: p.proceso_id,
            orden: typeof p.orden === "number" ? p.orden : 0,
            datosProceso: p.datos_proceso,
          });
          pasosItinerarioPorOtId.set(otId, list);
        }

        const formatoPasoRequests = execRows
          .map((execRow) => {
            const otPasoId = String(execRow.ot_paso_id ?? "").trim();
            const otId = String(execRow.prod_ot_pasos?.ot_id ?? "").trim();
            if (!otPasoId || !otId) return null;
            const despacho = despachoMap[execRow.ot_numero.trim()];
            return {
              otPasoId,
              otId,
              formatoCompra: despacho?.tamanoHoja ?? null,
            };
          })
          .filter((item): item is { otPasoId: string; otId: string; formatoCompra: string | null } => item != null);

        for (const [otPasoId, info] of buildFormatoAnteriorByOtPasoId(
          pasosItinerarioPorOtId,
          formatoPasoRequests,
        )) {
          formatoAnteriorByOtPasoId.set(otPasoId, {
            formato: info.formato,
            origenNombre: info.origenNombre,
          });
        }

        // Para cada ejecución activa, el paso de entrada es el finalizado
        // inmediatamente anterior en el itinerario (mayor orden < actual)
        // entre los procesos compatibles (inputFromProcessIds).
        const pasosPorOtId = new Map<string, Array<{ proceso_id: number | null; datos_proceso: Record<string, unknown> | null; orden: number | null }>>();
        for (const p of pasosData as Array<{ ot_id: string; proceso_id: number | null; estado: string; datos_proceso: Record<string, unknown> | null; orden: number | null }>) {
          const otId = String(p.ot_id ?? "").trim();
          if (!otId) continue;
          const list = pasosPorOtId.get(otId) ?? [];
          list.push({ proceso_id: p.proceso_id, datos_proceso: p.datos_proceso, orden: p.orden });
          pasosPorOtId.set(otId, list);
        }

        for (const execRow of execRows) {
          const otId = String(execRow.prod_ot_pasos?.ot_id ?? "").trim();
          if (!otId) continue;
          const pid = execRow.prod_ot_pasos?.proceso_id;
          if (!pid) continue;
          const key = salidaAnteriorKey(otId, pid);
          if (!key) continue;
          const procesoConfig = getCamposConfigByProcesoId(pid);
          const inputIds = procesoConfig?.inputFromProcessIds;
          if (!inputIds || inputIds.length === 0) continue;

          const pasosOt = pasosPorOtId.get(otId) ?? [];
          const currentOrden = execRow.prod_ot_pasos?.orden ?? null;
          const resolved = resolveSalidaAnteriorPorItinerario(
            pasosOt,
            inputIds,
            currentOrden,
          );
          if (resolved) salidaAnteriorByPasoKey.set(key, resolved);
        }
      }

      setPausesByExecutionId(
        Object.fromEntries(Array.from(pauseMap.entries()).map(([k, v]) => [k, v] as const)),
      );
      setHijaComponentesByOt(hijaComponentesMap);
      setPasosItinerarioPorOtId(pasosItinerarioPorOtId);

      const baseRows = execRows.map((r) =>
        mapRow(r, pauseMap, salidaAnteriorByPasoKey, formatoAnteriorByOtPasoId),
      );

      // Bloque 11 spike: contenedor CTP + Troquel (pasos disponible sin mesa).
      let contenedorRows: MesaEjecucion[] = [];
      const showContenedorCtp =
        (!tipoFiltro || tipoFiltro === "preimpresion") &&
        (estado === "activas" ||
          estado === "pendiente_inicio" ||
          estado === "all");
      const showContenedorTroquel =
        (!tipoFiltro || tipoFiltro === "troquelado") &&
        (estado === "activas" ||
          estado === "pendiente_inicio" ||
          estado === "all");

      let occupiedPasos = new Set<string>();
      if (showContenedorCtp || showContenedorTroquel) {
        const { data: activasPaso } = await supabase
          .from(TABLE_EJECUCIONES)
          .select("ot_paso_id")
          .in("estado_ejecucion", ESTADOS_ACTIVAS)
          .not("ot_paso_id", "is", null);
        occupiedPasos = new Set(
          (activasPaso ?? [])
            .map((r) =>
              String((r as { ot_paso_id?: string }).ot_paso_id ?? "").trim(),
            )
            .filter(Boolean),
        );
      }

      if (showContenedorCtp) {
        try {
          const ctpMaq = await fetchMaquinaCtpActiva(supabase);
          if (ctpMaq) {
            const candidatos = await fetchContenedorCtpPasosDisponibles(supabase, {
              includePruebas: true,
              soloEjecutable: false,
              otPasoIdsConEjecucionActiva: occupiedPasos,
            });
            contenedorRows = candidatos.map((p) =>
              buildContenedorCtpVirtualRow(p, ctpMaq),
            );
          }
        } catch (ctpErr) {
          console.warn("[ejecucion] contenedor CTP", ctpErr);
        }
      }

      if (showContenedorTroquel) {
        try {
          const troquelMaqs = await fetchMaquinasTroquelActivas(supabase);
          setMaquinasTroquel(troquelMaqs);
          if (troquelMaqs.length > 0) {
            const candidatosTroq = await fetchContenedorTroquelPasosDisponibles(
              supabase,
              {
                includePruebas: true,
                soloEjecutable: false,
                otPasoIdsConEjecucionActiva: occupiedPasos,
              },
            );
            contenedorRows = [
              ...contenedorRows,
              ...candidatosTroq.map((p) => buildContenedorTroquelVirtualRow(p)),
            ];
          }
        } catch (troqErr) {
          console.warn("[ejecucion] contenedor Troquel", troqErr);
        }
      } else {
        setMaquinasTroquel([]);
      }

      const otsContenedor = [
        ...new Set(contenedorRows.map((c) => c.ot).filter(Boolean)),
      ].filter((ot) => !despachoMap[ot]);
      if (otsContenedor.length > 0) {
        try {
          const [extraDesp, extraGen] = await Promise.all([
            fetchAllInChunks(otsContenedor, 100, async (chunk) => {
              const { data, error } = await supabase
                .from(TABLE_DESPACHO)
                .select(
                  `
              ot_numero,
              material,
              gramaje,
              tamano_hoja,
              num_hojas_brutas,
              num_hojas_netas,
              tintas,
              acabado_pral,
              troquel,
              poses,
              horas_entrada,
              horas_tiraje,
              horas_estimadas_troquelado,
              horas_engomado_preparacion,
              horas_engomado_tiraje,
              horas_estimadas_engomado,
              tipo_engomado
            `,
                )
                .in("ot_numero", chunk);
              if (error) throw error;
              return data ?? [];
            }),
            fetchAllInChunks(otsContenedor, 100, async (chunk) => {
              const { data, error } = await supabase
                .from(TABLE_OTS_GENERAL)
                .select(
                  "num_pedido, cliente, titulo, cantidad, fecha_entrega, ot_tipo, ot_padre_numero, tipo_hija, forma_descripcion",
                )
                .in("num_pedido", chunk);
              if (error) throw error;
              return data ?? [];
            }),
          ]);
          for (const g of extraGen as Array<{
            num_pedido?: string;
            cliente?: string | null;
            titulo?: string | null;
            cantidad?: number | null;
            fecha_entrega?: string | null;
            ot_tipo?: string | null;
            ot_padre_numero?: string | null;
            tipo_hija?: string | null;
            forma_descripcion?: string | null;
          }>) {
            const ot = String(g.num_pedido ?? "").trim();
            if (!ot) continue;
            otMetaMap[ot] = {
              otTipo: g.ot_tipo ?? null,
              otPadreNumero: g.ot_padre_numero ?? null,
              tipoHija: g.tipo_hija ?? null,
              formaDescripcion: g.forma_descripcion ?? null,
            };
          }
          for (const d of extraDesp as Array<{
            ot_numero?: string;
            material?: string | null;
            gramaje?: number | null;
            tamano_hoja?: string | null;
            num_hojas_brutas?: number | null;
            num_hojas_netas?: number | null;
            tintas?: string | null;
            acabado_pral?: string | null;
            troquel?: string | null;
            poses?: number | null;
            horas_entrada?: number | null;
            horas_tiraje?: number | null;
            horas_estimadas_troquelado?: number | null;
            horas_engomado_preparacion?: number | null;
            horas_engomado_tiraje?: number | null;
            horas_estimadas_engomado?: number | null;
            tipo_engomado?: string | null;
          }>) {
            const ot = String(d.ot_numero ?? "").trim();
            if (!ot || despachoMap[ot]) continue;
            const gen = otMetaMap[ot];
            const gRow = (
              extraGen as Array<{
                num_pedido?: string;
                cliente?: string | null;
                titulo?: string | null;
                cantidad?: number | null;
                fecha_entrega?: string | null;
              }>
            ).find((x) => String(x.num_pedido ?? "").trim() === ot);
            despachoMap[ot] = {
              cliente: gRow?.cliente ?? null,
              cantidad: typeof gRow?.cantidad === "number" ? gRow.cantidad : null,
              titulo: gRow?.titulo ?? gen?.formaDescripcion ?? null,
              material: d.material ?? null,
              gramaje: typeof d.gramaje === "number" ? d.gramaje : null,
              tamanoHoja: d.tamano_hoja ?? null,
              hojasBrutas:
                typeof d.num_hojas_brutas === "number" ? d.num_hojas_brutas : null,
              hojasNetas:
                typeof d.num_hojas_netas === "number" ? d.num_hojas_netas : null,
              tintas: d.tintas ?? null,
              acabadoPral: d.acabado_pral ?? null,
              troquel: d.troquel ?? null,
              poses: typeof d.poses === "number" ? d.poses : null,
              tamanoCorte: null,
              pinza: null,
              expulsor: null,
              cauchoAcrilico: null,
              horasEntrada:
                typeof d.horas_entrada === "number" ? d.horas_entrada : null,
              horasTiraje:
                typeof d.horas_tiraje === "number" ? d.horas_tiraje : null,
              horasTroquelado:
                typeof d.horas_estimadas_troquelado === "number"
                  ? d.horas_estimadas_troquelado
                  : null,
              horasEngomadoPrep:
                typeof d.horas_engomado_preparacion === "number"
                  ? d.horas_engomado_preparacion
                  : null,
              horasEngomadoTiraje:
                typeof d.horas_engomado_tiraje === "number"
                  ? d.horas_engomado_tiraje
                  : null,
              horasEngomado:
                typeof d.horas_estimadas_engomado === "number"
                  ? d.horas_estimadas_engomado
                  : null,
              tipoEngomado: d.tipo_engomado ?? null,
              fechaEntrega: gRow?.fecha_entrega ?? null,
              materiales: [],
            };
          }
        } catch (metaErr) {
          console.warn("[ejecucion] meta contenedor", metaErr);
        }
      }

      setDespachoByOt(despachoMap);
      setOtMetaByOt(otMetaMap);
      setRows([...baseRows, ...contenedorRows]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar las OTs en ejecución.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase, estado]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const maquinasTroquelIds = useMemo(
    () => new Set(maquinasTroquel.map((m) => m.id)),
    [maquinasTroquel],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return rows.filter((r) => {
      if (!mostrarPruebas && isOtNumeroPrueba(r.ot)) return false;
      // Contenedor CTP: ejecutable siempre true hoy; toggle listo para otras secciones.
      if (
        soloEjecutableCtp &&
        r.origenContenedorCtp &&
        r.procesoId === PROCESO_CTP_ID
      ) {
        // CTP disponible = ejecutable; nada que filtrar aún.
      }
      if (selectedMaquina !== "all") {
        const isTroquelVirtual =
          r.origenContenedorTroquel || isContenedorTroquelVirtualId(r.id);
        if (isTroquelVirtual) {
          if (!maquinasTroquelIds.has(selectedMaquina)) return false;
        } else if (r.maquinaId !== selectedMaquina) {
          return false;
        }
      }
      if (estado === "activas") {
        if (
          r.estadoEjecucion !== "pendiente_inicio" &&
          r.estadoEjecucion !== "en_curso" &&
          r.estadoEjecucion !== "pausada"
        ) {
          return false;
        }
      } else if (estado === "terminadas_hoy") {
        if (!isTerminadaHoy(r, now)) return false;
      } else if (estado !== "all" && r.estadoEjecucion !== estado) {
        return false;
      }
      if (!q) return true;
      const desp = despachoByOt[r.ot];
      const meta = otMetaByOt[r.ot];
      const procesoNombre =
        r.procesoId != null
          ? (getCamposConfigByProcesoId(r.procesoId)?.procesoNombre ?? "")
          : "";
      const haystack = [
        r.ot,
        r.maquinaNombre,
        procesoNombre,
        desp?.cliente,
        desp?.titulo,
        desp?.material,
        desp?.troquel,
        meta?.formaDescripcion,
        meta?.otPadreNumero,
        meta?.tipoHija,
        r.origenContenedorCtp ? "contenedor ctp" : "",
        r.origenContenedorTroquel ? "contenedor troquel" : "",
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [
    rows,
    selectedMaquina,
    estado,
    search,
    despachoByOt,
    otMetaByOt,
    mostrarPruebas,
    soloEjecutableCtp,
    maquinasTroquelIds,
  ]);

  const colaRows = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const dr = colaRank(a.estadoEjecucion) - colaRank(b.estadoEjecucion);
      if (dr !== 0) return dr;
      if (a.estadoEjecucion === "finalizada") {
        const ta = new Date(a.finRealAt ?? a.updatedAt).getTime();
        const tb = new Date(b.finRealAt ?? b.updatedAt).getTime();
        const dt = (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
        if (dt !== 0) return dt;
      }
      const maq = (a.maquinaNombre ?? "").localeCompare(b.maquinaNombre ?? "", "es");
      if (maq !== 0) return maq;
      return a.ot.localeCompare(b.ot, "es", { numeric: true });
    });
    return next;
  }, [filtered]);

  useEffect(() => {
    const hasLive = rows.some(
      (r) => r.estadoEjecucion === "en_curso" || r.estadoEjecucion === "pausada",
    );
    if (!hasLive) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [rows]);

  useEffect(() => {
    if (loading) return;
    if (expandedId != null && colaRows.some((r) => r.id === expandedId)) return;
    const firstEnCurso = colaRows.find((r) => r.estadoEjecucion === "en_curso");
    if (expandedId != null) {
      setExpandedId(firstEnCurso?.id ?? null);
      return;
    }
    if (!hasAutoExpandedRef.current && colaRows.length > 0) {
      hasAutoExpandedRef.current = true;
      setExpandedId(firstEnCurso?.id ?? null);
    }
  }, [loading, colaRows, expandedId]);

  const patchExecution = useCallback(
    async (row: MesaEjecucion, patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => {
      if (row.estadoEjecucion === "pendiente_inicio" && patch.estado_ejecucion === "finalizada") {
        toast.error("Inicia la OT antes de finalizarla.");
        return;
      }
      setSavingId(row.id);
      try {
        const nextPatch = { ...patch };
        if (patch.estado_ejecucion === "finalizada" && row.estadoEjecucion === "pausada") {
          const pauses = pausesByExecutionId[row.id] ?? [];
          const openPause = pauses.find((p) => p.resumedAt == null);
          if (openPause) {
            const now = new Date();
            const pausedAtMs = new Date(openPause.pausedAt).getTime();
            const deltaMin = Number.isFinite(pausedAtMs)
              ? Math.max(0, Math.round((now.getTime() - pausedAtMs) / 60000))
              : 0;
            const nowIso = now.toISOString();
            const { error: pauseUpdErr } = await supabase
              .from(TABLE_EJECUCIONES_PAUSAS)
              .update({
                resumed_at: nowIso,
                minutos_pausa: deltaMin,
                updated_at: nowIso,
              })
              .eq("id", openPause.id);
            if (pauseUpdErr) throw new Error(pauseUpdErr.message || "No se pudo cerrar la pausa.");
            nextPatch.minutos_pausada_acum = Math.max(0, row.minutosPausadaAcum) + deltaMin;
          }
        }
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        const updatedBy =
          typeof authUser?.id === "string" && authUser.id.trim().length > 0
            ? authUser.id.trim()
            : null;
        const updatedByEmail =
          typeof authUser?.email === "string" && authUser.email.trim().length > 0
            ? authUser.email.trim()
            : null;

        if (
          nextPatch.estado_ejecucion === "finalizada" &&
          datosProcesoUpdate
        ) {
          const pasosRaw = row.otId ? pasosItinerarioPorOtId.get(row.otId) : undefined;
          const pasosItinerario = pasosRaw
            ? pasosItinerarioParaConsumo(pasosRaw)
            : undefined;
          const { consumido, hojas } = await aplicarConsumoCartelaSiCorresponde(
            supabase,
            {
              procesoId: row.procesoId,
              otNumero: row.ot,
              pasoId: row.otPasoId,
              datos: datosProcesoUpdate,
              pasosItinerario,
            }
          );
          if (consumido && hojas != null) {
            toast.success(
              `Stock descontado: ${hojas.toLocaleString("es-ES")} h del palet.`
            );
          }
        }

        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...nextPatch,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy,
            updated_by_email: updatedByEmail,
          })
          .eq("id", row.id);
        if (error) throw new Error(error.message || "No se pudo actualizar la ejecución.");
        if (nextPatch.estado_ejecucion === "finalizada" && row.mesaTrabajoId) {
          const { error: mesaError } = await supabase
            .from(TABLE_MESA)
            .update({ estado_mesa: "finalizada" })
            .eq("id", row.mesaTrabajoId);
          if (mesaError) throw new Error(mesaError.message || "No se pudo finalizar la mesa.");
        }
        if (datosProcesoUpdate && row.otPasoId) {
          const { error: dpErr } = await supabase
            .from(TABLE_OT_PASOS)
            .update({ datos_proceso: datosProcesoUpdate as Json })
            .eq("id", row.otPasoId);
          if (dpErr) throw new Error(dpErr.message || "No se pudieron guardar los datos del proceso.");
        }
        /* prod_planificacion_pool: sincronizado por trigger prod_trg_mesa_ejecucion_itinerario_finaliza
           (en_transito si quedan pasos; cerrada solo con itinerario completo; sin ot_paso_id -> cerrada). */
        toast.success("Ejecución actualizada.");
        await loadData();
      } catch (e) {
        const msg = errorMessageFromUnknown(e, "No se pudo actualizar la ejecución.");
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [supabase, loadData, pausesByExecutionId, pasosItinerarioPorOtId],
  );

  const beginExecution = useCallback(
    async (
      row: MesaEjecucion,
      patch: Record<string, unknown> = {},
      datosProcesoUpdate?: DatosProcesoGenerico | null,
    ) => {
      if (row.estadoEjecucion !== "pendiente_inicio") {
        toast.error("Solo se pueden iniciar OTs pendientes.");
        return;
      }
      setSavingId(row.id);
      try {
        const nowIso = new Date().toISOString();
        let execId = row.id;

        // Contenedor CTP: materializar fila ligera (sin mesa) antes de iniciar.
        if (row.origenContenedorCtp || isContenedorCtpVirtualId(row.id)) {
          const pasoId =
            parseContenedorCtpVirtualId(row.id) ??
            String(row.otPasoId ?? "").trim();
          if (!pasoId) {
            throw new Error("Paso CTP no encontrado para materializar ejecución.");
          }
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const created = await crearEjecucionLigeraCtp(supabase, {
            otNumero: row.ot,
            otPasoId: pasoId,
            maquinaId: row.maquinaId,
            userId: user?.id ?? null,
            userEmail: user?.email ?? null,
            startImmediately: true,
          });
          execId = created.id;
          if (datosProcesoUpdate && pasoId) {
            const { error: dpErr } = await supabase
              .from(TABLE_OT_PASOS)
              .update({ datos_proceso: datosProcesoUpdate as Json })
              .eq("id", pasoId);
            if (dpErr) throw dpErr;
          }
          toast.success(`OT ${row.ot} iniciada desde contenedor CTP (sin mesa).`);
          setExpandedId(execId);
          await loadData();
          return;
        }

        // Contenedor Troquel: claim = máquina elegida al iniciar.
        if (row.origenContenedorTroquel || isContenedorTroquelVirtualId(row.id)) {
          const pasoId =
            parseContenedorTroquelVirtualId(row.id) ??
            String(row.otPasoId ?? "").trim();
          if (!pasoId) {
            throw new Error(
              "Paso Troquel no encontrado para materializar ejecución.",
            );
          }
          const claimMaquinaId = String(
            (patch.maquina_id as string | undefined) ?? row.maquinaId ?? "",
          ).trim();
          if (!claimMaquinaId) {
            throw new Error(
              "Elige máquina troquel (claim) antes de iniciar.",
            );
          }
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const created = await crearEjecucionLigeraTroquel(supabase, {
            otNumero: row.ot,
            otPasoId: pasoId,
            maquinaId: claimMaquinaId,
            userId: user?.id ?? null,
            userEmail: user?.email ?? null,
            startImmediately: true,
            horasPlanificadas: row.horasPlanificadasSnapshot,
          });
          execId = created.id;
          if (datosProcesoUpdate && pasoId) {
            const { error: dpErr } = await supabase
              .from(TABLE_OT_PASOS)
              .update({ datos_proceso: datosProcesoUpdate as Json })
              .eq("id", pasoId);
            if (dpErr) throw dpErr;
          }
          const maqNombre =
            maquinasTroquel.find((m) => m.id === claimMaquinaId)?.nombre ??
            claimMaquinaId;
          toast.success(
            `OT ${row.ot} iniciada en ${maqNombre} (contenedor Troquel, sin mesa).`,
          );
          setExpandedId(execId);
          await loadData();
          return;
        }

        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...patch,
            inicio_real_at: nowIso,
            estado_ejecucion: "en_curso",
            updated_at: nowIso,
          })
          .eq("id", execId);
        if (error) throw error;
        if (datosProcesoUpdate && row.otPasoId) {
          const { error: dpErr } = await supabase
            .from(TABLE_OT_PASOS)
            .update({ datos_proceso: datosProcesoUpdate as Json })
            .eq("id", row.otPasoId);
          if (dpErr) throw dpErr;
        }
        toast.success(`OT ${row.ot} iniciada en máquina.`);
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo iniciar la OT.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [loadData, supabase, maquinasTroquel],
  );

  const devolverEjecucionAlPool = useCallback(
    async (row: MesaEjecucion) => {
      const mesaId = String(row.mesaTrabajoId ?? "").trim();
      if (!mesaId) {
        toast.error("Esta ejecución no tiene hueco de mesa asociado.");
        return;
      }
      const ok = window.confirm(
        `¿Devolver ${row.ot} al Pool?\n\nSe anula la liberación y desaparece de esta máquina. No queda como terminada.`,
      );
      if (!ok) return;
      setSavingId(row.id);
      try {
        await devolverHuecoMesaAlPool(supabase, {
          otNumero: row.ot,
          mesaTrabajoId: mesaId,
          ejecucionId: row.id,
        });
        toast.success(`OT ${row.ot} devuelta al Pool.`);
        await loadData();
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo devolver la OT al Pool."));
      } finally {
        setSavingId(null);
      }
    },
    [loadData, supabase],
  );

  const imprimirFueraDesdeEjecucion = useCallback(
    async (row: MesaEjecucion) => {
      const ok = window.confirm(
        `¿Mandar ${row.ot} a impresión externa?\n\nSe sustituye Offset/Digital por Impresión EXTERNA y se saca de mesa. Queda en cola de Externos para Ramón.`,
      );
      if (!ok) return;
      setSavingId(row.id);
      try {
        await derivarOtAImpresionExterna(supabase, row.ot);
        toast.success(`${row.ot} lista para Ramón (cola Externos).`);
        await loadData();
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo derivar a impresión externa."));
      } finally {
        setSavingId(null);
      }
    },
    [loadData, supabase],
  );

  const pauseExecution = useCallback(
    async (
      row: MesaEjecucion,
      motivo: MotivoPausa | null,
      patch: Record<string, unknown> = {},
      datosProcesoUpdate?: DatosProcesoGenerico | null,
    ) => {
      if (row.estadoEjecucion !== "en_curso") {
        toast.warning("Solo se pueden pausar OTs en curso.");
        return;
      }
      if (!motivo) {
        toast.warning("Selecciona un motivo antes de pausar la OT.");
        return;
      }
      setSavingId(row.id);
      try {
        const nowIso = new Date().toISOString();
        const { error: insErr } = await supabase.from(TABLE_EJECUCIONES_PAUSAS).insert({
          ejecucion_id: row.id,
          paused_at: nowIso,
          motivo_id: motivo.id,
          motivo: motivo.label,
        });
        if (insErr) throw insErr;
        const { error: updErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...patch,
            estado_ejecucion: "pausada",
            ha_estado_pausada: true,
            num_pausas: Math.max(0, row.numPausas) + 1,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (updErr) throw updErr;
        if (datosProcesoUpdate && row.otPasoId) {
          const { error: dpErr } = await supabase
            .from(TABLE_OT_PASOS)
            .update({ datos_proceso: datosProcesoUpdate as Json })
            .eq("id", row.otPasoId);
          if (dpErr) throw dpErr;
        }
        toast.success("OT pausada.");
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo pausar la OT.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [supabase, loadData],
  );

  const resumeExecution = useCallback(
    async (
      row: MesaEjecucion,
      pauses: MesaEjecucionPausa[],
      patch: Record<string, unknown> = {},
      datosProcesoUpdate?: DatosProcesoGenerico | null,
    ) => {
      const openPause = pauses.find((p) => p.resumedAt == null);
      if (!openPause) {
        toast.error("No se encontró una pausa activa para reanudar.");
        return;
      }
      setSavingId(row.id);
      try {
        const now = new Date();
        const pausedAtMs = new Date(openPause.pausedAt).getTime();
        const deltaMin = Number.isFinite(pausedAtMs)
          ? Math.max(0, Math.round((now.getTime() - pausedAtMs) / 60000))
          : 0;
        const nowIso = now.toISOString();
        const { error: pauseUpdErr } = await supabase
          .from(TABLE_EJECUCIONES_PAUSAS)
          .update({
            resumed_at: nowIso,
            minutos_pausa: deltaMin,
            updated_at: nowIso,
          })
          .eq("id", openPause.id);
        if (pauseUpdErr) throw pauseUpdErr;
        const { error: execUpdErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...patch,
            estado_ejecucion: "en_curso",
            minutos_pausada_acum: Math.max(0, row.minutosPausadaAcum) + deltaMin,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (execUpdErr) throw execUpdErr;
        if (datosProcesoUpdate && row.otPasoId) {
          const { error: dpErr } = await supabase
            .from(TABLE_OT_PASOS)
            .update({ datos_proceso: datosProcesoUpdate as Json })
            .eq("id", row.otPasoId);
          if (dpErr) throw dpErr;
        }
        toast.success("OT reanudada.");
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo reanudar la OT.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [supabase, loadData],
  );

  const selectedMaquinaLabel = useMemo(() => {
    if (selectedMaquina === "all") return "Todas";
    return maquinas.find((m) => m.id === selectedMaquina)?.nombre ?? selectedMaquina;
  }, [maquinas, selectedMaquina]);

  const estadoLabelFiltro = useMemo(() => {
    if (estado === "all") return "Todas";
    if (estado === "activas") return "Activas";
    if (estado === "terminadas_hoy") return "Terminadas de hoy";
    return estadoLabel(estado);
  }, [estado]);

  const handleExportExcel = useCallback(() => {
    try {
      exportEjecucionesExcel(filtered, {
        maquina: selectedMaquinaLabel,
        estado: search
          ? `${estadoLabelFiltro} · buscar="${search}"`
          : estadoLabelFiltro,
      }, pausesByExecutionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar Excel.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro, pausesByExecutionId, search]);

  const handleExportPdf = useCallback(() => {
    try {
      exportEjecucionesPdf(filtered, {
        maquina: selectedMaquinaLabel,
        estado: search
          ? `${estadoLabelFiltro} · buscar="${search}"`
          : estadoLabelFiltro,
      }, pausesByExecutionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar PDF.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro, pausesByExecutionId, search]);

  return (
    <>
    <HojaRutaOtDialog
      otNumero={hojaRutaOt}
      open={hojaRutaOt != null}
      onOpenChange={(o) => {
        if (!o) setHojaRutaOt(null);
      }}
    />
    <Card className="border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg text-[#002147]">OTs en ejecución</CardTitle>
            <CardDescription>
              Toca una OT para abrir el parte. En curso queda abierta al entrar. Terminadas, ocultas salvo filtro.
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            {!tabletMode && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
                  <FileSpreadsheet className="mr-1 size-4" />
                  Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} disabled={loading}>
                  <FileText className="mr-1 size-4" />
                  PDF
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              <RefreshCcw className={cn("mr-1 size-4", loading && "animate-spin")} />
              Recargar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
            Ámbito: {etiquetaAmbitoEjecucion}
          </span>
          <Input
            className={cn(
              "w-full min-w-[10rem] max-w-xs sm:w-56",
              tabletMode ? "h-11 text-sm" : "h-8 text-xs",
            )}
            placeholder="Buscar OT, cliente, trabajo…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar OTs en ejecución"
          />
          <select
            className={cn(
              "rounded-md border border-slate-300 bg-white px-2",
              tabletMode ? "h-11 text-sm" : "h-8",
            )}
            value={selectedMaquina}
            onChange={(e) => setSelectedMaquina(e.target.value)}
          >
            <option value="all">Todas las máquinas</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            className={cn(
              "rounded-md border border-slate-300 bg-white px-2",
              tabletMode ? "h-11 text-sm" : "h-8",
            )}
            value={estado}
            onChange={(e) => setEstado(e.target.value as FiltroEstadoEjecucion)}
          >
            <option value="activas">Activas</option>
            <option value="en_curso">En curso</option>
            <option value="pausada">Pausadas</option>
            <option value="pendiente_inicio">Por hacer</option>
            <option value="terminadas_hoy">Terminadas de hoy</option>
            <option value="finalizada">Finalizadas</option>
            <option value="all">Todas</option>
          </select>
          <label
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600"
            title="OTs de laboratorio Minerva (número ≥ 98000). Por defecto ocultas."
          >
            <input
              type="checkbox"
              className="size-3.5 rounded border-slate-300"
              checked={mostrarPruebas}
              onChange={(e) => {
                const v = e.target.checked;
                setMostrarPruebas(v);
                try {
                  localStorage.setItem(
                    STORAGE_EJECUCION_MOSTRAR_PRUEBAS,
                    v ? "1" : "0",
                  );
                } catch {
                  /* ignore */
                }
              }}
            />
            Mostrar OTs prueba (≥98.000)
          </label>
          <label
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600"
            title="Contenedor CTP: por defecto solo ejecutable. CTP disponible = ejecutable (sin papel)."
          >
            <input
              type="checkbox"
              className="size-3.5 rounded border-slate-300"
              checked={soloEjecutableCtp}
              onChange={(e) => {
                const v = e.target.checked;
                setSoloEjecutableCtp(v);
                try {
                  localStorage.setItem(
                    STORAGE_EJECUCION_SOLO_EJECUTABLE_CTP,
                    v ? "1" : "0",
                  );
                } catch {
                  /* ignore */
                }
              }}
            />
            Solo ejecutable (CTP)
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && colaRows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando ejecuciones...
          </div>
        ) : null}

        {!loading && colaRows.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
            No hay OTs en ejecución para los filtros actuales.
          </p>
        ) : null}

        {colaRows.length > 0 ? (
          <ul className="space-y-2">
            {colaRows.map((row) => {
              const expanded = expandedId === row.id;
              const pauses = pausesByExecutionId[row.id] ?? [];
              const despacho = despachoByOt[row.ot] ?? null;
              const procesoNombre =
                row.procesoId != null
                  ? (getCamposConfigByProcesoId(row.procesoId)?.procesoNombre ?? null)
                  : null;
              const tiempo = tiempoColaLabel(row, pauses, new Date(nowTick));
              const desviacion =
                row.procesoId !== PROCESO_CTP_ID &&
                row.horasReales != null &&
                row.horasPlanificadasSnapshot != null
                  ? row.horasReales - row.horasPlanificadasSnapshot
                  : null;
              return (
                <li key={row.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId((cur) => (cur === row.id ? null : row.id))}
                    className={cn(
                      "flex w-full min-h-16 items-center gap-3 border-l-4 px-3 py-2.5 text-left",
                      estadoColaRowClass(row.estadoEjecucion),
                      expanded && "ring-1 ring-inset ring-[#002147]/20",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        estadoColaClass(row.estadoEjecucion),
                      )}
                    >
                      {estadoLabel(row.estadoEjecucion)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-base font-bold tabular-nums text-[#002147]">
                        OT {row.ot}
                        {row.origenContenedorCtp ? (
                          <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                            Contenedor CTP
                          </span>
                        ) : null}
                        {row.origenContenedorTroquel ? (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                            Contenedor Troquel
                          </span>
                        ) : null}
                        {otMetaByOt[row.ot]?.formaDescripcion ? (
                          <span className="ml-1.5 font-sans text-xs font-normal text-slate-600">
                            · {otMetaByOt[row.ot]?.formaDescripcion}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-slate-700">
                        {[despacho?.cliente, despacho?.titulo].filter(Boolean).join(" · ") || "Sin cliente / trabajo"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {[procesoNombre, row.maquinaNombre].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
                      {tiempo}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-slate-400 transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded ? (
                    <div className="border-t border-slate-200 p-2">
                      <ExecutionCard
                        key={`${row.id}-${row.updatedAt}`}
                        row={row}
                        despacho={despacho}
                        otMeta={otMetaByOt[row.ot] ?? null}
                        hijaComponentes={hijaComponentesByOt[row.ot] ?? []}
                        pauses={pauses}
                        motivosPausa={motivosPausa}
                        cajasEmbalaje={cajasEmbalaje}
                        tipoEngomadoOptions={tipoEngomadoOptions}
                        margenesSobreproduccion={margenesSobreproduccion}
                        desviacion={desviacion}
                        saving={savingId === row.id}
                        maquinasTroquel={maquinasTroquel}
                        selectedMaquinaFilter={selectedMaquina}
                        pasosOt={
                          row.otId
                            ? (pasosItinerarioPorOtId.get(row.otId) ?? [])
                            : []
                        }
                        pasosItinerario={
                          row.otId
                            ? pasosItinerarioParaConsumo(pasosItinerarioPorOtId.get(row.otId) ?? [])
                            : []
                        }
                        onPatch={(patch, dp) => void patchExecution(row, patch, dp)}
                        onBegin={(patch, dp) => void beginExecution(row, patch, dp)}
                        onDevolverAlPool={() => void devolverEjecucionAlPool(row)}
                        onImprimirFuera={() => void imprimirFueraDesdeEjecucion(row)}
                        onPause={(motivo, patch, dp) => void pauseExecution(row, motivo, patch, dp)}
                        onResume={(pausesNext, patch, dp) => void resumeExecution(row, pausesNext, patch, dp)}
                        onOpenHojaRuta={() => setHojaRutaOt(row.ot)}
                        adminProfile={adminProfile}
                        onAdminSuccess={() => void loadData()}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
    </>
  );
}

function ExecutionCard({
  row,
  despacho,
  otMeta,
  hijaComponentes,
  pauses,
  motivosPausa,
  cajasEmbalaje,
  tipoEngomadoOptions,
  margenesSobreproduccion,
  desviacion,
  saving,
  maquinasTroquel,
  selectedMaquinaFilter,
  pasosOt,
  pasosItinerario,
  onPatch,
  onBegin,
  onDevolverAlPool,
  onImprimirFuera,
  onPause,
  onResume,
  onOpenHojaRuta,
  adminProfile,
  onAdminSuccess,
}: {
  row: MesaEjecucion;
  despacho: DespachoInfo | null;
  otMeta: OtMetaInfo | null;
  hijaComponentes: HijaComponenteRow[];
  pauses: MesaEjecucionPausa[];
  motivosPausa: MotivoPausa[];
  cajasEmbalaje: CajaEmbalajeOption[];
  tipoEngomadoOptions: string[];
  margenesSobreproduccion: SobreproduccionMargenesParametros;
  desviacion: number | null;
  saving: boolean;
  maquinasTroquel: ContenedorTroquelMaquina[];
  selectedMaquinaFilter: string;
  pasosOt: PasoItinerarioFormato[];
  pasosItinerario: PasoItinerarioConsumo[];
  onPatch: (patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => void;
  onBegin: (patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => void;
  onDevolverAlPool: () => void;
  onImprimirFuera: () => void;
  onPause: (
    motivo: MotivoPausa | null,
    patch?: Record<string, unknown>,
    datosProcesoUpdate?: DatosProcesoGenerico | null,
  ) => void;
  onResume: (
    pauses: MesaEjecucionPausa[],
    patch?: Record<string, unknown>,
    datosProcesoUpdate?: DatosProcesoGenerico | null,
  ) => void;
  onOpenHojaRuta: () => void;
  adminProfile: ProfileConPermisos | null;
  onAdminSuccess: () => void;
}) {
  const isContenedorVirtual =
    Boolean(row.origenContenedorCtp) ||
    Boolean(row.origenContenedorTroquel) ||
    isContenedorCtpVirtualId(row.id) ||
    isContenedorTroquelVirtualId(row.id);
  const needsTroquelClaim =
    Boolean(row.origenContenedorTroquel) || isContenedorTroquelVirtualId(row.id);
  const [claimMaquinaId, setClaimMaquinaId] = useState(() => {
    if (!needsTroquelClaim) return "";
    if (
      selectedMaquinaFilter !== "all" &&
      maquinasTroquel.some((m) => m.id === selectedMaquinaFilter)
    ) {
      return selectedMaquinaFilter;
    }
    return maquinasTroquel[0]?.id ?? "";
  });
  useEffect(() => {
    if (!needsTroquelClaim || claimMaquinaId) return;
    if (
      selectedMaquinaFilter !== "all" &&
      maquinasTroquel.some((m) => m.id === selectedMaquinaFilter)
    ) {
      setClaimMaquinaId(selectedMaquinaFilter);
      return;
    }
    if (maquinasTroquel[0]?.id) setClaimMaquinaId(maquinasTroquel[0].id);
  }, [
    needsTroquelClaim,
    claimMaquinaId,
    maquinasTroquel,
    selectedMaquinaFilter,
  ]);
  const [incidencia, setIncidencia] = useState(row.incidencia ?? "");
  const [accion, setAccion] = useState(row.accionCorrectiva ?? "");
  const [maquinista, setMaquinista] = useState(row.maquinista ?? "");
  const [observaciones, setObservaciones] = useState(row.observaciones ?? "");
  const [pausePickerOpen, setPausePickerOpen] = useState(false);
  const [selectedMotivoId, setSelectedMotivoId] = useState("");
  const [datosProcesoOpen, setDatosProcesoOpen] = useState(false);
  const motivosPausaDisponibles = useMemo(
    () => motivosPausa.filter((motivo) => motivoAplicaATipoMaquina(motivo, row.maquinaTipo)),
    [motivosPausa, row.maquinaTipo],
  );

  const cajasDynamicOptions = useMemo(
    () => ({
      material_impresion: materialOptionsForDespacho(despacho),
      codigo_caja_embalaje: cajasEmbalaje.map((c) => ({
        value: c.codigo,
        label: c.descripcion?.trim() ? `${c.codigo} · ${c.descripcion}` : c.codigo,
      })),
      tipo_engomado: tipoEngomadoOptions.map((label) => ({ value: label, label })),
    }),
    [cajasEmbalaje, despacho, tipoEngomadoOptions],
  );

  const cajasDefaultByCodigo = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cajasEmbalaje) {
      if (c.bultos_por_palet_default != null) {
        map.set(c.codigo, c.bultos_por_palet_default);
      }
    }
    return map;
  }, [cajasEmbalaje]);

  const [datosProcesoLocal, setDatosProcesoLocal] = useState<DatosProcesoGenerico>(() => {
    const existing = (row.datosProcesoJson as DatosProcesoGenerico) ?? {};
    const pid = row.procesoId;
    if (Object.keys(existing).length > 0) {
      let seeded = seedRealValuesFromPrevistos(pid, existing);
      if (pid === 10) {
        seeded = enrichTroquelDatosProceso(
          seeded,
          despacho,
          row.salidaProcesoAnterior,
        );
      }
      if (pid === PROCESO_DESBROCE_ID) {
        seeded = enrichDesbroceDatosProceso(seeded, {
          salidaProcesoAnterior: row.salidaProcesoAnterior,
          hijaComponentes,
          despachoPoses: despacho?.poses ?? null,
        });
      }
      if (pid === PROCESO_ENGOMADO) {
        seeded = enrichEngomadoDatosProceso(seeded, cajasDefaultByCodigo);
      }
      if (pid === PROCESO_ENGOMADO && row.salidaProcesoAnterior != null) {
        const prevUnit =
          PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "";
        if (prevUnit === "estuches") {
          const est = Math.max(0, Math.trunc(row.salidaProcesoAnterior));
          if (est > 0) {
            seeded = enrichEngomadoDatosProceso(
              {
                ...seeded,
                estuches_realizar: est,
                estuches_engomados: est,
                cantidad_total: est,
              },
              cajasDefaultByCodigo,
            );
          }
        }
      }
      if (pid === PROCESO_MANIPULADOS) {
        seeded = enrichManipuladoDatosProceso(seeded, cajasDefaultByCodigo);
      }
      return pid != null
        ? aplicarPrefillFormatoEncadenado(pid, seeded, row.formatoAnterior)
        : seeded;
    }
    if (!despacho || !pid) return {};
    const base: DatosProcesoGenerico = {};
    if (pid === 1 || pid === 2) {
      const materialImpresion = pickMaterialImpresion(despacho);
      if (materialImpresion) base.material_impresion = materialImpresion;
      const hojasDesdeAnterior =
        row.salidaProcesoAnterior != null && Number.isFinite(row.salidaProcesoAnterior)
          ? Math.max(0, Math.trunc(row.salidaProcesoAnterior))
          : null;
      if (hojasDesdeAnterior != null && hojasDesdeAnterior > 0) {
        base.hojas_brutas = hojasDesdeAnterior;
        base.hojas_netas = hojasDesdeAnterior;
        base.hojas_merma = 0;
        base.hojas_impresas = hojasDesdeAnterior;
      } else {
        if (despacho.hojasBrutas != null) base.hojas_brutas = despacho.hojasBrutas;
        if (despacho.hojasNetas != null) base.hojas_netas = despacho.hojasNetas;
        const brutas = despacho.hojasBrutas;
        const netas = despacho.hojasNetas;
        if (brutas != null && netas != null) {
          const mermaPlan = Math.max(0, Math.trunc(brutas) - Math.trunc(netas));
          base.hojas_merma = mermaPlan;
          base.hojas_impresas = Math.max(0, Math.trunc(brutas) - mermaPlan);
        } else if (netas != null) {
          base.hojas_impresas = netas;
          base.hojas_merma = 0;
        } else if (brutas != null) {
          base.hojas_impresas = brutas;
          base.hojas_merma = 0;
        }
      }
      if (despacho.tintas) base.tintas_cara = despacho.tintas;
      if (despacho.acabadoPral) base.acabado_principal = despacho.acabadoPral;
      if (despacho.horasEntrada != null) base.horas_entrada_previsto = despacho.horasEntrada;
      if (despacho.horasTiraje != null) base.horas_impresion_previsto = despacho.horasTiraje;
    }
    if (pid === 10) {
      Object.assign(
        base,
        enrichTroquelDatosProceso({}, despacho, row.salidaProcesoAnterior),
      );
      const hojasEntrada = toFiniteNum(base.hojas_troquelar);
      if (hojasEntrada != null && hojasEntrada > 0) {
        if (isDatoProcesoEmpty(base.hojas_troqueladas)) {
          base.hojas_troqueladas = hojasEntrada;
        }
        if (isDatoProcesoEmpty(base.hojas_merma)) {
          base.hojas_merma = 0;
        }
      }
      if (despacho.horasTroquelado != null) {
        if (isDatoProcesoEmpty(base.horas_preparacion_previsto)) {
          base.horas_preparacion_previsto =
            Math.round(despacho.horasTroquelado * 0.3 * 10) / 10;
        }
        if (isDatoProcesoEmpty(base.horas_tiraje_previsto)) {
          base.horas_tiraje_previsto =
            Math.round(despacho.horasTroquelado * 0.7 * 10) / 10;
        }
      }
    }
    if (pid === 12) {
      const prevUnit =
        PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "";
      const estDesdeAnterior =
        row.salidaProcesoAnterior != null &&
        Number.isFinite(row.salidaProcesoAnterior) &&
        prevUnit === "estuches"
          ? Math.max(0, Math.trunc(row.salidaProcesoAnterior))
          : null;
      if (estDesdeAnterior != null && estDesdeAnterior > 0) {
        base.estuches_realizar = estDesdeAnterior;
        base.estuches_engomados = estDesdeAnterior;
        base.cantidad_total = estDesdeAnterior;
      } else if (despacho.cantidad != null) {
        base.estuches_realizar = despacho.cantidad;
        base.estuches_engomados = despacho.cantidad;
        base.cantidad_total = despacho.cantidad;
      }
      if (despacho.horasEngomadoPrep != null)
        base.horas_preparacion_previsto = despacho.horasEngomadoPrep;
      if (despacho.horasEngomadoTiraje != null)
        base.horas_tiraje_previsto = despacho.horasEngomadoTiraje;
      if (
        despacho.horasEngomadoPrep == null &&
        despacho.horasEngomadoTiraje == null &&
        despacho.horasEngomado != null
      ) {
        base.horas_preparacion_previsto =
          Math.round(despacho.horasEngomado * 0.3 * 10) / 10;
        base.horas_tiraje_previsto =
          Math.round(despacho.horasEngomado * 0.7 * 10) / 10;
      }
      if (despacho.tipoEngomado) base.tipo_engomado = despacho.tipoEngomado;
      Object.assign(base, enrichEngomadoDatosProceso(base, cajasDefaultByCodigo));
    }
    if (pid === PROCESO_DESBROCE_ID) {
      Object.assign(
        base,
        enrichDesbroceDatosProceso(base, {
          salidaProcesoAnterior: row.salidaProcesoAnterior,
          hijaComponentes,
          despachoPoses: despacho.poses ?? null,
        }),
      );
    }
    if (pid === PROCESO_MANIPULADOS) {
      if (row.salidaProcesoAnterior != null) {
        base.unidades = Math.max(0, Math.trunc(row.salidaProcesoAnterior));
      } else if (despacho.cantidad != null) {
        base.unidades = despacho.cantidad;
      }
      Object.assign(base, enrichManipuladoDatosProceso(base, cajasDefaultByCodigo));
    }
    return seedRealValuesFromPrevistos(
      pid,
      aplicarPrefillFormatoEncadenado(pid, base, row.formatoAnterior),
    );
  });

  // Si el catálogo de cajas llega después del primer paint, completar bultos/palet y alias uds.
  useEffect(() => {
    if (
      row.procesoId !== PROCESO_ENGOMADO &&
      row.procesoId !== PROCESO_MANIPULADOS
    ) {
      return;
    }
    if (cajasDefaultByCodigo.size === 0) return;
    setDatosProcesoLocal((prev) => {
      const next =
        row.procesoId === PROCESO_MANIPULADOS
          ? enrichManipuladoDatosProceso(prev, cajasDefaultByCodigo)
          : enrichEngomadoDatosProceso(prev, cajasDefaultByCodigo);
      if (
        next.estuches_por_bulto === prev.estuches_por_bulto &&
        next.bultos_por_palet === prev.bultos_por_palet &&
        next.bultos_completos === prev.bultos_completos &&
        next.pico === prev.pico &&
        next.bultos_totales === prev.bultos_totales &&
        next.palets === prev.palets &&
        next.num_paquetes === prev.num_paquetes &&
        next.num_paquetes_etiqueta === prev.num_paquetes_etiqueta
      ) {
        return prev;
      }
      return next;
    });
  }, [row.procesoId, cajasDefaultByCodigo]);

  const hasCamposConfig = useMemo(
    () => row.procesoId != null && getCamposConfigByProcesoId(row.procesoId) != null,
    [row.procesoId],
  );

  const { margenes } = useFormatoMargenParametros();
  const formatoAvisoMsg = useMemo(
    () =>
      row.procesoId == null
        ? null
        : formatoCabeAvisoEjecucion({
            procesoId: row.procesoId,
            troquelCode: despacho?.troquel,
            midesTroquel: despacho?.tamanoCorte,
            tamanoHojaCompra: despacho?.tamanoHoja,
            pasosOt,
            formatoAnterior: row.formatoAnterior,
            formatoAnteriorOrigenProcesoId: row.procesoAnteriorId,
            formatoAnteriorOrigenNombre: row.formatoAnteriorOrigenNombre,
            datosProcesoActual: datosProcesoLocal,
            margenes,
          }),
    [
      row.procesoId,
      row.procesoAnteriorId,
      row.formatoAnterior,
      row.formatoAnteriorOrigenNombre,
      despacho?.troquel,
      despacho?.tamanoCorte,
      despacho?.tamanoHoja,
      pasosOt,
      datosProcesoLocal,
      margenes,
    ],
  );

  const isPendingStart = row.estadoEjecucion === "pendiente_inicio";
  const canEdit = row.estadoEjecucion !== "finalizada" && row.estadoEjecucion !== "cancelada";

  const buildSyncPatch = useCallback(
    (datos: DatosProcesoGenerico = datosProcesoLocal): Record<string, unknown> =>
      buildEjecucionHorasSyncPatch(row.procesoId, datos),
    [datosProcesoLocal, row.procesoId],
  );

  const [cerrarProcesoOpen, setCerrarProcesoOpen] = useState(false);
  const [cerrarDatosDraft, setCerrarDatosDraft] = useState<DatosProcesoGenerico>({});
  const [horasMesaSnapshot, setHorasMesaSnapshot] = useState<number | null>(null);

  const openCerrarProceso = useCallback(() => {
    if (!row.inicioRealAt) {
      toast.error("Inicia la OT antes de cerrar el proceso.");
      return;
    }
    const mesa =
      computeHorasMesaNetas({
        inicioRealAt: row.inicioRealAt,
        minutosPausadaAcum: row.minutosPausadaAcum,
        pauses: pauses.map((p) => ({
          pausedAt: p.pausedAt,
          resumedAt: p.resumedAt,
          minutosPausa: p.minutosPausa,
        })),
      }) ?? 0;
    setHorasMesaSnapshot(mesa > 0 ? mesa : null);
    setCerrarDatosDraft(
      applyHorasMesaToDatosProceso(row.procesoId, datosProcesoLocal, mesa),
    );
    setDatosProcesoOpen(true);
    setCerrarProcesoOpen(true);
  }, [row.inicioRealAt, row.procesoId, row.minutosPausadaAcum, pauses, datosProcesoLocal]);

  const confirmCerrarProceso = useCallback(() => {
    const datosFinal = { ...datosProcesoLocal, ...cerrarDatosDraft };
    if (procesoUsaCartela(row.procesoId, pasosItinerario)) {
      const cartelaErr = validarCartelaConsumoAntesCerrar(datosFinal);
      if (cartelaErr) {
        toast.error(cartelaErr);
        return;
      }
    }
    if (row.procesoId === PROCESO_CTP_ID) {
      const pendientes = ctpRequisitosPendientes(datosFinal);
      if (pendientes.length > 0) {
        toast.warning(
          `CTP: ${pendientes.length} tarea${pendientes.length !== 1 ? "s" : ""} requerida${pendientes.length !== 1 ? "s" : ""} sin confirmar (${pendientes.map((p) => p.label).join(", ")}).`,
        );
      }
    }
    setDatosProcesoLocal(datosFinal);
    onPatch(
      {
        estado_ejecucion: "finalizada",
        fin_real_at: new Date().toISOString(),
        maquinista: maquinista.trim() || null,
        incidencia: incidencia.trim() || null,
        accion_correctiva: accion.trim() || null,
        observaciones: observaciones.trim() || null,
        ...buildEjecucionHorasSyncPatch(row.procesoId, datosFinal),
      },
      hasCamposConfig ? datosFinal : null,
    );
    setCerrarProcesoOpen(false);
  }, [
    cerrarDatosDraft,
    datosProcesoLocal,
    hasCamposConfig,
    maquinista,
    incidencia,
    accion,
    observaciones,
    onPatch,
    row.procesoId,
    pasosItinerario,
  ]);

  // Campos que deben persistir en CUALQUIER acción (iniciar, pausar,
  // reanudar, guardar, finalizar) para no perder lo tecleado.
  const buildCommonFieldsPatch = useCallback(
    (): Record<string, unknown> => ({
      maquinista: maquinista.trim() || null,
      incidencia: incidencia.trim() || null,
      accion_correctiva: accion.trim() || null,
      observaciones: observaciones.trim() || null,
      ...buildSyncPatch(),
    }),
    [maquinista, incidencia, accion, observaciones, buildSyncPatch],
  );

  const datosProcesoPatch = hasCamposConfig ? datosProcesoLocal : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-bold text-[#002147]">
            OT {row.ot}
            {otMeta?.tipoHija === "forma" && otMeta.formaDescripcion ? (
              <span className="ml-1.5 text-xs font-normal text-slate-600">· {otMeta.formaDescripcion}</span>
            ) : null}
          </p>
          <p className="text-xs text-slate-600">
            {row.maquinaNombre} · {row.fechaPlanificada ?? "sin fecha"} · {row.turno ?? "sin turno"}
          </p>
          <p className="text-[11px] text-slate-500">
            {row.inicioRealAt
              ? `Inicio: ${format(new Date(row.inicioRealAt), "dd/MM/yyyy HH:mm", { locale: es })}`
              : `Liberada: ${
                  row.liberadaAt
                    ? format(new Date(row.liberadaAt), "dd/MM/yyyy HH:mm", { locale: es })
                    : "pendiente"
                }`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onOpenHojaRuta}
            title="Ver hoja de ruta completa"
          >
            <MapIcon className="size-3.5" />
            Hoja de ruta
          </Button>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[11px] font-semibold",
              estadoColaClass(row.estadoEjecucion),
            )}
          >
            {estadoLabel(row.estadoEjecucion)}
          </span>
        </div>
      </div>

      {!canEdit ? (
        <>
          <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
            Proceso cerrado · solo consulta para operario.
          </p>
          {row.estadoEjecucion === "finalizada" && row.otId && row.otPasoId ? (
            <PasoAdminActions
              profile={adminProfile}
              pasosItinerario={pasosItinerario}
              onSuccess={onAdminSuccess}
              paso={{
                pasoId: String(row.otPasoId),
                otNumero: row.ot,
                otId: row.otId,
                procesoId: row.procesoId,
                procesoNombre: null,
                estado: "finalizado",
                datosProceso: (row.datosProcesoJson as DatosProcesoGenerico) ?? {},
                ejecucionId: row.id,
                mesaTrabajoId: row.mesaTrabajoId,
                horasReales: row.horasReales,
              }}
            />
          ) : null}
        </>
      ) : null}

      {despacho ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[10px] text-slate-600">
          {despacho.cliente ? <span><b>Cliente:</b> {despacho.cliente}</span> : null}
          {despacho.cantidad != null ? <span><b>Cant:</b> {despacho.cantidad.toLocaleString("es-ES")}</span> : null}
          {despacho.titulo ? <span className="max-w-[200px] truncate" title={despacho.titulo}><b>Trabajo:</b> {despacho.titulo}</span> : null}
          {despacho.fechaEntrega ? <span><b>Entrega:</b> {format(new Date(despacho.fechaEntrega), "dd/MM/yy", { locale: es })}</span> : null}
          {despacho.material ? <span><b>Mat:</b> {despacho.material} {despacho.gramaje ? `${despacho.gramaje}g` : ""}</span> : null}
          {despacho.tamanoHoja ? <span><b>Formato compra:</b> {despacho.tamanoHoja}</span> : null}
          {despacho.hojasBrutas != null ? <span><b>H.brutas:</b> {despacho.hojasBrutas.toLocaleString("es-ES")}</span> : null}
          {(() => {
            const isImp = row.procesoId === 1 || row.procesoId === 2;
            const netas = isImp
              ? hojasEntradaImpresionEjecucion(
                  row.salidaProcesoAnterior,
                  datosProcesoLocal,
                  despacho,
                )
              : despacho.hojasNetas;
            if (netas == null) return null;
            return (
              <span>
                <b>H.netas{isImp && row.salidaProcesoAnterior == null ? " plan" : ""}:</b>{" "}
                {netas.toLocaleString("es-ES")}
              </span>
            );
          })()}
          {despacho.tintas ? <span><b>Tintas:</b> {despacho.tintas}</span> : null}
          {despacho.acabadoPral ? <span><b>Acabado:</b> {despacho.acabadoPral}</span> : null}
          {despacho.troquel ? <span><b>Troquel:</b> {despacho.troquel}</span> : null}
          {despacho.poses != null ? <span><b>Poses:</b> {despacho.poses}</span> : null}
        </div>
      ) : null}

      {row.formatoAnterior && row.procesoId !== PROCESO_CTP_ID ? (
        <div className="mt-2 rounded border border-sky-200 bg-sky-50/80 px-2 py-1.5 text-[10px] text-sky-900">
          <span className="font-medium">Formato pliego de entrada</span>
          {" · "}
          <span>{row.formatoAnteriorOrigenNombre ?? "Origen"}</span>
          {" → "}
          <span className="font-semibold">{row.formatoAnterior}</span>
          {row.procesoId === 10 ? (
            <span className="text-sky-700">
              {" "}
              · El tamaño de corte del troquel es independiente del pliego.
            </span>
          ) : null}
        </div>
      ) : null}

      {formatoAvisoMsg ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <span>{formatoAvisoMsg}</span>
        </div>
      ) : null}

      {row.procesoId === PROCESO_DESBROCE_ID && shouldShowNoMezclarBanner(otMeta?.tipoHija, hijaComponentes) ? (
        <div className="mt-2 rounded border-2 border-orange-400 bg-orange-50 px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-orange-900">
                FORMA CON VARIAS REFERENCIAS — NO MEZCLAR
              </p>
              <div className="mt-1.5 space-y-1 text-[11px] text-orange-800">
                {hijaComponentes.map((comp, idx) => (
                  <div key={idx} className="flex items-baseline gap-2">
                    <span className="font-medium">{comp.poses_en_forma} {comp.poses_en_forma === 1 ? "pose" : "poses"}</span>
                    <span>→</span>
                    <span className="font-semibold">{comp.referencia_codigo}</span>
                    {comp.referencia_descripcion ? (
                      <span className="text-orange-700">({comp.referencia_descripcion})</span>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-orange-900">
                Salida esperada: {hijaComponentes.map(c => `${(c.cantidad_objetivo ?? 0).toLocaleString("es-ES")} uds`).join(" + ")} = {totalEstuchesFormaComponentes(hijaComponentes).toLocaleString("es-ES")} uds totales
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {row.procesoId === PROCESO_CTP_ID ? (
        <div className="mt-3">
          <CtpEjecucionRequisitosBlock
            datos={datosProcesoLocal}
            onDatosChange={setDatosProcesoLocal}
            readonly={!canEdit}
          />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Maquinista</Label>
          <Input value={maquinista} onChange={(e) => setMaquinista(e.target.value)} disabled={!canEdit || saving} />
        </div>
        <div>
          <Label className="text-xs">Incidencia</Label>
          <Input value={incidencia} onChange={(e) => setIncidencia(e.target.value)} disabled={!canEdit || saving} />
        </div>
        <div>
          <Label className="text-xs">Acción correctiva</Label>
          <Input value={accion} onChange={(e) => setAccion(e.target.value)} disabled={!canEdit || saving} />
        </div>
      </div>

      <div className="mt-2">
        <Label className="text-xs">Observaciones</Label>
        <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={!canEdit || saving} />
      </div>

      {row.procesoId != null ? (() => {
        const procesoId = row.procesoId;
        const isImpresion = procesoId === 1 || procesoId === 2;
        const procesoConfig = PROCESO_CAMPOS_CONFIG[procesoId];
        const outputUnit = isImpresion
          ? "hojas"
          : procesoConfig?.inputFromProcessIds
            ? (PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "uds")
            : "uds";
        const cantidad = despacho?.cantidad ?? null;
        const poses =
          (datosProcesoLocal.poses as number | undefined) ??
          despacho?.poses ??
          null;
        const salidaRaw = isImpresion
          ? hojasEntradaImpresionEjecucion(
              row.salidaProcesoAnterior,
              datosProcesoLocal,
              despacho,
            )
          : row.salidaProcesoAnterior;
        if (salidaRaw == null) return null;

        let proyeccion: number | null = null;
        let proyeccionLabel = "";
        let semaforoTitulo = "";
        if (isImpresion) {
          semaforoTitulo =
            row.salidaProcesoAnterior != null && row.salidaProcesoAnteriorNombre
              ? `Entrada desde proceso anterior · ${row.salidaProcesoAnteriorNombre}`
              : "Proyección desde despacho · hojas netas a imprimir";
          const hojasLabel =
            row.salidaProcesoAnterior != null ? "hojas a imprimir" : "hojas netas";
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} ${hojasLabel} → sin datos de poses aún`;
          if (poses != null && poses > 0) {
            const est = Math.floor(salidaRaw * poses);
            proyeccion = est;
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} ${hojasLabel} × ${poses} poses = ${est.toLocaleString("es-ES")} estuches est.`;
          }
        } else if (procesoId === 10) {
          semaforoTitulo = `Entrada desde proceso anterior · ${row.salidaProcesoAnteriorNombre}`;
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas → sin datos de poses aún`;
          if (poses != null && poses > 0) {
            const est = Math.floor(salidaRaw * poses);
            proyeccion = est;
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas × ${poses} poses = ${est.toLocaleString("es-ES")} estuches est.`;
          }
        } else if (procesoId === PROCESO_DESBROCE_ID) {
          // Desbroce: hojas troqueladas × poses → estuches planos
          semaforoTitulo = `Entrada desde proceso anterior · ${row.salidaProcesoAnteriorNombre}`;
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas → sin datos de poses aún`;
          if (poses != null && poses > 0) {
            const est = Math.floor(salidaRaw * poses);
            proyeccion = est;
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas × ${poses} poses = ${est.toLocaleString("es-ES")} estuches est.`;
          }
        } else if (procesoId === 12) {
          semaforoTitulo = `Entrada desde proceso anterior · ${row.salidaProcesoAnteriorNombre}`;
          // Si el predecesor ya produce estuches (Desbroce), no multiplicamos por poses
          const anteriorOutputUnit =
            PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "uds";
          if (anteriorOutputUnit === "estuches") {
            proyeccion = Math.floor(salidaRaw);
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} estuches desbrozados (sin multiplicar por poses)`;
          } else {
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas troqueladas de entrada`;
            if (poses != null && poses > 0) {
              const est = Math.floor(salidaRaw * poses);
              proyeccion = est;
              proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas × ${poses} poses = ${est.toLocaleString("es-ES")} estuches est.`;
            }
          }
        } else if (procesoId === PROCESO_MANIPULADOS) {
          semaforoTitulo = `Entrada desde proceso anterior · ${row.salidaProcesoAnteriorNombre}`;
          const anteriorOutputUnit =
            PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "uds";
          if (anteriorOutputUnit === "estuches" || anteriorOutputUnit === "hojas") {
            proyeccion = Math.floor(salidaRaw);
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} ${anteriorOutputUnit} de entrada`;
          } else {
            proyeccion = salidaRaw;
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} ${outputUnit}`;
          }
        } else {
          semaforoTitulo = `Entrada desde proceso anterior · ${row.salidaProcesoAnteriorNombre}`;
          proyeccion = salidaRaw;
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} ${outputUnit}`;
        }

        const MARGEN_DEFICIT_PCT = 0.05;
        const margenSobreproduccionPct =
          margenSobreproduccionPorProceso(procesoId, margenesSobreproduccion);
        let semaforoColor = "";
        let semaforoIcon = "";
        let semaforoTexto = "";
        if (cantidad != null && proyeccion != null) {
          if (
            margenSobreproduccionPct != null &&
            proyeccion > cantidad * (1 + margenSobreproduccionPct / 100)
          ) {
            semaforoColor = "bg-orange-50 border-orange-300 text-orange-900";
            semaforoIcon = "🟠";
            semaforoTexto = `SOBREPRODUCCIÓN — proyección (${proyeccion.toLocaleString("es-ES")}) supera el pedido (${cantidad.toLocaleString("es-ES")}) en más del ${margenSobreproduccionPct.toLocaleString("es-ES")}%`;
          } else if (proyeccion >= cantidad) {
            semaforoColor = "bg-emerald-50 border-emerald-300 text-emerald-800";
            semaforoIcon = "🟢";
            semaforoTexto = `OK — proyección (${proyeccion.toLocaleString("es-ES")}) ≥ pedido (${cantidad.toLocaleString("es-ES")})`;
          } else if (proyeccion >= cantidad * (1 - MARGEN_DEFICIT_PCT)) {
            semaforoColor = "bg-amber-50 border-amber-300 text-amber-800";
            semaforoIcon = "🟡";
            semaforoTexto = `AJUSTADO — proyección (${proyeccion.toLocaleString("es-ES")}) dentro del ±5% del pedido (${cantidad.toLocaleString("es-ES")})`;
          } else {
            semaforoColor = "bg-red-50 border-red-300 text-red-800";
            semaforoIcon = "🔴";
            semaforoTexto = `DÉFICIT — proyección (${proyeccion.toLocaleString("es-ES")}) por debajo del pedido (${cantidad.toLocaleString("es-ES")})`;
          }
        }

        return (
          <div className={cn("mt-3 rounded-lg border px-3 py-2 text-[11px]", semaforoColor || "bg-slate-50 border-slate-200 text-slate-700")}>
            <p className="font-semibold text-[10px] uppercase tracking-wide opacity-70 mb-1">
              {semaforoTitulo}
            </p>
            <p className="font-mono font-bold text-sm">
              {semaforoIcon} {salidaRaw.toLocaleString("es-ES")} {outputUnit}
            </p>
            <p className="mt-0.5 opacity-80">{proyeccionLabel}</p>
            {semaforoTexto ? <p className="mt-1 font-semibold">{semaforoTexto}</p> : null}
          </div>
        );
      })() : null}

      {hasCamposConfig && row.procesoId != null ? (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/40">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100/60"
            onClick={() => setDatosProcesoOpen((o) => !o)}
          >
            <span>Datos del proceso</span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                datosProcesoOpen && "rotate-180",
              )}
            />
          </button>
          {datosProcesoOpen ? (
            <div className="border-t border-indigo-200 px-3 py-3">
              <DatosProcesoForm
                procesoId={row.procesoId}
                material={despacho?.material}
                datosInicial={datosProcesoLocal}
                onChange={setDatosProcesoLocal}
                readonly={!canEdit}
                excludeFieldIds={
                  row.procesoId === PROCESO_CTP_ID
                    ? CTP_REQUISITO_DEFS.map((d) => d.hechoKey)
                    : undefined
                }
                dynamicOptions={cajasDynamicOptions}
                computeDerived={(datos, changedFieldId) => {
                  let base = datos;
                  // Al elegir caja, proponemos su bultos/palet por defecto.
                  if (
                    changedFieldId === "codigo_caja_embalaje" &&
                    (row.procesoId === PROCESO_ENGOMADO ||
                      row.procesoId === PROCESO_MANIPULADOS)
                  ) {
                    const def = cajasDefaultByCodigo.get(
                      String(datos.codigo_caja_embalaje ?? ""),
                    );
                    if (def != null) base = { ...datos, bultos_por_palet: def };
                  }
                  return computeDerivedDatosProceso(
                    row.procesoId,
                    base,
                    changedFieldId === "codigo_caja_embalaje"
                      ? "bultos_por_palet"
                      : changedFieldId,
                  );
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {pausePickerOpen && row.estadoEjecucion === "en_curso" ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold text-amber-900">
              Selecciona motivo de pausa
            </Label>
            <button
              type="button"
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              onClick={() => {
                setPausePickerOpen(false);
                setSelectedMotivoId("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {motivosPausaDisponibles.map((motivo) => {
              const selected = selectedMotivoId === motivo.id;
              return (
                <button
                  key={motivo.id}
                  type="button"
                  disabled={saving}
                  onClick={() => setSelectedMotivoId(motivo.id)}
                  className={cn(
                    "min-h-14 rounded-lg border px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white shadow-xs transition-transform",
                    "hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]",
                    selected ? "border-[#002147] ring-2 ring-[#002147]" : "border-white/50",
                  )}
                  style={{ backgroundColor: motivo.colorHex }}
                  title={`${motivo.label} · ${motivo.categoria}`}
                >
                  <span className="block leading-tight">{motivo.label}</span>
                  <span className="mt-1 block text-[9px] font-semibold opacity-80">
                    {motivo.categoria}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-2 w-full bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving || !selectedMotivoId}
            onClick={() => {
              const motivo = motivosPausaDisponibles.find((m) => m.id === selectedMotivoId) ?? null;
              onPause(motivo, buildCommonFieldsPatch(), datosProcesoPatch);
              setPausePickerOpen(false);
              setSelectedMotivoId("");
            }}
          >
            Confirmar pausa
          </Button>
        </div>
      ) : null}

      {row.estadoEjecucion === "pausada" ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Pausada {row.pausaActivaDesde ? `desde ${format(new Date(row.pausaActivaDesde), "dd/MM/yyyy HH:mm", { locale: es })}` : ""}.
          {row.motivoPausaActiva ? (
            <>
              {" Motivo: "}
              <span
                className="inline-flex rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: row.motivoPausaColorHexActiva ?? "#64748B" }}
              >
                {row.motivoPausaActiva}
              </span>
              .
            </>
          ) : ""}
          {row.minutosPausadaAcum > 0 ? ` Acumulado: ${row.minutosPausadaAcum} min.` : ""}
        </p>
      ) : null}
      {row.haEstadoPausada && pauses.length > 0 ? (
        <details className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
          <summary className="cursor-pointer font-medium">
            Historial pausas ({row.numPausas})
          </summary>
          <div className="mt-1 space-y-1">
            {pauses.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded border border-slate-200 bg-white px-2 py-1">
                <div>
                  {format(new Date(p.pausedAt), "dd/MM HH:mm", { locale: es })}
                  {" → "}
                  {p.resumedAt
                    ? format(new Date(p.resumedAt), "dd/MM HH:mm", { locale: es })
                    : "abierta"}
                  {typeof p.minutosPausa === "number" && p.minutosPausa >= 0
                    ? ` · ${p.minutosPausa} min`
                    : ""}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-slate-600">
                  <span
                    className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: p.motivoColorHex }}
                  >
                    {p.motivoLabel}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500">
                    {p.motivoCategoria}
                  </span>
                  {p.observacionesPausa ? (
                    <span className="text-slate-500">· {p.observacionesPausa}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {row.procesoId === PROCESO_CTP_ID ? (
          <p className="text-xs text-slate-600">
            Plan: {row.horasPlanificadasSnapshot ?? "—"}h · Real:{" "}
            {parseNum(datosProcesoLocal.horas_proceso) ?? row.horasReales ?? "—"}h
          </p>
        ) : (
          <p className="text-xs text-slate-600">
            Plan: {row.horasPlanificadasSnapshot ?? "—"}h · Real: {row.horasReales ?? "—"}h
            {desviacion != null ? (
              <span className={cn("ml-2 font-semibold", desviacion > 0 ? "text-red-700" : "text-emerald-700")}>
                Desv. {desviacion >= 0 ? "+" : ""}{desviacion.toFixed(1)}h
              </span>
            ) : null}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {needsTroquelClaim && isPendingStart ? (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
              <span className="font-semibold">Claim</span>
              <select
                className="h-8 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs"
                value={claimMaquinaId}
                onChange={(e) => setClaimMaquinaId(e.target.value)}
                disabled={saving || maquinasTroquel.length === 0}
              >
                {maquinasTroquel.length === 0 ? (
                  <option value="">Sin máquinas troquel</option>
                ) : (
                  maquinasTroquel.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => onPatch(buildCommonFieldsPatch(), datosProcesoPatch)}
            >
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Guardar
            </Button>
          ) : null}
          {row.estadoEjecucion === "en_curso" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setPausePickerOpen(true);
              }}
            >
              <Pause className="mr-1 size-4" /> Pausar
            </Button>
          ) : null}
          {isPendingStart ? (
            <Button
              type="button"
              size="sm"
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={saving || (needsTroquelClaim && !claimMaquinaId)}
              onClick={() => {
                const patch = buildCommonFieldsPatch();
                if (needsTroquelClaim && claimMaquinaId) {
                  patch.maquina_id = claimMaquinaId;
                }
                onBegin(patch, datosProcesoPatch);
              }}
            >
              <Play className="mr-1 size-4" /> Iniciar
            </Button>
          ) : null}
          {isPendingStart &&
          (row.procesoId === PROCESO_OFFSET_ID || row.procesoId === PROCESO_DIGITAL_ID) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-950 hover:bg-amber-50"
              disabled={saving}
              onClick={onImprimirFuera}
            >
              <Truck className="mr-1 size-4" /> Imprimir fuera
            </Button>
          ) : null}
          {isPendingStart && !isContenedorVirtual ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={saving}
              onClick={onDevolverAlPool}
            >
              <Undo2 className="mr-1 size-4" /> Devolver al Pool
            </Button>
          ) : null}
          {row.estadoEjecucion === "pausada" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                onResume(pauses, buildCommonFieldsPatch(), datosProcesoPatch);
                setPausePickerOpen(false);
                setSelectedMotivoId("");
              }}
            >
              <Play className="mr-1 size-4" /> Reanudar
            </Button>
          ) : null}
          {canEdit && !isPendingStart ? (
            <Button
              type="button"
              size="sm"
              className="bg-[#002147] text-white hover:bg-[#001735]"
              disabled={saving}
              onClick={openCerrarProceso}
            >
              <CheckCircle2 className="mr-1 size-4" /> Cerrar proceso
            </Button>
          ) : null}
        </div>
      </div>

      <CerrarProcesoDialog
        open={cerrarProcesoOpen}
        onOpenChange={setCerrarProcesoOpen}
        otNumero={row.ot}
        procesoNombre={
          row.procesoId != null
            ? (getCamposConfigByProcesoId(row.procesoId)?.procesoNombre ?? null)
            : null
        }
        procesoId={row.procesoId}
        pasosItinerario={pasosItinerario}
        horasMesa={horasMesaSnapshot}
        minutosPausa={row.minutosPausadaAcum}
        datosDraft={cerrarDatosDraft}
        onDatosChange={setCerrarDatosDraft}
        onUsarTiempoMesa={() => {
          if (horasMesaSnapshot == null || horasMesaSnapshot <= 0) return;
          setCerrarDatosDraft(
            applyHorasMesaToDatosProceso(
              row.procesoId,
              cerrarDatosDraft,
              horasMesaSnapshot,
            ),
          );
        }}
        onConfirm={confirmCerrarProceso}
        saving={saving}
      />
    </div>
  );
}
