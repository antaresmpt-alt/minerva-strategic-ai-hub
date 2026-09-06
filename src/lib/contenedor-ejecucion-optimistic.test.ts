import { describe, expect, it } from "vitest";

import {
  markEjecucionEnCursoLocal,
  materializeContenedorRowAfterStart,
} from "@/lib/contenedor-ejecucion-optimistic";
import type { MesaEjecucion } from "@/types/planificacion-mesa";

function virtualRow(over: Partial<MesaEjecucion> = {}): MesaEjecucion {
  return {
    id: "contenedor-ctp:paso-1",
    mesaTrabajoId: null,
    otPasoId: "paso-1",
    otId: "ot-1",
    procesoId: 10,
    datosProcesoJson: { a: 1 },
    procesoAnteriorId: null,
    salidaProcesoAnterior: null,
    salidaProcesoAnteriorNombre: null,
    formatoAnterior: null,
    formatoAnteriorOrigenNombre: null,
    ot: "98001",
    maquinaId: "maq-ctp",
    maquinaNombre: "CTP MNRV",
    maquinaTipo: "preimpresion",
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
    createdAt: "2026-09-06T10:00:00.000Z",
    updatedAt: "2026-09-06T10:00:00.000Z",
    origenContenedorCtp: true,
    planSlotHoy: 3,
    ...over,
  };
}

describe("materializeContenedorRowAfterStart", () => {
  it("replaces virtual id and clears contenedor flags so the parte can open", () => {
    const inicio = "2026-09-06T16:00:00.000Z";
    const next = materializeContenedorRowAfterStart(virtualRow(), {
      execId: "exec-real",
      inicioRealAt: inicio,
      maquinaId: "jr-1",
      maquinaNombre: "JR",
    });
    expect(next.id).toBe("exec-real");
    expect(next.estadoEjecucion).toBe("en_curso");
    expect(next.inicioRealAt).toBe(inicio);
    expect(next.maquinaId).toBe("jr-1");
    expect(next.maquinaNombre).toBe("JR");
    expect(next.origenContenedorCtp).toBeUndefined();
    expect(next.planSlotHoy).toBeUndefined();
    expect(next.ot).toBe("98001");
    expect(next.otPasoId).toBe("paso-1");
  });

  it("keeps existing máquina if claim not passed", () => {
    const next = materializeContenedorRowAfterStart(virtualRow(), {
      execId: "e2",
      inicioRealAt: "2026-09-06T16:00:00.000Z",
    });
    expect(next.maquinaId).toBe("maq-ctp");
    expect(next.maquinaNombre).toBe("CTP MNRV");
  });
});

describe("markEjecucionEnCursoLocal", () => {
  it("flips pendiente_inicio without changing id", () => {
    const row = virtualRow({
      id: "already-real",
      origenContenedorCtp: undefined,
    });
    const next = markEjecucionEnCursoLocal(row, "2026-09-06T16:01:00.000Z");
    expect(next.id).toBe("already-real");
    expect(next.estadoEjecucion).toBe("en_curso");
    expect(next.inicioRealAt).toBe("2026-09-06T16:01:00.000Z");
  });
});
