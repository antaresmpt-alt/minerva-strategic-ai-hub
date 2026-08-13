import { describe, expect, it } from "vitest";

import {
  parseHojasPositive,
  resolveExternoEnvioBrief,
  resolveExternoRecibidoHojasSugeridas,
} from "@/lib/externos-envio-brief";

describe("parseHojasPositive", () => {
  it("acepta enteros y separador de miles", () => {
    expect(parseHojasPositive("1100")).toBe(1100);
    expect(parseHojasPositive("1.100")).toBe(1100);
    expect(parseHojasPositive("")).toBeNull();
    expect(parseHojasPositive("0")).toBeNull();
  });
});

describe("resolveExternoEnvioBrief", () => {
  it("prioriza impresión finalizada sobre despacho", () => {
    const brief = resolveExternoEnvioBrief({
      despacho: {
        material: "Folding",
        gramaje: 300,
        tamanoHoja: "72x102",
        tintas: "4",
        hojasNetas: 600,
        hojasBrutas: 800,
      },
      pasos: [
        {
          id: "g",
          orden: 1,
          procesoId: 17,
          estado: "finalizado",
          datosProceso: { tamano_final: "51x72", hojas_finales: 2100 },
        },
        {
          id: "i",
          orden: 2,
          procesoId: 1,
          estado: "finalizado",
          datosProceso: {
            formato_hojas: "51x72",
            material_impresion: "Folding blanco zenith",
            tintas_cara: "5",
            hojas_impresas: 1100,
          },
        },
        {
          id: "ext",
          orden: 3,
          procesoId: 3,
          estado: "disponible",
          datosProceso: null,
        },
      ],
      currentPasoId: "ext",
    });
    expect(brief.formato).toBe("51x72");
    expect(brief.material).toBe("Folding blanco zenith");
    expect(brief.tintas).toBe("5");
    expect(brief.hojasSugeridas).toBe(1100);
    expect(brief.hojasSugeridasOrigen).toMatch(/Impresión/i);
  });

  it("cae a despacho si no hay pasos útiles", () => {
    const brief = resolveExternoEnvioBrief({
      despacho: {
        material: "Folding",
        gramaje: 295,
        tamanoHoja: "65x92",
        tintas: "4",
        hojasNetas: 3000,
        hojasBrutas: 3200,
      },
      pasos: [],
    });
    expect(brief.formato).toBe("65x92");
    expect(brief.formatoOrigen).toMatch(/Despacho/);
    expect(brief.material).toBe("Folding 295g");
    expect(brief.tintas).toBe("4");
    expect(brief.hojasSugeridas).toBe(3000);
  });
});

describe("resolveExternoRecibidoHojasSugeridas", () => {
  it("prefiere muelle, luego enviadas", () => {
    expect(
      resolveExternoRecibidoHojasSugeridas({
        hojasEnviadas: 1100,
        hojasRecibidasMuelle: 1080,
      }),
    ).toEqual({ hojasSugeridas: 1080, hojasSugeridasOrigen: "Muelle / ya informado" });
    expect(
      resolveExternoRecibidoHojasSugeridas({ hojasEnviadas: 1100, hojasRecibidasMuelle: null }),
    ).toEqual({ hojasSugeridas: 1100, hojasSugeridasOrigen: "Hojas enviadas" });
  });
});
