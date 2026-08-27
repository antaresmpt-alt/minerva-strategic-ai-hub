import { describe, expect, it } from "vitest";

import {
  buildCalendarioMaterialTooltip,
  resolveCalendarioMaterialStatus,
} from "@/lib/calendario-material-status";

describe("resolveCalendarioMaterialStatus", () => {
  it("gris si no despachada", () => {
    expect(
      resolveCalendarioMaterialStatus({
        despachada: false,
        hojasCarteladas: 1000,
        hojasObjetivo: 500,
        hojasRecibidas: 200,
      }),
    ).toBe("gris");
  });

  it("verde si cartelado ≥ objetivo", () => {
    expect(
      resolveCalendarioMaterialStatus({
        despachada: true,
        hojasCarteladas: 1000,
        hojasObjetivo: 1000,
        hojasRecibidas: 0,
      }),
    ).toBe("verde");
  });

  it("amarillo si cartelado parcial", () => {
    expect(
      resolveCalendarioMaterialStatus({
        despachada: true,
        hojasCarteladas: 200,
        hojasObjetivo: 1000,
        hojasRecibidas: 0,
      }),
    ).toBe("amarillo");
  });

  it("amarillo si solo muelle", () => {
    expect(
      resolveCalendarioMaterialStatus({
        despachada: true,
        hojasCarteladas: 0,
        hojasObjetivo: 1000,
        hojasRecibidas: 400,
      }),
    ).toBe("amarillo");
  });

  it("rojo si despachada sin cobertura", () => {
    expect(
      resolveCalendarioMaterialStatus({
        despachada: true,
        hojasCarteladas: 0,
        hojasObjetivo: 1000,
        hojasRecibidas: 0,
      }),
    ).toBe("rojo");
  });
});

describe("buildCalendarioMaterialTooltip", () => {
  it("incluye compra en tooltip", () => {
    const t = buildCalendarioMaterialTooltip({
      status: "amarillo",
      despachada: true,
      hojasCarteladas: 100,
      hojasObjetivo: 500,
      hojasRecibidas: 200,
      numCompra: "C-99",
      compraEstado: "Parcial",
    });
    expect(t).toContain("Compra C-99");
    expect(t).toContain("Parcial");
    expect(t).toContain("Cartelas");
  });
});
