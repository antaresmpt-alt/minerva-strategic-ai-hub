import assert from "node:assert/strict";
import test from "node:test";

import {
  computePipelineBadges,
  computePipelineRisk,
  getPasoActual,
  getSiguientePaso,
  type PipelineRowView,
  type PipelineStepView,
} from "@/lib/pipeline/pipeline-data";

function mkStep(
  overrides: Partial<PipelineStepView> & Pick<PipelineStepView, "pasoId" | "orden" | "estadoPaso">,
): PipelineStepView {
  const { pasoId, orden, estadoPaso, ...rest } = overrides;
  return {
    pasoId,
    orden,
    estadoPaso,
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
    ...rest,
  };
}

test("getPasoActual prioriza en_marcha/pausado sobre disponible", () => {
  const pasos = [
    mkStep({ pasoId: "a", orden: 1, estadoPaso: "disponible" }),
    mkStep({ pasoId: "b", orden: 2, estadoPaso: "en_marcha" }),
    mkStep({ pasoId: "c", orden: 3, estadoPaso: "pendiente" }),
  ];
  const actual = getPasoActual(pasos);
  assert.equal(actual?.pasoId, "b");
});

test("getSiguientePaso devuelve primer pendiente posterior al actual", () => {
  const pasos = [
    mkStep({ pasoId: "a", orden: 1, estadoPaso: "finalizado" }),
    mkStep({ pasoId: "b", orden: 2, estadoPaso: "en_marcha" }),
    mkStep({ pasoId: "c", orden: 3, estadoPaso: "pendiente" }),
    mkStep({ pasoId: "d", orden: 4, estadoPaso: "pendiente" }),
  ];
  const actual = getPasoActual(pasos);
  const siguiente = getSiguientePaso(pasos, actual);
  assert.equal(siguiente?.pasoId, "c");
});

test("computePipelineBadges detecta sin itinerario", () => {
  const badges = computePipelineBadges({
    pasos: [],
    fechaCompromiso: null,
    riesgo: "ok",
  });
  assert.ok(badges.includes("sin_itinerario"));
});

test("computePipelineBadges detecta externo activo", () => {
  const badges = computePipelineBadges({
    pasos: [
      mkStep({
        pasoId: "x",
        orden: 1,
        estadoPaso: "disponible",
        esExterno: true,
        externo: {
          estado: "En Proveedor",
          proveedorNombre: "Acabados SA",
          fechaEnvio: null,
          fechaPrevista: null,
          observaciones: null,
        },
      }),
    ],
    fechaCompromiso: null,
    riesgo: "ok",
  });
  assert.ok(badges.includes("externo_activo"));
});

test("computePipelineRisk devuelve overdue y warning", () => {
  const pasosAbiertos = [mkStep({ pasoId: "z", orden: 1, estadoPaso: "disponible" })];
  const overdue = computePipelineRisk(
    {
      fechaCompromiso: "2026-01-01T00:00:00.000Z",
      pasos: pasosAbiertos,
      warningDays: 2,
    },
    new Date("2026-01-04T10:00:00.000Z"),
  );
  assert.equal(overdue, "overdue");

  const warning = computePipelineRisk(
    {
      fechaCompromiso: "2026-01-05T00:00:00.000Z",
      pasos: pasosAbiertos,
      warningDays: 2,
    },
    new Date("2026-01-04T10:00:00.000Z"),
  );
  assert.equal(warning, "warning");
});

test("ejemplo de PipelineRowView tipado", () => {
  const row: PipelineRowView = {
    otNumero: "99999",
    otId: "uuid-ot",
    cliente: "Cliente demo",
    trabajo: "Caja hamburguesa",
    prioridad: 1,
    fechaCompromiso: "2026-05-10T00:00:00.000Z",
    estadoOt: "En producción",
    despachadoAt: "2026-05-01T09:00:00.000Z",
    pasos: [mkStep({ pasoId: "1", orden: 1, estadoPaso: "disponible" })],
    pasoActual: mkStep({ pasoId: "1", orden: 1, estadoPaso: "disponible" }),
    siguientePaso: null,
    riesgo: "ok",
    badges: [],
    analytics: {
      horasPlanificadasTotal: null,
      horasRealesTotal: null,
      desviacionHoras: null,
      etaPrevista: null,
      slaStatus: "on_track",
    },
  };
  assert.equal(row.otNumero, "99999");
});

