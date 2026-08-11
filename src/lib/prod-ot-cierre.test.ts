import { describe, expect, it } from "vitest";

import {
  buildProdOtProducidaContenedorInsert,
  buildProdOtProducidaInsert,
  contenedorHijasItinerarioCompleto,
  extractCantidadProducida,
  isContenedorCierreSnapshot,
} from "@/lib/prod-ot-cierre";
import type { HojaRutaData, HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";
import {
  PROCESO_CTP_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_OFFSET_ID,
  PROCESO_TROQUEL_ID,
} from "@/lib/despacho-wizard-shared";

function paso(
  procesoId: number,
  overrides: Partial<HojaRutaPaso> = {},
): HojaRutaPaso {
  return {
    pasoId: `p-${procesoId}`,
    orden: procesoId,
    estado: "finalizado",
    procesoId,
    procesoNombre: `P${procesoId}`,
    esExterno: false,
    maquinaNombre: null,
    tipoMaquina: null,
    fechaDisponible: null,
    fechaInicio: null,
    fechaFin: null,
    datosProceso: null,
    ejecucion: null,
    externo: null,
    ...overrides,
  };
}

function snapshot(pasos: HojaRutaPaso[]): HojaRutaData {
  return {
    otNumero: "36070",
    otId: "ot-uuid",
    cliente: "Cliente Test",
    trabajo: "Trabajo Test",
    cantidad: 6000,
    fechaEntrega: null,
    estadoOt: null,
    despacho: {
      material: "Folding",
      gramaje: 300,
      tamanoHoja: "70x100",
      hojasBrutas: 1000,
      tintas: "4",
      troquel: "TAM1",
      poses: 8,
      acabadoPral: null,
    },
    pasos,
  };
}

describe("extractCantidadProducida", () => {
  it("prioriza engomado sobre ceros de CTP", () => {
    const n = extractCantidadProducida([
      paso(PROCESO_CTP_ID, {
        ejecucion: {
          estado: "finalizada",
          inicioRealAt: null,
          finRealAt: null,
          horasReales: null,
          cantidadUnidades: 0,
          numHojasProducidas: null,
          maquinista: null,
          incidencia: null,
          accionCorrectiva: null,
          observaciones: null,
          numPausas: 0,
          haEstadoPausada: false,
          pausas: [],
        },
      }),
      paso(PROCESO_ENGOMADO_ID, {
        datosProceso: { estuches_engomados: 6250 },
      }),
    ]);
    expect(n).toBe(6250);
  });

  it("sin engomado usa unidades del último paso (caso 35990)", () => {
    const n = extractCantidadProducida([
      paso(PROCESO_CTP_ID, { datosProceso: {} }),
      paso(PROCESO_OFFSET_ID, {
        datosProceso: { hojas_impresas: 500 },
        ejecucion: {
          estado: "finalizada",
          inicioRealAt: null,
          finRealAt: null,
          horasReales: null,
          cantidadUnidades: null,
          numHojasProducidas: 500,
          maquinista: null,
          incidencia: null,
          accionCorrectiva: null,
          observaciones: null,
          numPausas: 0,
          haEstadoPausada: false,
          pausas: [],
        },
      }),
      paso(PROCESO_TROQUEL_ID, {
        datosProceso: { hojas_troqueladas: 475, poses: 1 },
      }),
      paso(15, {
        datosProceso: { unidades: 475, descripcion: "manipulado" },
      }),
    ]);
    expect(n).toBe(475);
  });
});

describe("buildProdOtProducidaInsert + referencia_id", () => {
  it("persiste extras de referencia Minerva/cliente", () => {
    const row = buildProdOtProducidaInsert({
      otNumero: "36070",
      snapshot: snapshot([
        paso(PROCESO_ENGOMADO_ID, {
          datosProceso: { estuches_engomados: 6250 },
        }),
      ]),
      userId: "user-1",
      despachoExtras: {
        referencia_id: "874b96e7-fdaf-47fb-866f-1cc847840f7c",
        referencia_minerva: "M-00701",
        referencia_cliente: "0026563",
        tipo_engomado: "Lineal",
      },
      nowIso: "2026-07-23T12:00:00.000Z",
    });

    expect(row.referencia_id).toBe("874b96e7-fdaf-47fb-866f-1cc847840f7c");
    expect(row.referencia_minerva).toBe("M-00701");
    expect(row.referencia_cliente).toBe("0026563");
    expect(row.cantidad_producida).toBe(6250);
    expect(row.tipo_engomado).toBe("Lineal");
  });

  it("mapea horas prep/tiraje de engomado al histórico", () => {
    const row = buildProdOtProducidaInsert({
      otNumero: "99906",
      snapshot: snapshot([
        paso(PROCESO_ENGOMADO_ID, {
          datosProceso: {
            horas_preparacion_real: 0.4,
            horas_tiraje_real: 1.6,
            estuches_engomados: 1000,
          },
        }),
      ]),
      userId: "user-1",
      nowIso: "2026-07-27T12:00:00.000Z",
    });
    expect(row.horas_prep_engomado_reales).toBe(0.4);
    expect(row.horas_tiraje_engomado_reales).toBe(1.6);
    expect(row.horas_total_reales).toBe(2);
  });
});

describe("contenedorHijasItinerarioCompleto", () => {
  it("exige todas las hijas con itinerario completo", () => {
    expect(
      contenedorHijasItinerarioCompleto([
        { pasosCompletados: 3, pasosTotal: 3 },
        { pasosCompletados: 2, pasosTotal: 2 },
      ]),
    ).toBe(true);
    expect(
      contenedorHijasItinerarioCompleto([
        { pasosCompletados: 3, pasosTotal: 3 },
        { pasosCompletados: 1, pasosTotal: 2 },
      ]),
    ).toBe(false);
    expect(contenedorHijasItinerarioCompleto([])).toBe(false);
    expect(
      contenedorHijasItinerarioCompleto([{ pasosCompletados: 0, pasosTotal: 0 }]),
    ).toBe(false);
  });
});

describe("buildProdOtProducidaContenedorInsert", () => {
  it("agrega horas y anida snapshot kind contenedor", () => {
    const hijaA = snapshot([
      paso(PROCESO_OFFSET_ID, {
        datosProceso: { horas_entrada_real: 1, horas_impresion_real: 2 },
      }),
    ]);
    hijaA.otNumero = "98010-01";
    const hijaB = snapshot([
      paso(PROCESO_OFFSET_ID, {
        datosProceso: { horas_entrada_real: 0.5, horas_impresion_real: 1.5 },
      }),
    ]);
    hijaB.otNumero = "98010-02";

    const padre = snapshot([]);
    padre.otNumero = "98010";
    padre.cantidad = 6000;

    const row = buildProdOtProducidaContenedorInsert({
      padreOtNumero: "98010",
      contenedor: {
        padre,
        progress: {
          total: 2,
          completadas: 2,
          pct: 100,
          pasosCompletados: 2,
          pasosTotal: 2,
          hijasCerradasPct: 100,
          hijasItinerarioCompleto: true,
        },
        progressLabel: "2 hijas · 100%",
        hijasResumen: [
          {
            otNumero: "98010-01",
            formaDescripcion: null,
            trabajo: null,
            cantidad: 3000,
            pasoActual: null,
            pasos: [],
            pasosCompletados: 1,
            pasosTotal: 1,
          },
          {
            otNumero: "98010-02",
            formaDescripcion: null,
            trabajo: null,
            cantidad: 3000,
            pasoActual: null,
            pasos: [],
            pasosCompletados: 1,
            pasosTotal: 1,
          },
        ],
      },
      hijasSnapshots: [hijaA, hijaB],
      userId: "user-1",
      nowIso: "2026-08-11T12:00:00.000Z",
    });

    expect(row.ot_numero).toBe("98010");
    expect(row.horas_prep_impresion_reales).toBe(1.5);
    expect(row.horas_tiraje_impresion_reales).toBe(3.5);
    expect(isContenedorCierreSnapshot(row.snapshot)).toBe(true);
    if (isContenedorCierreSnapshot(row.snapshot)) {
      expect(row.snapshot.hijas).toHaveLength(2);
    }
  });
});
