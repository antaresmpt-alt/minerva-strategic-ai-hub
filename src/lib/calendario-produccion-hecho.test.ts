import { describe, expect, it } from "vitest";

import {
  enrichEntradasHechoVisual,
  filtrarEntradasSoloPendientes,
  pastillaHechaVisual,
  type CalendarioProduccionLinea,
} from "@/lib/calendario-produccion";

function linea(
  partial: Partial<CalendarioProduccionLinea> & { otNumero: string },
): CalendarioProduccionLinea {
  return {
    id: partial.id ?? partial.otNumero,
    otNumero: partial.otNumero,
    ambito: partial.ambito ?? "impresion",
    label: partial.label ?? `I·${partial.otNumero}`,
    trabajo: partial.trabajo ?? "T",
    orden: partial.orden ?? 0,
    marcadoHecho: partial.marcadoHecho ?? false,
    hechoVisual: partial.hechoVisual,
  };
}

describe("pastillaHechaVisual", () => {
  it("manual o HR hecho", () => {
    expect(pastillaHechaVisual(true, "listo")).toBe(true);
    expect(pastillaHechaVisual(false, "hecho")).toBe(true);
    expect(pastillaHechaVisual(false, "listo")).toBe(false);
    expect(pastillaHechaVisual(false, "esperando")).toBe(false);
  });
});

describe("enrich + solo pendientes", () => {
  it("enriquece hechoVisual desde semáforo y filtra", () => {
    const byDay = new Map([
      [
        "2026-08-05",
        [
          linea({ otNumero: "99910", marcadoHecho: false }),
          linea({ otNumero: "36169", marcadoHecho: true }),
          linea({ otNumero: "35000", marcadoHecho: false }),
        ],
      ],
    ]);
    const enriched = enrichEntradasHechoVisual(byDay, (ot) => {
      if (ot === "99910") return "hecho";
      if (ot === "36169") return "listo";
      return "esperando";
    });
    const rows = enriched.get("2026-08-05")!;
    expect(rows.find((r) => r.otNumero === "99910")?.hechoVisual).toBe(true);
    expect(rows.find((r) => r.otNumero === "36169")?.hechoVisual).toBe(true);
    expect(rows.find((r) => r.otNumero === "35000")?.hechoVisual).toBe(false);

    const pending = filtrarEntradasSoloPendientes(enriched, true);
    expect(pending.get("2026-08-05")?.map((r) => r.otNumero)).toEqual(["35000"]);
  });
});
