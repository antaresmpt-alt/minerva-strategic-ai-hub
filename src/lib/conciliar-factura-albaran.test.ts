import { describe, expect, it } from "vitest";

import {
  importeFacturaLineaRecepcion,
  prorratearImporteFacturaPorHojas,
} from "@/lib/conciliar-factura-albaran";

describe("prorratearImporteFacturaPorHojas", () => {
  it("reparte por hojas y cuadra el total", () => {
    const palets = [
      { id: "a", cantidad_inicial: 600 },
      { id: "b", cantidad_inicial: 400 },
    ];
    const map = prorratearImporteFacturaPorHojas(1000, palets);
    expect(map.get("a")).toBe(600);
    expect(map.get("b")).toBe(400);
    expect([...map.values()].reduce((s, v) => s + v, 0)).toBe(1000);
  });

  it("ajusta céntimos en el último palet", () => {
    const palets = [
      { id: "a", cantidad_inicial: 333 },
      { id: "b", cantidad_inicial: 333 },
      { id: "c", cantidad_inicial: 334 },
    ];
    const map = prorratearImporteFacturaPorHojas(100, palets);
    expect([...map.values()].reduce((s, v) => s + v, 0)).toBe(100);
  });
});

describe("importeFacturaLineaRecepcion", () => {
  it("calcula la parte proporcional de la línea", () => {
    expect(importeFacturaLineaRecepcion(1000, 600, 1000)).toBe(600);
    expect(importeFacturaLineaRecepcion(1000, 400, 1000)).toBe(400);
  });
});
