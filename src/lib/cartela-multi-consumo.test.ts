import { describe, expect, it } from "vitest";

import {
  applyCartelaConsumosToDatos,
  parseCartelaConsumosLineasFromDatos,
  buildCartelaCamposVista,
} from "@/lib/cartela-ejecucion";
import {
  cartelaConsumoCompleto,
  parseCartelaConsumoFromDatos,
  validarCartelaConsumoAntesCerrar,
} from "@/lib/cartela-stock-consumo";

describe("multi-cartela consumo", () => {
  it("legacy 1 cartela sigue parseándose", () => {
    const datos = {
      id_stock_cartela: 10234,
      cartela_hojas_consumidas: 300,
    };
    const lineas = parseCartelaConsumosLineasFromDatos(datos);
    expect(lineas).toEqual([
      expect.objectContaining({ id_stock: 10234, hojas: 300 }),
    ]);
    expect(cartelaConsumoCompleto(datos)).toBe(true);
  });

  it("guarda N consumos y sincroniza total en legacy", () => {
    const next = applyCartelaConsumosToDatos(
      {},
      [
        { id_stock: 10234, hojas: 300, palet_id: "p1" },
        { id_stock: 10235, hojas: 1400, palet_id: "p2" },
      ],
    );
    expect(next.cartela_consumos).toHaveLength(2);
    expect(next.id_stock_cartela).toBe(10234);
    expect(next.cartela_hojas_consumidas).toBe(1700);
    expect(parseCartelaConsumosLineasFromDatos(next)).toHaveLength(2);
    expect(parseCartelaConsumoFromDatos(next).hojas).toBe(1700);
  });

  it("valida línea incompleta y duplicados", () => {
    expect(
      validarCartelaConsumoAntesCerrar({
        cartela_consumos: [{ id_stock: 10234 }],
      }),
    ).toMatch(/hojas/i);

    expect(
      validarCartelaConsumoAntesCerrar({
        cartela_consumos: [
          { id_stock: 10234, hojas: 300 },
          { id_stock: 10234, hojas: 100 },
        ],
      }),
    ).toMatch(/repetida/i);

    expect(
      validarCartelaConsumoAntesCerrar({
        cartela_consumos: [
          { id_stock: 10234, hojas: 300 },
          { id_stock: 10235, hojas: 1400 },
        ],
      }),
    ).toBeNull();
  });

  it("vista multi lista cada consumo", () => {
    const datos = applyCartelaConsumosToDatos(
      {},
      [
        { id_stock: 10234, hojas: 300, material_real: "Folding 350" },
        { id_stock: 10235, hojas: 1400 },
      ],
    );
    const campos = buildCartelaCamposVista(1, datos);
    expect(campos.some((c) => c.label === "Cartelas consumidas")).toBe(true);
    expect(campos.filter((c) => c.label.startsWith("Consumo")).length).toBe(2);
  });
});
