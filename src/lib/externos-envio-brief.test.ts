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
    expect(brief.hojasNetasSugeridas).toBe(1100);
    expect(brief.hojasNetasSugeridasOrigen).toMatch(/brutas/i);
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
    expect(brief.hojasSugeridas).toBe(3200);
    expect(brief.hojasSugeridasOrigen).toMatch(/brutas/i);
    expect(brief.hojasNetasSugeridas).toBe(3200);
  });

  it("ignora el 200 del plan en seguimiento hasta que el envío esté confirmado", () => {
    const brief = resolveExternoEnvioBrief({
      despacho: {
        material: "Folding",
        gramaje: 350,
        tamanoHoja: "65x92",
        tintas: "4",
        hojasNetas: 200,
        hojasBrutas: 1000,
      },
      pasos: [
        {
          id: "g",
          orden: 2,
          procesoId: 17,
          estado: "finalizado",
          datosProceso: { tamano_final: "65x46", hojas_finales: 2000 },
        },
        {
          id: "ext",
          orden: 3,
          procesoId: 21,
          estado: "disponible",
          datosProceso: null,
        },
      ],
      currentPasoId: "ext",
      hojasYaEnSeguimiento: 200,
      envioYaConfirmado: false,
    });
    expect(brief.hojasSugeridas).toBe(2000);
    expect(brief.hojasSugeridasOrigen).toMatch(/Guillotina/i);
    expect(brief.hojasNetasSugeridas).toBe(2000);
  });

  it("reutiliza hojas del seguimiento si el envío ya está confirmado", () => {
    const brief = resolveExternoEnvioBrief({
      despacho: {
        material: "Folding",
        gramaje: 350,
        tamanoHoja: "65x92",
        tintas: "4",
        hojasNetas: 200,
        hojasBrutas: 1000,
      },
      pasos: [
        {
          id: "g",
          orden: 2,
          procesoId: 17,
          estado: "finalizado",
          datosProceso: { hojas_finales: 2000 },
        },
        {
          id: "ext",
          orden: 3,
          procesoId: 21,
          estado: "disponible",
          datosProceso: { hojas_netas: 1800 },
        },
      ],
      currentPasoId: "ext",
      hojasYaEnSeguimiento: 1950,
      envioYaConfirmado: true,
      hojasNetasYaInformadas: 1800,
    });
    expect(brief.hojasSugeridas).toBe(1950);
    expect(brief.hojasNetasSugeridas).toBe(1800);
    expect(brief.hojasNetasSugeridasOrigen).toMatch(/informado/i);
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
