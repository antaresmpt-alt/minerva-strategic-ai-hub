/**
 * Encadenado de formato de pliego entre pasos del itinerario (Fase FORMATO).
 *
 * La cadena sigue el orden del itinerario (`prod_ot_pasos.orden`), no solo
 * el tipo de proceso, para soportar varias guillotinas en la misma OT.
 */

import {
  getCamposConfigByProcesoId,
  type DatosProcesoGenerico,
  type ProcesoConfigCampos,
} from "@/lib/hoja-ruta-campos-config";

export type FormatoAnteriorInfo = {
  formato: string;
  /** Nombre del proceso o "Formato compra" cuando no hay paso previo con formato. */
  origenNombre: string;
  /** `compra` si viene del despacho; `paso` si viene de un paso anterior del itinerario. */
  origenTipo: "compra" | "paso";
  procesoIdOrigen: number | null;
};

export type PasoItinerarioFormato = {
  id: string;
  otId: string;
  procesoId: number | null;
  orden: number;
  datosProceso: Record<string, unknown> | null;
};

function trimFormato(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readCampoFormato(
  datos: Record<string, unknown> | null | undefined,
  fieldId: string | undefined,
): string | null {
  if (!fieldId || !datos) return null;
  return trimFormato(datos[fieldId]);
}

/**
 * Lee el formato de pliego que deja un paso hacia el siguiente.
 * En guillotina, si aún no hay corte registrado, se usa el tamaño inicial.
 */
export function resolveFormatoSalidaProceso(
  procesoId: number,
  datos: Record<string, unknown> | null | undefined,
): string | null {
  const cfg = getCamposConfigByProcesoId(procesoId);
  if (!cfg?.formatOutputField) return null;

  const salida = readCampoFormato(datos, cfg.formatOutputField);
  if (salida) return salida;

  if (cfg.formatInputField && cfg.formatInputField !== cfg.formatOutputField) {
    return readCampoFormato(datos, cfg.formatInputField);
  }
  return null;
}

/** Indica si el proceso participa en el encadenado de formato (entrada o salida). */
export function procesoUsaEncadenadoFormato(procesoId: number): boolean {
  const cfg = getCamposConfigByProcesoId(procesoId);
  if (!cfg) return false;
  return Boolean(cfg.formatInputField || cfg.formatOutputField);
}

function campoEntradaFormato(cfg: ProcesoConfigCampos): string | undefined {
  return cfg.formatInputField ?? cfg.formatOutputField;
}

/**
 * Prefill de campos de formato vacíos a partir del formato del paso anterior
 * o del formato compra del despacho.
 */
export function aplicarPrefillFormatoEncadenado(
  procesoId: number,
  datos: DatosProcesoGenerico,
  formatoAnterior: string | null | undefined,
): DatosProcesoGenerico {
  const cfg = getCamposConfigByProcesoId(procesoId);
  if (!cfg || !formatoAnterior?.trim()) return datos;

  const inputField = campoEntradaFormato(cfg);
  if (!inputField) return datos;

  const current = datos[inputField];
  if (trimFormato(current)) return datos;

  return { ...datos, [inputField]: formatoAnterior.trim() };
}

/**
 * Resuelve el formato de pliego que entra en el paso actual, recorriendo
 * hacia atrás en el itinerario por `orden`.
 */
export function resolveFormatoAnteriorPorItinerario(
  pasosOt: PasoItinerarioFormato[],
  currentPasoId: string,
  formatoCompra: string | null | undefined,
): FormatoAnteriorInfo | null {
  const idx = pasosOt.findIndex((p) => p.id === currentPasoId);
  if (idx < 0) {
    const compra = trimFormato(formatoCompra);
    if (!compra) return null;
    return {
      formato: compra,
      origenNombre: "Formato compra",
      origenTipo: "compra",
      procesoIdOrigen: null,
    };
  }

  for (let j = idx - 1; j >= 0; j -= 1) {
    const prev = pasosOt[j];
    if (prev.procesoId == null) continue;
    const fmt = resolveFormatoSalidaProceso(prev.procesoId, prev.datosProceso);
    if (!fmt) continue;
    const cfg = getCamposConfigByProcesoId(prev.procesoId);
    return {
      formato: fmt,
      origenNombre: cfg?.procesoNombre ?? "Paso anterior",
      origenTipo: "paso",
      procesoIdOrigen: prev.procesoId,
    };
  }

  const compra = trimFormato(formatoCompra);
  if (!compra) return null;
  return {
    formato: compra,
    origenNombre: "Formato compra",
    origenTipo: "compra",
    procesoIdOrigen: null,
  };
}

export function formatoAnteriorKeyByOtPasoId(otPasoId: string | null | undefined): string | null {
  const id = String(otPasoId ?? "").trim();
  return id.length > 0 ? id : null;
}

export function buildFormatoAnteriorByOtPasoId(
  pasosPorOtId: Map<string, PasoItinerarioFormato[]>,
  otPasoIds: Array<{ otPasoId: string; otId: string; formatoCompra: string | null }>,
): Map<string, FormatoAnteriorInfo> {
  const map = new Map<string, FormatoAnteriorInfo>();
  for (const { otPasoId, otId, formatoCompra } of otPasoIds) {
    const pasosOt = pasosPorOtId.get(otId) ?? [];
    const info = resolveFormatoAnteriorPorItinerario(pasosOt, otPasoId, formatoCompra);
    if (info) map.set(otPasoId, info);
  }
  return map;
}
