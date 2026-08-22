import { describe, expect, it } from "vitest";

import {
  CONTENEDOR_SECCION_DEFS,
  contenedorSeccionVirtualId,
  isContenedorSeccionVirtualId,
  parseContenedorSeccionVirtualId,
  seccionesVisiblesParaTipoFiltro,
} from "@/lib/contenedor-seccion";

describe("contenedor-seccion", () => {
  it("builds and parses virtual ids for all kinds", () => {
    for (const def of CONTENEDOR_SECCION_DEFS) {
      const pasoId = "aecea240-1a06-484c-96c4-edefff81ec3c";
      const id = contenedorSeccionVirtualId(def.kind, pasoId);
      expect(isContenedorSeccionVirtualId(id)).toBe(true);
      expect(parseContenedorSeccionVirtualId(id)).toEqual({
        kind: def.kind,
        otPasoId: pasoId,
      });
    }
  });

  it("rejects non-virtual ids", () => {
    expect(isContenedorSeccionVirtualId("uuid-real")).toBe(false);
    expect(parseContenedorSeccionVirtualId("contenedor-engomado:")).toBeNull();
  });

  it("filters sections by planificacion tipo", () => {
    expect(seccionesVisiblesParaTipoFiltro(null)).toHaveLength(6);
    expect(seccionesVisiblesParaTipoFiltro("guillotina").map((d) => d.kind)).toEqual([
      "guillotina",
    ]);
    expect(seccionesVisiblesParaTipoFiltro("engomado").map((d) => d.kind)).toEqual([
      "manipulados",
      "engomado",
    ]);
    expect(seccionesVisiblesParaTipoFiltro("desbroce").map((d) => d.kind)).toEqual([
      "desbroce",
    ]);
    expect(seccionesVisiblesParaTipoFiltro("impresion").map((d) => d.kind)).toEqual([
      "impresion",
    ]);
    expect(seccionesVisiblesParaTipoFiltro("digital").map((d) => d.kind)).toEqual([
      "digital",
    ]);
  });
});
