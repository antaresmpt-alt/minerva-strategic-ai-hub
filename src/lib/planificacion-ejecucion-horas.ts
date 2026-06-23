import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import {
  PROCESO_CTP_ID,
  PROCESO_DESBROCE_ID,
} from "@/lib/hoja-ruta-campos-config";

const PROCESOS_IMPRESION = new Set([1, 2]);
const PROCESO_TROQUELADO = 10;
const PROCESO_ENGOMADO = 12;

export type MesaPausaClockInput = {
  pausedAt: string | null;
  resumedAt: string | null;
  minutosPausa: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function roundHorasEjecucion(h: number): number {
  return Math.round(h * 100) / 100;
}

/**
 * Tiempo neto en mesa: (fin − inicio) − pausas acumuladas − pausa abierta.
 * Referencia auditable; no editable por el operario.
 */
export function computeHorasMesaNetas(args: {
  inicioRealAt: string | null;
  finRealAt?: string | null;
  minutosPausadaAcum: number;
  pauses?: MesaPausaClockInput[];
  now?: Date;
}): number | null {
  const iniMs = args.inicioRealAt ? new Date(args.inicioRealAt).getTime() : NaN;
  if (!Number.isFinite(iniMs)) return null;

  const finMs = args.finRealAt
    ? new Date(args.finRealAt).getTime()
    : (args.now ?? new Date()).getTime();
  if (!Number.isFinite(finMs) || finMs <= iniMs) return null;

  let pauseMin = Math.max(0, args.minutosPausadaAcum);
  for (const p of args.pauses ?? []) {
    if (p.resumedAt != null || !p.pausedAt) continue;
    const pausedMs = new Date(p.pausedAt).getTime();
    if (Number.isFinite(pausedMs)) {
      pauseMin += Math.max(0, Math.round((finMs - pausedMs) / 60000));
    }
  }

  const netMs = Math.max(0, finMs - iniMs - pauseMin * 60_000);
  return roundHorasEjecucion(netMs / 3_600_000);
}

export type CerrarProcesoHourField = {
  id: string;
  label: string;
};

export function getCerrarProcesoHourFields(
  procesoId: number | null | undefined,
): CerrarProcesoHourField[] {
  if (!procesoId) return [{ id: "horas_proceso", label: "Horas reales" }];
  if (procesoId === PROCESO_CTP_ID || procesoId === PROCESO_DESBROCE_ID) {
    return [{ id: "horas_proceso", label: "Horas proceso (real)" }];
  }
  if (PROCESOS_IMPRESION.has(procesoId)) {
    return [
      { id: "horas_entrada_real", label: "Horas entrada (real)" },
      { id: "horas_impresion_real", label: "Horas impresión (real)" },
    ];
  }
  if (procesoId === PROCESO_TROQUELADO) {
    return [
      { id: "horas_preparacion_real", label: "Horas preparación (real)" },
      { id: "horas_tiraje_real", label: "Horas tiraje (real)" },
    ];
  }
  if (procesoId === PROCESO_ENGOMADO) {
    return [{ id: "tiempo_real", label: "Tiempo real" }];
  }
  return [{ id: "horas_proceso", label: "Horas proceso (real)" }];
}

function splitHorasMesa(
  total: number,
  partA: number | null,
  partB: number | null,
  defaultRatioA: number,
): [number, number] {
  const h = roundHorasEjecucion(total);
  if (partA != null && partB != null && partA + partB > 0) {
    const ratio = partA / (partA + partB);
    return [roundHorasEjecucion(h * ratio), roundHorasEjecucion(h * (1 - ratio))];
  }
  return [roundHorasEjecucion(h * defaultRatioA), roundHorasEjecucion(h * (1 - defaultRatioA))];
}

/** Precarga campos reales declarados desde el tiempo mesa (editable después). */
export function applyHorasMesaToDatosProceso(
  procesoId: number | null | undefined,
  datos: DatosProcesoGenerico,
  horasMesa: number,
): DatosProcesoGenerico {
  if (horasMesa <= 0) return { ...datos };
  const next: DatosProcesoGenerico = { ...datos };

  if (!procesoId || procesoId === PROCESO_CTP_ID || procesoId === PROCESO_DESBROCE_ID) {
    next.horas_proceso = roundHorasEjecucion(horasMesa);
    return next;
  }
  if (PROCESOS_IMPRESION.has(procesoId)) {
    const [ent, imp] = splitHorasMesa(
      horasMesa,
      num(datos.horas_entrada_real),
      num(datos.horas_impresion_real),
      0.25,
    );
    next.horas_entrada_real = ent;
    next.horas_impresion_real = imp;
    return next;
  }
  if (procesoId === PROCESO_TROQUELADO) {
    const [prep, tir] = splitHorasMesa(
      horasMesa,
      num(datos.horas_preparacion_real),
      num(datos.horas_tiraje_real),
      0.3,
    );
    next.horas_preparacion_real = prep;
    next.horas_tiraje_real = tir;
    return next;
  }
  if (procesoId === PROCESO_ENGOMADO) {
    next.tiempo_real = roundHorasEjecucion(horasMesa);
    return next;
  }
  next.horas_proceso = roundHorasEjecucion(horasMesa);
  return next;
}

/** Suma las horas reales declaradas en datos_proceso (para validación en cierre). */
export function sumHorasDeclaradasDatosProceso(
  procesoId: number | null | undefined,
  datos: DatosProcesoGenerico,
): number | null {
  if (!procesoId) return num(datos.horas_proceso);
  if (procesoId === PROCESO_CTP_ID || procesoId === PROCESO_DESBROCE_ID) {
    return num(datos.horas_proceso);
  }
  if (PROCESOS_IMPRESION.has(procesoId)) {
    const t = (num(datos.horas_entrada_real) ?? 0) + (num(datos.horas_impresion_real) ?? 0);
    return t > 0 ? roundHorasEjecucion(t) : null;
  }
  if (procesoId === PROCESO_TROQUELADO) {
    const t =
      (num(datos.horas_preparacion_real) ?? 0) + (num(datos.horas_tiraje_real) ?? 0);
    return t > 0 ? roundHorasEjecucion(t) : null;
  }
  if (procesoId === PROCESO_ENGOMADO) {
    return num(datos.tiempo_real);
  }
  return num(datos.horas_proceso);
}

/** Sincroniza `prod_mesa_ejecuciones.horas_reales*` desde datos_proceso al guardar/cerrar. */
export function buildEjecucionHorasSyncPatch(
  procesoId: number | null | undefined,
  datos: DatosProcesoGenerico,
): Record<string, unknown> {
  const sync: Record<string, unknown> = {};
  if (!procesoId) return sync;

  if (procesoId === 1 || procesoId === 2) {
    const horasImpReal = num(datos.horas_impresion_real);
    if (horasImpReal != null) sync.horas_reales = horasImpReal;
    const horasEntReal = num(datos.horas_entrada_real);
    if (horasEntReal != null) sync.horas_reales_entrada = horasEntReal;
    if (horasImpReal != null) sync.horas_reales_tiraje = horasImpReal;
    const hojasImp = num(datos.hojas_impresas);
    if (hojasImp != null) sync.num_hojas_producidas = hojasImp;
    return sync;
  }
  if (procesoId === PROCESO_TROQUELADO) {
    const hPrep = num(datos.horas_preparacion_real);
    const hTir = num(datos.horas_tiraje_real);
    const totalTroq = (hPrep ?? 0) + (hTir ?? 0);
    if (totalTroq > 0) sync.horas_reales_troquelado = roundHorasEjecucion(totalTroq);
    const hojasTroq = num(datos.hojas_troqueladas);
    if (hojasTroq != null) sync.num_hojas_producidas = hojasTroq;
    return sync;
  }
  if (procesoId === PROCESO_ENGOMADO) {
    const tReal = num(datos.tiempo_real);
    if (tReal != null) sync.horas_reales_engomado = tReal;
    const estEng = num(datos.estuches_engomados);
    if (estEng != null) sync.cantidad_unidades = estEng;
    return sync;
  }
  if (procesoId === PROCESO_CTP_ID || procesoId === PROCESO_DESBROCE_ID) {
    const h = num(datos.horas_proceso);
    if (h != null && h > 0) sync.horas_reales = h;
    return sync;
  }
  const generic = num(datos.horas_proceso) ?? num(datos.tiempo_real);
  if (generic != null && generic > 0) sync.horas_reales = generic;
  return sync;
}

export function formatHorasEjecucionLabel(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h) || h <= 0) return "—";
  if (h >= 1) return `${h.toFixed(2)} h`;
  return `${Math.round(h * 60)} min`;
}
