import { describe, expect, it } from "vitest";

import { collectEntradasAtrasadas } from "@/lib/calendario-produccion";
import {
  guillotinaStatusFromPasos,
  labelGuillotinaStatus,
} from "@/lib/calendario-produccion-progreso";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";

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
    hechoVisual: partial.hechoVisual ?? false,
  };
}

describe("collectEntradasAtrasadas", () => {
  it("solo fechas &lt; hoy y no hechas", () => {
    const byDay = new Map([
      ["2026-08-25", [linea({ otNumero: "1" }), linea({ otNumero: "2", hechoVisual: true })]],
      ["2026-08-27", [linea({ otNumero: "3" })]],
      ["2026-08-28", [linea({ otNumero: "4" })]],
    ]);
    const atrasadas = collectEntradasAtrasadas(byDay, "2026-08-27");
    expect(atrasadas.map((a) => a.otNumero)).toEqual(["1"]);
    expect(atrasadas[0]?.fechaYmd).toBe("2026-08-25");
  });
});

describe("guillotinaStatusFromPasos", () => {
  it("detecta hecha / pendiente / sin_paso", () => {
    expect(guillotinaStatusFromPasos([])).toBe("sin_paso");
    expect(
      guillotinaStatusFromPasos([
        { orden: 1, estado: "finalizado", nombre: "Guillotina", ambito: null },
      ]),
    ).toBe("hecha");
    expect(
      guillotinaStatusFromPasos([
        { orden: 1, estado: "disponible", nombre: "Guillotina", ambito: null },
      ]),
    ).toBe("listo");
    expect(
      guillotinaStatusFromPasos([
        { orden: 1, estado: "pendiente", nombre: "Guillotina", ambito: null },
      ]),
    ).toBe("pendiente");
    expect(labelGuillotinaStatus("hecha")).toBe("G: hecha");
  });
});
