import { describe, expect, it } from "vitest";

import { buildPrevistoRealPdfRows } from "@/lib/hoja-ruta/hoja-ruta-pdf-previsto-real";
import type { HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";
import {
  PROCESO_CTP_ID,
  PROCESO_DESBROCE_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_GUILLOTINA_ID,
  PROCESO_OFFSET_ID,
  PROCESO_TROQUEL_ID,
} from "@/lib/despacho-wizard-shared";

function paso(procesoId: number, overrides: Partial<HojaRutaPaso> = {}): HojaRutaPaso {
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

describe("buildPrevistoRealPdfRows", () => {
  it("incluye impresión, externos, troquel, desbroce y engomado; omite CTP y guillotina", () => {
    const rows = buildPrevistoRealPdfRows([
      paso(PROCESO_CTP_ID, { orden: 1, procesoNombre: "CTP", datosProceso: { horas_proceso: 2 } }),
      paso(PROCESO_OFFSET_ID, {
        orden: 2,
        procesoNombre: "Impresión Offset",
        datosProceso: { hojas_netas: 1600, hojas_impresas: 1650, hojas_merma: 150 },
      }),
      paso(3, {
        orden: 3,
        procesoNombre: "Plastificado (Ext)",
        esExterno: true,
        datosProceso: { hojas_enviadas: 1650, hojas_recibidas_muelle: 1550 },
        externo: {
          estado: "recibido",
          proveedorNombre: null,
          acabadoNombre: null,
          fechaEnvio: null,
          fechaPrevista: null,
          fechaRecepcionMuelle: null,
          hojasEnviadas: 1650,
          hojasRecibidasMuelle: 1550,
          unidades: null,
          unidadesRecibidasMuelle: null,
          palets: null,
          paletsRecibidosMuelle: null,
          observaciones: null,
        },
      }),
      paso(PROCESO_GUILLOTINA_ID, {
        orden: 4,
        procesoNombre: "Guillotina",
        datosProceso: { hojas_finales: 2000 },
      }),
      paso(PROCESO_TROQUEL_ID, {
        orden: 5,
        procesoNombre: "Troquelado",
        datosProceso: { hojas_troquelar: 1500, hojas_troqueladas: 1450, hojas_merma: 50 },
      }),
      paso(PROCESO_DESBROCE_ID, {
        orden: 6,
        procesoNombre: "Desbroce",
        datosProceso: { hojas_entrada: 1450, poses: 4, estuches_desbrozados: 5800 },
      }),
      paso(PROCESO_ENGOMADO_ID, {
        orden: 7,
        procesoNombre: "Engomado",
        datosProceso: { estuches_realizar: 6000, estuches_engomados: 5800 },
      }),
    ]);

    expect(rows.map((r) => r.label)).toEqual([
      "2 · Impresión Offset",
      "3 · Plastificado (Ext)",
      "5 · Troquelado",
      "6 · Desbroce",
      "7 · Engomado",
    ]);
    expect(rows[0]).toMatchObject({ previsto: 1600, real: 1650, merma: 150 });
    expect(rows[1]).toMatchObject({ previsto: 1650, real: 1550, merma: 100 });
    expect(rows[2]).toMatchObject({ previsto: 1500, real: 1450, merma: 50 });
    expect(rows[3]).toMatchObject({ previsto: 5800, real: 5800, merma: 0 });
    expect(rows[4]).toMatchObject({ previsto: 6000, real: 5800, merma: 0 });
  });
});
