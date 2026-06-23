import { describe, expect, it } from "vitest";

import {
  computeHorasResumenOt,
  extractHorasRealPaso,
  formatHorasResumenLine,
} from "@/lib/hoja-ruta/hoja-ruta-horas";
import type { HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";

function paso(
  procesoId: number,
  datos: Record<string, unknown>,
  overrides: Partial<HojaRutaPaso> = {},
): HojaRutaPaso {
  return {
    pasoId: "p1",
    orden: 1,
    estado: "finalizado",
    procesoId,
    procesoNombre: "Test",
    esExterno: false,
    maquinaNombre: null,
    tipoMaquina: null,
    fechaDisponible: null,
    fechaInicio: null,
    fechaFin: null,
    datosProceso: datos,
    ejecucion: null,
    externo: null,
    ...overrides,
  };
}

describe("hoja-ruta-horas", () => {
  it("suma horas reales de impresión (entrada + tiraje)", () => {
    const total = extractHorasRealPaso(
      paso(1, { horas_entrada_real: 0.5, horas_impresion_real: 2.15 }),
    );
    expect(total).toBeCloseTo(2.65);
  });

  it("agrega previsto y real con desviación", () => {
    const resumen = computeHorasResumenOt([
      paso(16, { horas_proceso: 1.5 }),
      paso(12, { tiempo_previsto: 2, tiempo_real: 2.5 }),
    ]);
    expect(resumen.previsto).toBeCloseTo(3.5);
    expect(resumen.real).toBeCloseTo(4);
    expect(resumen.desviacion).toBeCloseTo(0.5);
    expect(formatHorasResumenLine(resumen)).toContain("Prev.");
    expect(formatHorasResumenLine(resumen)).toContain("Real");
  });
});
