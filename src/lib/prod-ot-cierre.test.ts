import { describe, expect, it } from "vitest";

import {
  buildProdOtProducidaInsert,
  extractCantidadProducida,
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
});
