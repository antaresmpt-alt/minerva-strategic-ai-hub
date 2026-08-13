import { describe, expect, it } from "vitest";

import {
  ejecucionBloqueaDerivarAExterna,
  findPasoImpresionInternaParaDerivar,
  puedeDerivarImpresionExterna,
  puedeMostrarImprimirFueraMesa,
} from "@/lib/derivar-impresion-externa";

describe("puedeDerivarImpresionExterna", () => {
  it("permite Offset/Digital aunque esté en mesa o en cola (si no ha iniciado)", () => {
    expect(
      puedeDerivarImpresionExterna({
        otTipo: "simple",
        proximoPasoProcesoId: 1,
      }),
    ).toBe(true);
    expect(
      puedeDerivarImpresionExterna({
        otTipo: "simple",
        proximoPasoProcesoId: 2,
      }),
    ).toBe(true);
    expect(
      puedeDerivarImpresionExterna({
        otTipo: "contenedor",
        proximoPasoProcesoId: 1,
      }),
    ).toBe(false);
    expect(
      puedeDerivarImpresionExterna({
        otTipo: "simple",
        proximoPasoProcesoId: 16,
      }),
    ).toBe(false);
  });
});

describe("ejecucionBloqueaDerivarAExterna", () => {
  it("bloquea solo si ya picó inicio o está pausada", () => {
    expect(ejecucionBloqueaDerivarAExterna(null)).toBe(false);
    expect(ejecucionBloqueaDerivarAExterna("pendiente_inicio")).toBe(false);
    expect(ejecucionBloqueaDerivarAExterna("en_curso")).toBe(true);
    expect(ejecucionBloqueaDerivarAExterna("pausada")).toBe(true);
  });
});

describe("puedeMostrarImprimirFueraMesa", () => {
  it("sale en Offset/Digital confirmada o pendiente de inicio, no si ya arrancó", () => {
    expect(
      puedeMostrarImprimirFueraMesa({
        maquinaTipo: "impresion",
        estadoMesa: "confirmado",
        estadoEjecucion: null,
      }),
    ).toBe(true);
    expect(
      puedeMostrarImprimirFueraMesa({
        maquinaTipo: "digital",
        estadoMesa: "en_ejecucion",
        estadoEjecucion: "pendiente_inicio",
      }),
    ).toBe(true);
    expect(
      puedeMostrarImprimirFueraMesa({
        maquinaTipo: "impresion",
        estadoMesa: "en_ejecucion",
        estadoEjecucion: "en_curso",
      }),
    ).toBe(false);
    expect(
      puedeMostrarImprimirFueraMesa({
        maquinaTipo: "guillotina",
        estadoMesa: "en_ejecucion",
        estadoEjecucion: "pendiente_inicio",
      }),
    ).toBe(false);
  });
});

describe("findPasoImpresionInternaParaDerivar", () => {
  it("sustituye Offset disponible aunque CTP ya esté finalizado", () => {
    const found = findPasoImpresionInternaParaDerivar([
      { id: "ctp", procesoId: 16, estado: "finalizado", orden: 1 },
      { id: "off", procesoId: 1, estado: "disponible", orden: 2 },
      { id: "troq", procesoId: 10, estado: "pendiente", orden: 3 },
    ]);
    expect(found?.id).toBe("off");
    expect(found?.procesoId).toBe(1);
  });

  it("no deriva si el próximo disponible es CTP", () => {
    expect(
      findPasoImpresionInternaParaDerivar([
        { id: "ctp", procesoId: 16, estado: "disponible", orden: 1 },
        { id: "off", procesoId: 1, estado: "pendiente", orden: 2 },
      ]),
    ).toBeNull();
  });

  it("no deriva si ya hay Impresión EXTERNA abierta", () => {
    expect(
      findPasoImpresionInternaParaDerivar([
        { id: "ext", procesoId: 21, estado: "disponible", orden: 2 },
      ]),
    ).toBeNull();
  });
});
