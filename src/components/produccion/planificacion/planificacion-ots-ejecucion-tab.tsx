"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Map as MapIcon,
  Pause,
  Play,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CerrarProcesoDialog } from "@/components/produccion/planificacion/cerrar-proceso-dialog";
import { CtpEjecucionRequisitosBlock } from "@/components/produccion/planificacion/ctp-ejecucion-requisitos-block";
import { aplicarConsumoCartelaSiCorresponde, validarCartelaConsumoAntesCerrar } from "@/lib/cartela-stock-consumo";
import { procesoUsaCartela, type PasoItinerarioConsumo } from "@/lib/cartela-ejecucion";
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
import { useSysParametrosSobreproduccion } from "@/hooks/use-sys-parametros-sobreproduccion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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

type CajaEmbalajeOption = {
  codigo: string;
  descripcion: string | null;
  bultos_por_palet_default: number | null;
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
    const hojas = toFiniteNum(datos.hojas_entrada);
    const poses = toFiniteNum(datos.poses);
    if (hojas != null && poses != null && poses > 0) {
      return { ...datos, estuches_desbrozados: Math.max(0, Math.floor(hojas * poses)) };
    }
  }

  if (procesoId === 15) {
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

function estadoLabel(e: EstadoEjecucionMesa): string {
  if (e === "pendiente_inicio") return "Pendiente inicio";
  if (e === "en_curso") return "En curso";
  if (e === "pausada") return "Pausada";
  if (e === "finalizada") return "Finalizada";
  return "Cancelada";
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
  const [selectedMaquina, setSelectedMaquina] = useState<string>("all");
  const [estado, setEstado] = useState<"activas" | EstadoEjecucionMesa | "all">("activas");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [planificacionRole, setPlanificacionRole] = useState<string | null>(null);
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
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        roleRead =
          prof && typeof (prof as { role?: unknown }).role === "string"
            ? String((prof as { role: string }).role).trim() || null
            : null;
      }
      setPlanificacionRole(roleRead);
      const tipoFiltro = getPlanificacionTipoMaquinaFilter(roleRead);

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

      const [execRes, maqRes, motivosRes, cajasRes, engomadoRes] = await Promise.all([
        supabase
          .from(TABLE_EJECUCIONES)
          .select("*, prod_maquinas(nombre,tipo_maquina), prod_ot_pasos(ot_id,orden,proceso_id,datos_proceso)")
          .order("updated_at", { ascending: false }),
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
      if (execRes.error) throw execRes.error;
      if (maqRes.error) throw maqRes.error;
      if (motivosRes.error) throw motivosRes.error;
      const motivos = ((motivosRes.data ?? []) as MotivoPausaRow[]).map(mapMotivoRow);
      const cajas = (cajasRes.error ? [] : (cajasRes.data ?? [])) as CajaEmbalajeOption[];
      const tiposEngomado = (
        engomadoRes.error ? [] : (engomadoRes.data ?? [])
      ).map((r) => String((r as { label?: string | null }).label ?? "").trim())
        .filter(Boolean);
      const maqRowsRaw = (maqRes.data ?? []) as Array<{
        id: string;
        nombre: string;
        tipo_maquina: string | null;
      }>;
      const tiposPlan = new Set<string>(PLANIFICACION_TIPOS_MAQUINA);
      const maqRows = maqRowsRaw.filter((m) =>
        tiposPlan.has(String(m.tipo_maquina ?? "").trim()),
      );
      const allowedMaquinaIds = new Set(maqRows.map((m) => m.id));
      const execRows = ((execRes.data ?? []) as unknown as EjecucionRow[]).filter(
        (r) => allowedMaquinaIds.has(String(r.maquina_id ?? "").trim()),
      );
      const executionIds = execRows.map((r) => r.id);
      const pauseMap = new Map<string, MesaEjecucionPausa[]>();
      if (executionIds.length > 0) {
        const { data: pauseData, error: pauseErr } = await supabase
          .from(TABLE_EJECUCIONES_PAUSAS)
          .select("id, ejecucion_id, paused_at, resumed_at, motivo_id, observaciones_pausa, minutos_pausa, created_at, sys_motivos_pausa(slug,label,categoria,color_hex)")
          .in("ejecucion_id", executionIds)
          .order("paused_at", { ascending: false });
        if (pauseErr) throw pauseErr;
        for (const p of (pauseData ?? []) as unknown as PausaRow[]) {
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
        const { data: despData } = await supabase
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
            horas_estimadas_engomado,
            tipo_engomado
          `)
          .in("ot_numero", otNumeros);
        const { data: generalData } = await supabase
          .from(TABLE_OTS_GENERAL)
          .select("num_pedido, cliente, cantidad, titulo, fecha_entrega, ot_tipo, ot_padre_numero, tipo_hija, forma_descripcion")
          .in("num_pedido", otNumeros);
        const { data: materialesData } = await supabase
          .from(TABLE_DESPACHO_MATERIALES_LINEAS)
          .select("ot_numero, tipo, descripcion, orden, soporte_impresion")
          .in("ot_numero", otNumeros)
          .order("ot_numero", { ascending: true })
          .order("orden", { ascending: true });
        const generalMap = new Map<string, { cliente: string | null; cantidad: number | null; titulo: string | null; fechaEntrega: string | null }>();
        for (const g of (generalData ?? []) as Array<{ 
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
        for (const m of (materialesData ?? []) as Array<{
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
            ((despData ?? []) as Array<{ troquel?: string | null }>)
              .map((d) => String(d.troquel ?? "").trim())
              .filter(Boolean),
          ),
        ];
        const troquelMap = new Map<string, ReturnType<typeof mapTroquelRow>>();
        if (troquelNums.length > 0) {
          const { data: troqData, error: troqErr } = await supabase
            .from(TABLE_TROQUELES)
            .select("num_troquel,mides,num_figuras,figuras_hoja,pinza,expulsion,num_expulsion,caucho_acrilico")
            .in("num_troquel", troquelNums);
          if (troqErr) throw troqErr;
          for (const t of (troqData ?? []) as TroquelInfoRow[]) {
            const key = normalizeTroquelKey(t.num_troquel);
            if (key) troquelMap.set(key, mapTroquelRow(t));
          }
        }
        for (const d of (despData ?? []) as Array<{
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
          const { data: padreDespData } = await supabase
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
              horas_estimadas_engomado,
              tipo_engomado
            `)
            .in("ot_numero", padresNeeded);
          const { data: padreGeneralData } = await supabase
            .from(TABLE_OTS_GENERAL)
            .select("num_pedido, cliente, titulo, fecha_entrega")
            .in("num_pedido", padresNeeded);
          const { data: padreMaterialesData } = await supabase
            .from(TABLE_DESPACHO_MATERIALES_LINEAS)
            .select("ot_numero, tipo, descripcion, orden, soporte_impresion")
            .in("ot_numero", padresNeeded)
            .order("ot_numero", { ascending: true })
            .order("orden", { ascending: true });

          const padreGeneralMap = new Map<string, { cliente: string | null; titulo: string | null; fechaEntrega: string | null }>();
          for (const pg of (padreGeneralData ?? []) as Array<{
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
          for (const pm of (padreMaterialesData ?? []) as Array<{
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
              ((padreDespData ?? []) as Array<{ troquel?: string | null }>)
                .map((d) => String(d.troquel ?? "").trim())
                .filter(Boolean),
            ),
          ];
          const padreTroquelMap = new Map<string, ReturnType<typeof mapTroquelRow>>();
          if (padreTroquelNums.length > 0) {
            const { data: troqData } = await supabase
              .from(TABLE_TROQUELES)
              .select("num_troquel,mides,num_figuras,figuras_hoja,pinza,expulsion,num_expulsion,caucho_acrilico")
              .in("num_troquel", padreTroquelNums);
            for (const t of (troqData ?? []) as TroquelInfoRow[]) {
              const key = normalizeTroquelKey(t.num_troquel);
              if (key) padreTroquelMap.set(key, mapTroquelRow(t));
            }
          }

          const padreDespachoMap: Record<string, DespachoInfo> = {};
          for (const pd of (padreDespData ?? []) as Array<{
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
          const { data: compData } = await supabase
            .from(TABLE_HIJA_COMPONENTES)
            .select("ot_hija_numero, referencia_codigo, referencia_descripcion, poses_en_forma, cantidad_objetivo, orden")
            .in("ot_hija_numero", hijasForma)
            .order("ot_hija_numero", { ascending: true })
            .order("orden", { ascending: true });
          for (const c of (compData ?? []) as Array<{
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
        const { data: pasosItinerarioData, error: pasosItinerarioErr } = await supabase
          .from(TABLE_OT_PASOS)
          .select("id, ot_id, proceso_id, estado, datos_proceso, orden")
          .in("ot_id", otIds)
          .order("ot_id")
          .order("orden", { ascending: true });
        if (pasosItinerarioErr) throw pasosItinerarioErr;

        for (const p of (pasosItinerarioData ?? []) as Array<{
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

        // Para cada ejecución activa, buscamos el último paso completado de la misma OT
        // cuyo proceso_id sea compatible como entrada (inputFromProcessIds del proceso actual)
        const { data: pasosData, error: pasosErr } = await supabase
          .from(TABLE_OT_PASOS)
          .select("ot_id, proceso_id, estado, datos_proceso, orden")
          .in("ot_id", otIds)
          .eq("estado", "finalizado")
          .order("ot_id")
          .order("orden", { ascending: false });
        if (pasosErr) throw pasosErr;

        const pasosPorOtId = new Map<string, Array<{ proceso_id: number | null; datos_proceso: Record<string, unknown> | null; orden: number | null }>>();
        for (const p of (pasosData ?? []) as Array<{ ot_id: string; proceso_id: number | null; estado: string; datos_proceso: Record<string, unknown> | null; orden: number | null }>) {
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
          const procesoConfig = PROCESO_CAMPOS_CONFIG[pid];
          const inputIds = procesoConfig?.inputFromProcessIds;
          if (!inputIds || inputIds.length === 0) continue;

          const pasosOt = pasosPorOtId.get(otId) ?? [];
          // Busca el paso finalizado más reciente cuyo proceso sea compatible
          for (const candidatePid of inputIds) {
            const paso = pasosOt.find((p) => p.proceso_id === candidatePid);
            if (!paso?.datos_proceso) continue;
            const candidateConfig = PROCESO_CAMPOS_CONFIG[candidatePid];
            if (!candidateConfig?.outputField) continue;
            const rawVal = paso.datos_proceso[candidateConfig.outputField];
            const val = typeof rawVal === "number" ? rawVal : (typeof rawVal === "string" ? Number(rawVal) : null);
            if (val == null || !Number.isFinite(val)) continue;
            salidaAnteriorByPasoKey.set(key, {
              procesoAnteriorId: candidatePid,
              salida: val,
              nombre: candidateConfig.procesoNombre,
            });
            break;
          }
        }
      }

      setPausesByExecutionId(
        Object.fromEntries(Array.from(pauseMap.entries()).map(([k, v]) => [k, v] as const)),
      );
      setDespachoByOt(despachoMap);
      setOtMetaByOt(otMetaMap);
      setHijaComponentesByOt(hijaComponentesMap);
      setPasosItinerarioPorOtId(pasosItinerarioPorOtId);
      setRows(execRows.map((r) => mapRow(r, pauseMap, salidaAnteriorByPasoKey, formatoAnteriorByOtPasoId)));
      setMotivosPausa(motivos);
      setCajasEmbalaje(cajas);
      setTipoEngomadoOptions(tiposEngomado);
      setMaquinas(
        maqRows.map((m) => ({
          id: m.id,
          nombre: m.nombre,
        })),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar las OTs en ejecución.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedMaquina !== "all" && r.maquinaId !== selectedMaquina) return false;
      if (estado === "activas") {
        return (
          r.estadoEjecucion === "pendiente_inicio" ||
          r.estadoEjecucion === "en_curso" ||
          r.estadoEjecucion === "pausada"
        );
      }
      if (estado === "all") return true;
      return r.estadoEjecucion === estado;
    });
  }, [rows, selectedMaquina, estado]);

  const filteredSections = useMemo(() => {
    const pending = filtered.filter((r) => r.estadoEjecucion === "pendiente_inicio");
    const active = filtered.filter((r) => r.estadoEjecucion === "en_curso" || r.estadoEjecucion === "pausada");
    const finished = filtered.filter((r) => r.estadoEjecucion === "finalizada" || r.estadoEjecucion === "cancelada");
    const sections = [
      { key: "pending", title: "Pendientes de iniciar", rows: pending },
      { key: "active", title: "En curso / pausadas", rows: active },
      { key: "finished", title: "Finalizadas / canceladas", rows: finished },
    ];
    if (estado === "activas") return sections.filter((s) => s.key !== "finished" && s.rows.length > 0);
    return sections.filter((s) => s.rows.length > 0);
  }, [estado, filtered]);

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
            .update({ datos_proceso: datosProcesoUpdate })
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
        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...patch,
            inicio_real_at: nowIso,
            estado_ejecucion: "en_curso",
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (error) throw error;
        if (datosProcesoUpdate && row.otPasoId) {
          const { error: dpErr } = await supabase
            .from(TABLE_OT_PASOS)
            .update({ datos_proceso: datosProcesoUpdate })
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
            .update({ datos_proceso: datosProcesoUpdate })
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
            .update({ datos_proceso: datosProcesoUpdate })
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
    return estadoLabel(estado);
  }, [estado]);

  const handleExportExcel = useCallback(() => {
    try {
      exportEjecucionesExcel(filtered, {
        maquina: selectedMaquinaLabel,
        estado: estadoLabelFiltro,
      }, pausesByExecutionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar Excel.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro, pausesByExecutionId]);

  const handleExportPdf = useCallback(() => {
    try {
      exportEjecucionesPdf(filtered, {
        maquina: selectedMaquinaLabel,
        estado: estadoLabelFiltro,
      }, pausesByExecutionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar PDF.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro, pausesByExecutionId]);

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
              Cola de trabajos liberados a máquina y seguimiento del inicio real, pausas y cierre.
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
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2"
            value={selectedMaquina}
            onChange={(e) => setSelectedMaquina(e.target.value)}
          >
            <option value="all">Todas las máquinas</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
          >
            <option value="activas">Activas</option>
            <option value="pendiente_inicio">Pendientes de iniciar</option>
            <option value="en_curso">En curso</option>
            <option value="pausada">Pausadas</option>
            <option value="finalizada">Finalizadas</option>
            <option value="all">Todas</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando ejecuciones...
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
            No hay OTs en ejecución para los filtros actuales.
          </p>
        ) : null}

        <div className="space-y-4">
          {filteredSections.map((section) => (
            <section key={section.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.title} · {section.rows.length}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {section.rows.map((row) => {
                  const desviacion =
                    row.procesoId !== PROCESO_CTP_ID &&
                    row.horasReales != null &&
                    row.horasPlanificadasSnapshot != null
                      ? row.horasReales - row.horasPlanificadasSnapshot
                      : null;
                  return (
                    <ExecutionCard
                      key={`${row.id}-${row.updatedAt}`}
                      row={row}
                      despacho={despachoByOt[row.ot] ?? null}
                      otMeta={otMetaByOt[row.ot] ?? null}
                      hijaComponentes={hijaComponentesByOt[row.ot] ?? []}
                      pauses={pausesByExecutionId[row.id] ?? []}
                      motivosPausa={motivosPausa}
                      cajasEmbalaje={cajasEmbalaje}
                      tipoEngomadoOptions={tipoEngomadoOptions}
                      margenesSobreproduccion={margenesSobreproduccion}
                      desviacion={desviacion}
                      saving={savingId === row.id}
                      pasosItinerario={
                        row.otId
                          ? pasosItinerarioParaConsumo(pasosItinerarioPorOtId.get(row.otId) ?? [])
                          : []
                      }
                      onPatch={(patch, dp) => void patchExecution(row, patch, dp)}
                      onBegin={(patch, dp) => void beginExecution(row, patch, dp)}
                      onPause={(motivo, patch, dp) => void pauseExecution(row, motivo, patch, dp)}
                      onResume={(pauses, patch, dp) => void resumeExecution(row, pauses, patch, dp)}
                      onOpenHojaRuta={() => setHojaRutaOt(row.ot)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
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
  pasosItinerario,
  onPatch,
  onBegin,
  onPause,
  onResume,
  onOpenHojaRuta,
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
  pasosItinerario: PasoItinerarioConsumo[];
  onPatch: (patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => void;
  onBegin: (patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => void;
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
}) {
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
      if (pid === PROCESO_ENGOMADO && row.salidaProcesoAnterior != null) {
        const prevUnit =
          PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "";
        if (prevUnit === "estuches") {
          const est = Math.max(0, Math.trunc(row.salidaProcesoAnterior));
          if (est > 0) {
            seeded = {
              ...seeded,
              estuches_realizar: est,
              estuches_engomados: est,
              cantidad_total: est,
            };
          }
        }
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
      if (despacho.troquel) base.troquel = despacho.troquel;
      if (despacho.poses != null) base.poses = despacho.poses;
      if (despacho.tamanoCorte) base.tamano_corte = despacho.tamanoCorte;
      const hojasDesdeAnterior =
        row.salidaProcesoAnterior != null && Number.isFinite(row.salidaProcesoAnterior)
          ? Math.max(0, Math.trunc(row.salidaProcesoAnterior))
          : null;
      if (hojasDesdeAnterior != null && hojasDesdeAnterior > 0) {
        base.hojas_troquelar = hojasDesdeAnterior;
      }
      if (despacho.pinza != null) base.pinza = despacho.pinza;
      if (despacho.expulsor) base.expulsor = despacho.expulsor;
      if (despacho.cauchoAcrilico) base.codigo_caucho = despacho.cauchoAcrilico;
      const hojasEntrada =
        row.salidaProcesoAnterior != null && Number.isFinite(row.salidaProcesoAnterior)
          ? Math.max(0, Math.trunc(row.salidaProcesoAnterior))
          : despacho.hojasBrutas != null
            ? Math.max(0, Math.trunc(despacho.hojasBrutas))
            : null;
      if (hojasEntrada != null && hojasEntrada > 0) {
        base.hojas_troquelar = hojasEntrada;
        base.hojas_troqueladas = hojasEntrada;
        base.hojas_merma = 0;
      }
      if (despacho.horasTroquelado != null) {
        base.horas_preparacion_previsto = Math.round(despacho.horasTroquelado * 0.3 * 10) / 10;
        base.horas_tiraje_previsto = Math.round(despacho.horasTroquelado * 0.7 * 10) / 10;
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
      if (despacho.horasEngomado != null) base.tiempo_previsto = despacho.horasEngomado;
      if (despacho.tipoEngomado) base.tipo_engomado = despacho.tipoEngomado;
    }
    if (pid === PROCESO_DESBROCE_ID) {
      if (hijaComponentes.length > 0) {
        const hojasNetas = hojasNetasFormaFromComponentes(hijaComponentes);
        if (hojasNetas != null) {
          base.hojas_entrada = hojasNetas;
        } else if (row.salidaProcesoAnterior != null) {
          base.hojas_entrada = row.salidaProcesoAnterior;
        }
        const primeraRef = hijaComponentes[0];
        if (primeraRef && primeraRef.poses_en_forma > 0) {
          base.poses = primeraRef.poses_en_forma;
        }
        const totalEstuches = totalEstuchesFormaComponentes(hijaComponentes);
        if (totalEstuches > 0) {
          base.estuches_desbrozados = totalEstuches;
        }
        base.componentes_forma = buildComponentesDesbroceSeed(hijaComponentes);
      } else {
        if (row.salidaProcesoAnterior != null) base.hojas_entrada = row.salidaProcesoAnterior;
        if (despacho.poses != null) base.poses = despacho.poses;
        const hojas = toFiniteNum(base.hojas_entrada);
        const poses = toFiniteNum(base.poses);
        if (hojas != null && poses != null && poses > 0) {
          base.estuches_desbrozados = Math.max(0, Math.floor(hojas * poses));
        }
      }
    }
    if (pid === 15) {
      if (row.salidaProcesoAnterior != null) {
        base.unidades = Math.max(0, Math.trunc(row.salidaProcesoAnterior));
      } else if (despacho.cantidad != null) {
        base.unidades = despacho.cantidad;
      }
    }
    return seedRealValuesFromPrevistos(
      pid,
      aplicarPrefillFormatoEncadenado(pid, base, row.formatoAnterior),
    );
  });

  const hasCamposConfig = useMemo(
    () => row.procesoId != null && getCamposConfigByProcesoId(row.procesoId) != null,
    [row.procesoId],
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
              row.estadoEjecucion === "pendiente_inicio" && "bg-sky-100 text-sky-800",
              row.estadoEjecucion === "en_curso" && "bg-emerald-100 text-emerald-800",
              row.estadoEjecucion === "pausada" && "bg-amber-100 text-amber-800",
              row.estadoEjecucion === "finalizada" && "bg-slate-100 text-slate-700",
            )}
          >
            {estadoLabel(row.estadoEjecucion)}
          </span>
        </div>
      </div>

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

      {row.formatoAnterior ? (
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
        } else if (procesoId === 15) {
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
                    row.procesoId === PROCESO_ENGOMADO
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
        <div className="flex gap-1.5">
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
              disabled={saving}
              onClick={() => onBegin(buildCommonFieldsPatch(), datosProcesoPatch)}
            >
              <Play className="mr-1 size-4" /> Iniciar
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
