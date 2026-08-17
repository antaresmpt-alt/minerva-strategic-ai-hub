import { describe, expect, it } from "vitest";

import { buildCierreCalidadAvisos } from "@/lib/prod-ot-cierre-avisos";
import type { HojaRutaData, HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";
import { PROCESO_ENGOMADO_ID } from "@/lib/despacho-wizard-shared";

function paso(
  procesoId: number,
  datosProceso: Record<string, unknown>,
): HojaRutaPaso {
  return {
    pasoId: `p-${procesoId}`,
    orden: 1,
    estado: "finalizado",
    procesoId,
    procesoNombre: "Engomado",
    esExterno: false,
    maquinaNombre: null,
    tipoMaquina: null,
    fechaDisponible: null,
    fechaInicio: null,
    fechaFin: null,
    datosProceso,
    ejecucion: null,
    externo: null,
  };
}

function baseData(overrides: Partial<HojaRutaData> = {}): HojaRutaData {
  return {
    otNumero: "99906",
    otId: "x",
    cliente: "Test",
    trabajo: "Trabajo",
    cantidad: 1000,
    fechaEntrega: null,
    estadoOt: null,
    despacho: {
      material: "COUCHE",
      gramaje: 300,
      tamanoHoja: "70x100",
      hojasBrutas: 1200,
      tintas: "4+0",
      troquel: "T1",
      poses: 4,
      acabadoPral: null,
      referenciaMinerva: null,
      referenciaCliente: null,
    },
    pasos: [paso(PROCESO_ENGOMADO_ID, { estuches_engomados: 2100 })],
    ...overrides,
  };
}

describe("buildCierreCalidadAvisos", () => {
  it("avisa sobreproducción clara", () => {
    const avisos = buildCierreCalidadAvisos(baseData());
    expect(avisos.some((a) => a.id === "sobreproduccion")).toBe(true);
  });

  it("avisa gramaje cero", () => {
    const avisos = buildCierreCalidadAvisos(
      baseData({
        despacho: {
          ...baseData().despacho!,
          gramaje: 0,
        },
        pasos: [paso(PROCESO_ENGOMADO_ID, { estuches_engomados: 1000 })],
      }),
    );
    expect(avisos.some((a) => a.id === "gramaje_cero")).toBe(true);
  });

  it("sin avisos en cierre coherente", () => {
    const avisos = buildCierreCalidadAvisos(
      baseData({
        pasos: [paso(PROCESO_ENGOMADO_ID, { estuches_engomados: 980 })],
      }),
    );
    expect(avisos.length).toBe(0);
  });
});
