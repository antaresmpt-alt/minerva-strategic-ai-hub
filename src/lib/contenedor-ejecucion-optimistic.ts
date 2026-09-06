import type { MesaEjecucion } from "@/types/planificacion-mesa";

export type MaterializeContenedorStartInput = {
  execId: string;
  inicioRealAt: string;
  maquinaId?: string;
  maquinaNombre?: string;
  datosProcesoJson?: Record<string, unknown> | null;
};

/**
 * Fila virtual del contenedor → ejecución real `en_curso` en memoria.
 * Permite abrir el parte al instante; el refetch silencioso alinea BD.
 */
export function materializeContenedorRowAfterStart(
  row: MesaEjecucion,
  input: MaterializeContenedorStartInput,
): MesaEjecucion {
  const execId = String(input.execId ?? "").trim();
  const inicioRealAt = String(input.inicioRealAt ?? "").trim();
  if (!execId || !inicioRealAt) {
    throw new Error("Faltan id o inicio para materializar la ejecución.");
  }
  const maquinaId = String(input.maquinaId ?? "").trim() || row.maquinaId;
  const maquinaNombre =
    String(input.maquinaNombre ?? "").trim() || row.maquinaNombre;
  return {
    ...row,
    id: execId,
    estadoEjecucion: "en_curso",
    inicioRealAt,
    updatedAt: inicioRealAt,
    maquinaId,
    maquinaNombre,
    datosProcesoJson:
      input.datosProcesoJson !== undefined
        ? input.datosProcesoJson
        : row.datosProcesoJson,
    origenContenedorCtp: undefined,
    origenContenedorTroquel: undefined,
    origenContenedorSeccion: undefined,
    planSlotHoy: undefined,
    planMaquinaId: undefined,
  };
}

/** Mesa u otra fila ya persistida: solo pasa a en_curso en memoria. */
export function markEjecucionEnCursoLocal(
  row: MesaEjecucion,
  inicioRealAt: string,
  datosProcesoJson?: Record<string, unknown> | null,
): MesaEjecucion {
  return {
    ...row,
    estadoEjecucion: "en_curso",
    inicioRealAt,
    updatedAt: inicioRealAt,
    datosProcesoJson:
      datosProcesoJson !== undefined ? datosProcesoJson : row.datosProcesoJson,
  };
}
