import { describe, expect, it } from "vitest";

import { resolveSalidaAnteriorPorItinerario } from "@/lib/hoja-ruta-salida-encadenado";

const TROQUEL_INPUT_IDS = [3, 4, 5, 6, 9, 21, 1, 2];

function paso(
  proceso_id: number,
  orden: number,
  datos_proceso: Record<string, unknown>,
) {
  return { proceso_id, orden, datos_proceso };
}

describe("resolveSalidaAnteriorPorItinerario", () => {
  it("elige el paso inmediatamente anterior (UVI 1500), no el primer ID (plastificado 1550)", () => {
    const resolved = resolveSalidaAnteriorPorItinerario(
      [
        paso(1, 2, { hojas_impresas: 1650 }),
        paso(3, 3, { hojas_recibidas_muelle: 1550, hojas_enviadas: 1650 }),
        paso(5, 4, { hojas_recibidas_muelle: 1500, hojas_enviadas: 1550 }),
        paso(10, 5, {}),
      ],
      TROQUEL_INPUT_IDS,
      5,
    );
    expect(resolved).toEqual({
      procesoAnteriorId: 5,
      salida: 1500,
      nombre: "UVI Serigrafía (Ext)",
    });
  });

  it("si no hay UVI, cae al plastificado anterior", () => {
    const resolved = resolveSalidaAnteriorPorItinerario(
      [
        paso(1, 2, { hojas_impresas: 1650 }),
        paso(3, 3, { hojas_recibidas_muelle: 1550 }),
        paso(10, 4, {}),
      ],
      TROQUEL_INPUT_IDS,
      4,
    );
    expect(resolved?.procesoAnteriorId).toBe(3);
    expect(resolved?.salida).toBe(1550);
  });

  it("ignora pasos posteriores o el actual", () => {
    const resolved = resolveSalidaAnteriorPorItinerario(
      [
        paso(1, 2, { hojas_impresas: 1650 }),
        paso(3, 6, { hojas_recibidas_muelle: 999 }),
      ],
      TROQUEL_INPUT_IDS,
      5,
    );
    expect(resolved?.procesoAnteriorId).toBe(1);
    expect(resolved?.salida).toBe(1650);
  });

  it("sin currentOrden elige el de mayor orden compatible", () => {
    const resolved = resolveSalidaAnteriorPorItinerario(
      [
        paso(3, 3, { hojas_recibidas_muelle: 1550 }),
        paso(5, 4, { hojas_recibidas_muelle: 1500 }),
      ],
      TROQUEL_INPUT_IDS,
      null,
    );
    expect(resolved?.procesoAnteriorId).toBe(5);
    expect(resolved?.salida).toBe(1500);
  });
});
