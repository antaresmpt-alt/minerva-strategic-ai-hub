import { describe, expect, it } from "vitest";

import {
  buildExternoPrevisionRow,
  buildExternosPrevisionRows,
  shouldExcludeFromExternoPrevision,
  summarizeExternosPrevision,
} from "@/lib/externos-prevision";
import type { PipelineRowView, PipelineStepView } from "@/lib/pipeline/pipeline-data";

function step(
  partial: Partial<PipelineStepView> & Pick<PipelineStepView, "orden" | "pasoId">,
): PipelineStepView {
  return {
    estadoPaso: "pendiente",
    procesoId: null,
    procesoNombre: null,
    seccionSlug: null,
    esExterno: false,
    maquinaId: null,
    maquinaNombre: null,
    tipoMaquina: null,
    fechaDisponible: null,
    fechaInicio: null,
    fechaFin: null,
    resumenCorto: null,
    ejecucion: null,
    externo: null,
    ...partial,
  };
}

function pipelineRow(
  pasos: PipelineStepView[],
  overrides: Partial<PipelineRowView> = {},
): PipelineRowView {
  return {
    otNumero: "36001",
    otId: "id-1",
    cliente: "Cliente A",
    trabajo: "Trabajo test",
    prioridad: null,
    fechaCompromiso: "2026-06-15T00:00:00.000Z",
    estadoOt: "En producción",
    despachadoAt: "2026-05-01T00:00:00.000Z",
    pasoActual: null,
    siguientePaso: null,
    pasos,
    riesgo: "ok",
    badges: [],
    analytics: {
      horasPlanificadasTotal: null,
      horasRealesTotal: null,
      desviacionHoras: null,
      etaPrevista: null,
      slaStatus: "on_track",
      cantidadPedida: 1000,
      cantidadProducida: null,
      cumplimientoPct: null,
    },
    ...overrides,
  };
}

describe("externos-prevision", () => {
  it("buildExternoPrevisionRow calcula pasos hasta externo", () => {
    const row = pipelineRow([
      step({
        pasoId: "p1",
        orden: 1,
        procesoNombre: "Offset",
        estadoPaso: "en_marcha",
      }),
      step({
        pasoId: "p2",
        orden: 2,
        procesoNombre: "Guillotina",
        estadoPaso: "pendiente",
      }),
      step({
        pasoId: "p3",
        orden: 3,
        procesoNombre: "Plastificado (Ext)",
        estadoPaso: "pendiente",
        esExterno: true,
      }),
    ]);

    const built = buildExternoPrevisionRow(row);
    expect(built?.pasosHastaExterno).toBe(2);
    expect(built?.proximoExternoNombre).toBe("Plastificado (Ext)");
    expect(built?.pasoActualNombre).toBe("Offset");
  });

  it("excluye OT ya en puente (N=0)", () => {
    const row = pipelineRow([
      step({
        pasoId: "p1",
        orden: 1,
        procesoNombre: "Plastificado (Ext)",
        estadoPaso: "disponible",
        esExterno: true,
      }),
    ]);

    expect(buildExternoPrevisionRow(row)).toBeNull();
    expect(
      shouldExcludeFromExternoPrevision(row, new Set(["36001"])),
    ).toBe(true);
  });

  it("excluye OT con externo activo en seguimiento", () => {
    const row = pipelineRow(
      [
        step({
          pasoId: "p1",
          orden: 1,
          procesoNombre: "Offset",
          estadoPaso: "en_marcha",
        }),
        step({
          pasoId: "p2",
          orden: 2,
          procesoNombre: "Plastificado (Ext)",
          estadoPaso: "pendiente",
          esExterno: true,
        }),
      ],
      { badges: ["externo_activo"] },
    );

    expect(
      shouldExcludeFromExternoPrevision(row, new Set()),
    ).toBe(true);
  });

  it("buildExternosPrevisionRows ordena por pasos y fecha", () => {
    const rows = buildExternosPrevisionRows(
      [
        pipelineRow(
          [
            step({
              pasoId: "a1",
              orden: 1,
              procesoNombre: "Offset",
              estadoPaso: "en_marcha",
            }),
            step({
              pasoId: "a2",
              orden: 2,
              procesoNombre: "Plastificado (Ext)",
              estadoPaso: "pendiente",
              esExterno: true,
            }),
          ],
          { otNumero: "36002", fechaCompromiso: "2026-07-01T00:00:00.000Z" },
        ),
        pipelineRow(
          [
            step({
              pasoId: "b1",
              orden: 1,
              procesoNombre: "Offset",
              estadoPaso: "en_marcha",
            }),
            step({
              pasoId: "b2",
              orden: 2,
              procesoNombre: "Guillotina",
              estadoPaso: "pendiente",
            }),
            step({
              pasoId: "b3",
              orden: 3,
              procesoNombre: "Stamping (Ext)",
              estadoPaso: "pendiente",
              esExterno: true,
            }),
          ],
          { otNumero: "36001", fechaCompromiso: "2026-06-01T00:00:00.000Z" },
        ),
      ],
      new Set(),
    );

    expect(rows.map((r) => r.otNumero)).toEqual(["36002", "36001"]);
    expect(rows[0]?.pasosHastaExterno).toBe(1);
    expect(rows[1]?.pasosHastaExterno).toBe(2);
  });

  it("summarizeExternosPrevision", () => {
    expect(
      summarizeExternosPrevision([
        {
          otNumero: "1",
          cliente: null,
          trabajo: null,
          cantidad: null,
          fechaEntrega: null,
          pasoActualNombre: null,
          pasoActualEstado: null,
          proximoExternoNombre: null,
          pasosHastaExterno: 1,
        },
        {
          otNumero: "2",
          cliente: null,
          trabajo: null,
          cantidad: null,
          fechaEntrega: null,
          pasoActualNombre: null,
          pasoActualEstado: null,
          proximoExternoNombre: null,
          pasosHastaExterno: 3,
        },
      ]),
    ).toEqual({ total: 2, a1: 1, a2Plus: 1 });
  });
});
