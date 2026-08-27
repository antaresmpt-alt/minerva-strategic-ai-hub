import { describe, expect, it } from "vitest";

import {
  defaultReservasDurasUnaOt,
  repartirHojasEntrePalets,
  syncReservaDuraConCantidad,
} from "@/lib/cartela-wizard-reparto";

describe("repartirHojasEntrePalets", () => {
  it("reparte 16000 en 8 → ocho de 2000", () => {
    expect(repartirHojasEntrePalets(16000, 8)).toEqual([
      2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000,
    ]);
  });

  it("reparte resto en los primeros", () => {
    expect(repartirHojasEntrePalets(10, 3)).toEqual([4, 3, 3]);
  });

  it("n=1 devuelve el total", () => {
    expect(repartirHojasEntrePalets(16000, 1)).toEqual([16000]);
  });

  it("total 0 → ceros", () => {
    expect(repartirHojasEntrePalets(0, 4)).toEqual([0, 0, 0, 0]);
  });
});

describe("defaultReservasDurasUnaOt", () => {
  it("1 OT → reserva dura = hojas del palet", () => {
    expect(defaultReservasDurasUnaOt(["98023"], 2000)).toEqual({
      "98023": "2000",
    });
  });

  it("multi-OT → vacío (blanda; el usuario reparte)", () => {
    expect(defaultReservasDurasUnaOt(["98023", "98024"], 2000)).toEqual({});
  });

  it("stock libre → vacío", () => {
    expect(defaultReservasDurasUnaOt(["98023"], 2000, true)).toEqual({});
  });

  it("sin hojas → vacío", () => {
    expect(defaultReservasDurasUnaOt(["98023"], 0)).toEqual({});
  });
});

describe("syncReservaDuraConCantidad", () => {
  it("alinea si coincidía con la cantidad anterior", () => {
    expect(
      syncReservaDuraConCantidad({
        ots: ["98023"],
        reservas: { "98023": "2000" },
        cantidadAnterior: 2000,
        cantidadNueva: 1800,
      }),
    ).toEqual({ "98023": "1800" });
  });

  it("rellena si estaba blanda/vacía", () => {
    expect(
      syncReservaDuraConCantidad({
        ots: ["98023"],
        reservas: {},
        cantidadAnterior: 2000,
        cantidadNueva: 2000,
      }),
    ).toEqual({ "98023": "2000" });
  });

  it("no pisa reserva parcial manual", () => {
    expect(
      syncReservaDuraConCantidad({
        ots: ["98023"],
        reservas: { "98023": "1500" },
        cantidadAnterior: 2000,
        cantidadNueva: 1800,
      }),
    ).toEqual({ "98023": "1500" });
  });
});
