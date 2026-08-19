/**
 * Bloque 9.8.2 — Aviso formato papel vs troquel en ejecución (CTP, Guillotina, Impresión).
 */

import {
  PROCESO_CTP_ID,
  PROCESO_DIGITAL_ID,
  PROCESO_GUILLOTINA_ID,
  PROCESO_OFFSET_ID,
  parseProcesoDatosFromPasos,
} from "@/lib/despacho-wizard-shared";
import type { PasoItinerarioFormato } from "@/lib/hoja-ruta-formato-encadenado";
import {
  checkFormatoCabe,
  formatoCabeAvisoMsg,
  type FormatoCabeOrigen,
  type MargenesImpr,
} from "@/lib/formato-cabe";

export type { FormatoCabeOrigen };

export type FormatoPapelResuelto = {
  formato: string;
  origen: FormatoCabeOrigen;
};

export type FormatoCabeEjecucionInput = {
  procesoId: number;
  troquelCode: string | null | undefined;
  midesTroquel: string | null | undefined;
  tamanoHojaCompra: string | null | undefined;
  pasosOt: PasoItinerarioFormato[];
  formatoAnterior: string | null | undefined;
  formatoAnteriorOrigenProcesoId?: number | null;
  formatoAnteriorOrigenNombre?: string | null;
  datosProcesoActual: Record<string, unknown> | null | undefined;
  margenes: MargenesImpr;
};

const PROCESOS_CON_AVISO = new Set([
  PROCESO_CTP_ID,
  PROCESO_GUILLOTINA_ID,
  PROCESO_OFFSET_ID,
  PROCESO_DIGITAL_ID,
]);

function trimFmt(value: unknown): string | null {
  const t = String(value ?? "").trim();
  return t.length > 0 ? t : null;
}

function parsePlanDesdePasos(pasosOt: PasoItinerarioFormato[]) {
  return parseProcesoDatosFromPasos(
    pasosOt
      .filter((p) => p.procesoId != null)
      .map((p) => ({
        proceso_id: p.procesoId!,
        datos_proceso: p.datosProceso,
      })),
  );
}

function origenDesdeProcesoId(
  procesoId: number | null | undefined,
): FormatoCabeOrigen | null {
  if (procesoId === PROCESO_GUILLOTINA_ID) return "GUILLOTINA";
  if (procesoId === PROCESO_OFFSET_ID || procesoId === PROCESO_DIGITAL_ID) {
    return "IMPRESION";
  }
  return null;
}

function origenDesdeFormatoAnterior(
  procesoAnteriorId: number | null | undefined,
  origenNombre: string | null | undefined,
): FormatoCabeOrigen {
  const desdeProceso = origenDesdeProcesoId(procesoAnteriorId);
  if (desdeProceso) return desdeProceso;
  const nombre = String(origenNombre ?? "").trim().toLowerCase();
  if (nombre.includes("compra")) return "DESPACHO";
  return "DESPACHO";
}

/** Cadena despacho/wizard: guillotina plan → impresión plan → compra. */
export function resolveFormatoPapelDespacho(input: {
  guillotinaTamanoFinal?: string | null;
  impresionFormatoHojas?: string | null;
  tamanoHojaCompra?: string | null;
}): FormatoPapelResuelto | null {
  const guill = trimFmt(input.guillotinaTamanoFinal);
  if (guill) return { formato: guill, origen: "GUILLOTINA" };
  const imp = trimFmt(input.impresionFormatoHojas);
  if (imp) return { formato: imp, origen: "IMPRESION" };
  const compra = trimFmt(input.tamanoHojaCompra);
  if (compra) return { formato: compra, origen: "DESPACHO" };
  return null;
}

/** Resuelve el formato de papel relevante para el aviso según el paso en ejecución. */
export function resolveFormatoPapelEjecucion(
  input: Omit<FormatoCabeEjecucionInput, "troquelCode" | "midesTroquel" | "margenes">,
): FormatoPapelResuelto | null {
  const {
    procesoId,
    pasosOt,
    tamanoHojaCompra,
    formatoAnterior,
    formatoAnteriorOrigenProcesoId,
    formatoAnteriorOrigenNombre,
    datosProcesoActual,
  } = input;
  const plan = parsePlanDesdePasos(pasosOt);
  const compra = trimFmt(tamanoHojaCompra);

  if (procesoId === PROCESO_GUILLOTINA_ID) {
    const local = trimFmt(datosProcesoActual?.tamano_final);
    if (local) return { formato: local, origen: "GUILLOTINA" };
    const planGuill = trimFmt(plan.guillotina.tamano_final);
    if (planGuill) return { formato: planGuill, origen: "GUILLOTINA" };
    if (compra) return { formato: compra, origen: "DESPACHO" };
    return null;
  }

  if (procesoId === PROCESO_OFFSET_ID || procesoId === PROCESO_DIGITAL_ID) {
    const ant = trimFmt(formatoAnterior);
    if (ant) {
      return {
        formato: ant,
        origen: origenDesdeFormatoAnterior(
          formatoAnteriorOrigenProcesoId,
          formatoAnteriorOrigenNombre,
        ),
      };
    }
    const local = trimFmt(datosProcesoActual?.formato_hojas);
    if (local) return { formato: local, origen: "IMPRESION" };
    const planImp = trimFmt(plan.impresion.formato_hojas);
    if (planImp) return { formato: planImp, origen: "IMPRESION" };
    if (compra) return { formato: compra, origen: "DESPACHO" };
    return null;
  }

  if (procesoId === PROCESO_CTP_ID) {
    const planGuill = trimFmt(plan.guillotina.tamano_final);
    if (planGuill) return { formato: planGuill, origen: "GUILLOTINA" };
    const planImp = trimFmt(plan.impresion.formato_hojas);
    if (planImp) return { formato: planImp, origen: "IMPRESION" };
    if (compra) return { formato: compra, origen: "DESPACHO" };
    return null;
  }

  return null;
}

export function procesoEjecucionMuestraAvisoFormato(procesoId: number | null): boolean {
  return procesoId != null && PROCESOS_CON_AVISO.has(procesoId);
}

export function formatoCabeAvisoEjecucion(
  input: FormatoCabeEjecucionInput,
): string | null {
  if (!procesoEjecucionMuestraAvisoFormato(input.procesoId)) return null;

  const troquelCode = String(input.troquelCode ?? "").trim();
  const mides = String(input.midesTroquel ?? "").trim();
  if (!troquelCode || !mides) return null;

  const resuelto = resolveFormatoPapelEjecucion(input);
  if (!resuelto) return null;

  const result = checkFormatoCabe(resuelto.formato, mides, input.margenes);
  return formatoCabeAvisoMsg(
    result,
    resuelto.formato,
    troquelCode,
    input.margenes,
    resuelto.origen,
  );
}
