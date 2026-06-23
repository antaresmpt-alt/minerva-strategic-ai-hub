import type { HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";

const PROCESOS_IMPRESION = new Set([1, 2]);
const PROCESO_TROQUELADO = 10;
const PROCESO_ENGOMADO = 12;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumNullable(...vals: (number | null)[]): number {
  return vals.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

export type HorasResumenOt = {
  previsto: number | null;
  real: number | null;
  desviacion: number | null;
  pasosConReal: number;
  pasosConPrevisto: number;
};

function horasFromEjecucion(paso: HojaRutaPaso): number | null {
  const ej = paso.ejecucion;
  if (!ej) return null;
  if (ej.horasReales != null && ej.horasReales > 0) return ej.horasReales;
  if (ej.inicioRealAt && ej.finRealAt) {
    const ini = new Date(ej.inicioRealAt).getTime();
    const fin = new Date(ej.finRealAt).getTime();
    if (Number.isFinite(ini) && Number.isFinite(fin) && fin > ini) {
      return (fin - ini) / 3_600_000;
    }
  }
  return null;
}

/** Horas previstas de un paso según `datos_proceso`. */
export function extractHorasPrevistoPaso(paso: HojaRutaPaso): number | null {
  const pid = paso.procesoId;
  const dp = paso.datosProceso ?? {};
  if (!pid) {
    const fallback = num(dp.horas_proceso) ?? num(dp.tiempo_total) ?? num(dp.tiempo_previsto);
    return fallback != null && fallback > 0 ? fallback : null;
  }
  if (PROCESOS_IMPRESION.has(pid)) {
    const total = sumNullable(num(dp.horas_entrada_previsto), num(dp.horas_impresion_previsto));
    return total > 0 ? total : null;
  }
  if (pid === PROCESO_TROQUELADO) {
    const total = sumNullable(
      num(dp.horas_preparacion_previsto),
      num(dp.horas_tiraje_previsto),
    );
    return total > 0 ? total : null;
  }
  if (pid === PROCESO_ENGOMADO) {
    const t = num(dp.tiempo_previsto);
    return t != null && t > 0 ? t : null;
  }
  const generic =
    num(dp.horas_proceso) ?? num(dp.tiempo_total) ?? num(dp.tiempo_previsto);
  return generic != null && generic > 0 ? generic : null;
}

/** Horas reales de un paso: prioriza `datos_proceso`, fallback a ejecución. */
export function extractHorasRealPaso(paso: HojaRutaPaso): number | null {
  const pid = paso.procesoId;
  const dp = paso.datosProceso ?? {};
  if (!pid) {
    return (
      num(dp.horas_proceso) ??
      num(dp.tiempo_real) ??
      horasFromEjecucion(paso)
    );
  }
  if (PROCESOS_IMPRESION.has(pid)) {
    const total = sumNullable(num(dp.horas_entrada_real), num(dp.horas_impresion_real));
    if (total > 0) return total;
    return horasFromEjecucion(paso);
  }
  if (pid === PROCESO_TROQUELADO) {
    const total = sumNullable(
      num(dp.horas_preparacion_real),
      num(dp.horas_tiraje_real),
    );
    if (total > 0) return total;
    return horasFromEjecucion(paso);
  }
  if (pid === PROCESO_ENGOMADO) {
    const t = num(dp.tiempo_real);
    if (t != null && t > 0) return t;
    return horasFromEjecucion(paso);
  }
  const generic = num(dp.horas_proceso) ?? num(dp.tiempo_real);
  if (generic != null && generic > 0) return generic;
  return horasFromEjecucion(paso);
}

/** Suma horas previstas/reales de todos los pasos del itinerario. */
export function computeHorasResumenOt(pasos: HojaRutaPaso[]): HorasResumenOt {
  let previsto = 0;
  let real = 0;
  let pasosConReal = 0;
  let pasosConPrevisto = 0;

  for (const paso of pasos) {
    const pv = extractHorasPrevistoPaso(paso);
    if (pv != null && pv > 0) {
      previsto += pv;
      pasosConPrevisto += 1;
    }
    const rl = extractHorasRealPaso(paso);
    if (rl != null && rl > 0) {
      real += rl;
      pasosConReal += 1;
    }
  }

  return {
    previsto: pasosConPrevisto > 0 ? previsto : null,
    real: pasosConReal > 0 ? real : null,
    desviacion:
      pasosConPrevisto > 0 && pasosConReal > 0 ? real - previsto : null,
    pasosConReal,
    pasosConPrevisto,
  };
}

export function formatHorasCantidad(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "—";
  if (h >= 1) return `${h.toFixed(1)} h`;
  return `${Math.round(h * 60)} min`;
}

/** Línea legible: «Prev. X · Real Y · Desv. ±Z». */
export function formatHorasResumenLine(resumen: HorasResumenOt): string | null {
  if (resumen.previsto == null && resumen.real == null) return null;
  const parts: string[] = [];
  if (resumen.previsto != null) {
    parts.push(`Prev. ${formatHorasCantidad(resumen.previsto)}`);
  }
  if (resumen.real != null) {
    parts.push(`Real ${formatHorasCantidad(resumen.real)}`);
  }
  if (resumen.desviacion != null) {
    const sign = resumen.desviacion >= 0 ? "+" : "−";
    parts.push(`Desv. ${sign}${formatHorasCantidad(Math.abs(resumen.desviacion))}`);
  }
  return parts.join(" · ");
}
