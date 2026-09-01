import { describe, expect, it } from "vitest";

import {
  idsEditablesCalendarioDia,
  planMoverCalendarioLote,
  type CalendarioProduccionLinea,
} from "@/lib/calendario-produccion";

function linea(
  partial: Partial<CalendarioProduccionLinea> & { otNumero: string },
): CalendarioProduccionLinea {
  return {
    id: partial.id ?? `id-${partial.otNumero}`,
    otNumero: partial.otNumero,
    ambito: partial.ambito ?? "impresion",
    label: partial.label ?? partial.otNumero,
    trabajo: partial.trabajo ?? "T",
    orden: partial.orden ?? 0,
    marcadoHecho: partial.marcadoHecho ?? false,
  };
}

describe("idsEditablesCalendarioDia", () => {
  it("solo el ámbito activo", () => {
    const ids = idsEditablesCalendarioDia(
      [
        linea({ otNumero: "1", ambito: "impresion" }),
        linea({ otNumero: "2", ambito: "troquel" }),
        linea({ otNumero: "3", ambito: "impresion" }),
      ],
      "impresion",
    );
    expect(ids).toEqual(["id-1", "id-3"]);
  });
});

describe("planMoverCalendarioLote", () => {
  const source = [
    linea({ otNumero: "10", orden: 0 }),
    linea({ otNumero: "20", orden: 1 }),
    linea({ otNumero: "30", orden: 2, ambito: "troquel" }),
    linea({ otNumero: "40", orden: 3 }),
  ];

  it("respeta el orden del día origen y continúa el orden destino", () => {
    const plan = planMoverCalendarioLote({
      selectedIds: ["id-40", "id-10"],
      fromFecha: "2026-09-03",
      destFecha: "2026-09-04",
      ambito: "impresion",
      sourceLineas: source,
      destOtNumerosMismoAmbito: new Set(),
      startOrden: 5,
    });
    expect(plan.toMove).toEqual([
      { id: "id-10", otNumero: "10", orden: 5 },
      { id: "id-40", otNumero: "40", orden: 6 },
    ]);
    expect(plan.skippedAlreadyThere).toEqual([]);
  });

  it("omite OTs que ya están en el destino y pastillas de otro ámbito", () => {
    const plan = planMoverCalendarioLote({
      selectedIds: ["id-10", "id-20", "id-30"],
      fromFecha: "2026-09-03",
      destFecha: "2026-09-04",
      ambito: "impresion",
      sourceLineas: source,
      destOtNumerosMismoAmbito: new Set(["20"]),
      startOrden: 0,
    });
    expect(plan.toMove.map((m) => m.otNumero)).toEqual(["10"]);
    expect(plan.skippedAlreadyThere).toEqual(["20"]);
  });

  it("no mueve si origen = destino", () => {
    const plan = planMoverCalendarioLote({
      selectedIds: ["id-10"],
      fromFecha: "2026-09-03",
      destFecha: "2026-09-03",
      ambito: "impresion",
      sourceLineas: source,
      destOtNumerosMismoAmbito: new Set(),
      startOrden: 0,
    });
    expect(plan.toMove).toEqual([]);
  });
});
