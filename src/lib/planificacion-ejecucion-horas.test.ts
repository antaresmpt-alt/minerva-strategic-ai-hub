import { describe, expect, it } from "vitest";

import {
  applyHorasMesaToDatosProceso,
  buildEjecucionHorasSyncPatch,
  computeHorasMesaNetas,
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

  it("buildEjecucionHorasSyncPatch sincroniza CTP y desbroce", () => {
    expect(
      buildEjecucionHorasSyncPatch(16, { horas_proceso: 1.5 }).horas_reales,
    ).toBe(1.5);
    expect(
      buildEjecucionHorasSyncPatch(PROCESO_DESBROCE_ID, { horas_proceso: 0.5 })
        .horas_reales,
    ).toBe(0.5);
  });
});
