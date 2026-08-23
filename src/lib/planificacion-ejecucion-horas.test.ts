import { describe, expect, it } from "vitest";

import {
  applyHorasMesaToDatosProceso,
  buildEjecucionHorasSyncPatch,
  computeHorasMesaNetas,
  prefillHorasDeclaradasParaCierre,
} from "@/lib/planificacion-ejecucion-horas";
import { PROCESO_DESBROCE_ID } from "@/lib/hoja-ruta-campos-config";

describe("planificacion-ejecucion-horas", () => {
  it("computeHorasMesaNetas resta pausas acumuladas", () => {
    const ini = "2026-06-23T10:00:00.000Z";
    const fin = "2026-06-23T12:00:00.000Z";
    const h = computeHorasMesaNetas({
      inicioRealAt: ini,
      finRealAt: fin,
      minutosPausadaAcum: 30,
    });
    expect(h).toBeCloseTo(1.5);
  });

  it("applyHorasMesaToDatosProceso en CTP", () => {
    const out = applyHorasMesaToDatosProceso(16, {}, 1.45);
    expect(out.horas_proceso).toBeCloseTo(1.45);
  });

  it("prefill no pisa reales; copia del plan si faltan", () => {
    const conReales = prefillHorasDeclaradasParaCierre(1, {
      horas_entrada: 1.5,
      horas_impresion: 6,
      horas_entrada_real: 0.5,
      horas_impresion_real: 1.25,
    });
    expect(conReales.horas_entrada_real).toBe(0.5);
    expect(conReales.horas_impresion_real).toBe(1.25);

    const desdePlan = prefillHorasDeclaradasParaCierre(1, {
      horas_entrada: 1.5,
      horas_impresion: 6,
    });
    expect(desdePlan.horas_entrada_real).toBe(1.5);
    expect(desdePlan.horas_impresion_real).toBe(6);

    const ctp = prefillHorasDeclaradasParaCierre(16, { horas_proceso: 0.25 });
    expect(ctp.horas_proceso).toBe(0.25);

    const troq = prefillHorasDeclaradasParaCierre(10, {
      horas_preparacion: 1,
      horas_tiraje: 2,
    });
    expect(troq.horas_preparacion_real).toBe(1);
    expect(troq.horas_tiraje_real).toBe(2);
  });

  it("buildEjecucionHorasSyncPatch sincroniza CTP y desbroce", () => {
    expect(
      buildEjecucionHorasSyncPatch(16, { horas_proceso: 1.5 }).horas_reales,
    ).toBe(1.5);
    expect(
      buildEjecucionHorasSyncPatch(PROCESO_DESBROCE_ID, { horas_proceso: 0.5 })
        .horas_reales,
    ).toBe(0.5);
  });

  it("impresión: horas_reales = entrada + impresión (línea gorda)", () => {
    const patch = buildEjecucionHorasSyncPatch(1, {
      horas_entrada_real: 0.5,
      horas_impresion_real: 1.25,
    });
    expect(patch.horas_reales).toBe(1.75);
    expect(patch.horas_reales_entrada).toBe(0.5);
    expect(patch.horas_reales_tiraje).toBe(1.25);
  });

  it("digital: misma suma entrada + impresión", () => {
    const patch = buildEjecucionHorasSyncPatch(2, {
      horas_entrada_real: 0.5,
      horas_impresion_real: 1,
    });
    expect(patch.horas_reales).toBe(1.5);
  });

  it("troquelado: horas_reales y horas_reales_troquelado = prep + tiraje", () => {
    const patch = buildEjecucionHorasSyncPatch(10, {
      horas_preparacion_real: 1,
      horas_tiraje_real: 1,
    });
    expect(patch.horas_reales).toBe(2);
    expect(patch.horas_reales_troquelado).toBe(2);
  });

  it("engomado: horas_reales y horas_reales_engomado = prep + tiraje", () => {
    const patch = buildEjecucionHorasSyncPatch(12, {
      horas_preparacion_real: 0.25,
      horas_tiraje_real: 0.75,
    });
    expect(patch.horas_reales).toBe(1);
    expect(patch.horas_reales_engomado).toBe(1);
  });
});
