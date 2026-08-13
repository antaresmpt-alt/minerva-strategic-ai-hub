/**
 * Encadenado de cantidad (hojas/unidades) entre pasos del itinerario.
 *
 * El paso de entrada es el finalizado con `orden` más alto estrictamente
 * anterior al actual, entre los `inputFromProcessIds` del proceso destino.
 * No se recorre la lista de IDs (eso cogía p.ej. Plastificado antes que UVI).
 */

import { getCamposConfigByProcesoId } from "@/lib/hoja-ruta-campos-config";

export type PasoSalidaAnteriorCandidate = {
  proceso_id: number | null;
  datos_proceso: Record<string, unknown> | null;
  orden: number | null;
};

export type SalidaAnteriorResolved = {
  procesoAnteriorId: number;
  salida: number;
  nombre: string;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function readSalidaCantidadProceso(
  procesoId: number,
  datos: Record<string, unknown> | null | undefined,
): number | null {
  if (!datos) return null;
  const cfg = getCamposConfigByProcesoId(procesoId);
  if (!cfg?.outputField) return null;
  return asFiniteNumber(
    datos[cfg.outputField] ?? datos.hojas_recibidas_muelle ?? datos.hojas_enviadas,
  );
}

/**
 * Entre candidatos compatibles, elige el paso con mayor `orden` < `currentOrden`.
 * Si `currentOrden` es null, elige el de mayor `orden` (último del itinerario).
 */
export function resolveSalidaAnteriorPorItinerario(
  pasosOt: PasoSalidaAnteriorCandidate[],
  inputFromProcessIds: number[],
  currentOrden: number | null,
): SalidaAnteriorResolved | null {
  if (inputFromProcessIds.length === 0) return null;
  const inputSet = new Set(inputFromProcessIds);
  let best: { orden: number; resolved: SalidaAnteriorResolved } | null = null;

  for (const paso of pasosOt) {
    const pid = paso.proceso_id;
    if (pid == null || !inputSet.has(pid)) continue;
    const pasoOrden = paso.orden;
    if (currentOrden != null && pasoOrden != null && pasoOrden >= currentOrden) continue;

    const salida = readSalidaCantidadProceso(pid, paso.datos_proceso);
    if (salida == null) continue;

    const ordenRank = pasoOrden ?? Number.NEGATIVE_INFINITY;
    if (best != null && ordenRank <= best.orden) continue;

    const cfg = getCamposConfigByProcesoId(pid);
    best = {
      orden: ordenRank,
      resolved: {
        procesoAnteriorId: pid,
        salida,
        nombre: cfg?.procesoNombre ?? "Paso anterior",
      },
    };
  }

  return best?.resolved ?? null;
}
