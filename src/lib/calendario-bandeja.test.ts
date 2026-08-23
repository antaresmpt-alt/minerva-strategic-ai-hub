import { describe, expect, it } from "vitest";

import {
  buildPillsSet,
  cadenaUpstreamOk,
  colocadoOHecho,
  filterBandejaRows,
  pillKey,
  type CalendarioBandejaPillKey,
} from "@/lib/calendario-bandeja";
import type { CalendarioItinerarioOt } from "@/lib/calendario-produccion-progreso";

const paso = (
  ambito: "impresion" | "digital" | "troquelado" | "engomado",
  estado: string,
) => ({
  orden: 1,
  nombre: ambito,
  estado,
  ambito,
});

function itin(pasos: ReturnType<typeof paso>[]): CalendarioItinerarioOt {
  return { progreso: "en_curso", pasos };
}

describe("calendario-bandeja", () => {
  it("pillKey y buildPillsSet", () => {
    expect(pillKey("impresion", "35904")).toBe("impresion:35904");
    const set = buildPillsSet([
      { ot_numero: "35904", ambito: "impresion" },
      { ot_numero: "35900", ambito: "digital" },
    ]);
    expect(set.has("impresion:35904" as CalendarioBandejaPillKey)).toBe(true);
  });

  it("colocadoOHecho — pastilla o finalizado", () => {
    const pills = new Set<CalendarioBandejaPillKey>(["impresion:100" as CalendarioBandejaPillKey]);
    const pasosHecho = [paso("impresion", "finalizado")];
    const pasosPend = [paso("impresion", "disponible")];
    expect(colocadoOHecho(pasosHecho, pills, "impresion", "100")).toBe(true);
    expect(colocadoOHecho(pasosHecho, new Set(), "impresion", "100")).toBe(true);
    expect(colocadoOHecho(pasosPend, new Set(), "impresion", "200")).toBe(false);
  });

  it("cadenaUpstreamOk — troquel requiere I o D colocado/hecho", () => {
    const pills = new Set<CalendarioBandejaPillKey>();
    const pasos = [paso("impresion", "disponible"), paso("troquelado", "pendiente")];
    expect(cadenaUpstreamOk("troquelado", "OT1", pasos, pills)).toBe(false);
    pills.add("impresion:OT1" as CalendarioBandejaPillKey);
    expect(cadenaUpstreamOk("troquelado", "OT1", pasos, pills)).toBe(true);
  });

  it("cadenaUpstreamOk — engomado requiere T", () => {
    const pills = new Set<CalendarioBandejaPillKey>();
    const pasos = [
      paso("impresion", "finalizado"),
      paso("troquelado", "disponible"),
      paso("engomado", "pendiente"),
    ];
    expect(cadenaUpstreamOk("engomado", "OT2", pasos, pills)).toBe(false);
    pills.add("troquelado:OT2" as CalendarioBandejaPillKey);
    expect(cadenaUpstreamOk("engomado", "OT2", pasos, pills)).toBe(true);
  });

  it("filterBandejaRows — sin pastilla, con cadena", () => {
    const pills = new Set<CalendarioBandejaPillKey>();
    const itinerarioByOt = new Map<string, CalendarioItinerarioOt>([
      [
        "35904",
        itin([paso("impresion", "disponible"), paso("troquelado", "pendiente")]),
      ],
      ["35900", itin([paso("digital", "disponible")])],
    ]);

    const rows = filterBandejaRows({
      ambito: "impresion",
      verTodas: false,
      mostrarPruebas: true,
      filtroTexto: "",
      pills,
      itinerarioByOt,
      candidatos: [
        {
          otNumero: "35904",
          cliente: "LAB",
          trabajo: "EXP",
          fechaEntrega: "2026-06-19",
          despachadoAt: "2026-08-20",
        },
        {
          otNumero: "35900",
          cliente: "X",
          trabajo: "Y",
          fechaEntrega: null,
          despachadoAt: null,
        },
      ],
    });

    expect(rows.map((r) => r.otNumero)).toEqual(["35904"]);

    const digital = filterBandejaRows({
      ambito: "digital",
      verTodas: false,
      mostrarPruebas: true,
      filtroTexto: "",
      pills,
      itinerarioByOt,
      candidatos: [
        {
          otNumero: "35900",
          cliente: "X",
          trabajo: "Y",
          fechaEntrega: null,
          despachadoAt: null,
        },
      ],
    });
    expect(digital.map((r) => r.otNumero)).toEqual(["35900"]);

    const troquel = filterBandejaRows({
      ambito: "troquelado",
      verTodas: false,
      mostrarPruebas: true,
      filtroTexto: "",
      pills,
      itinerarioByOt,
      candidatos: [
        {
          otNumero: "35904",
          cliente: "LAB",
          trabajo: "EXP",
          fechaEntrega: null,
          despachadoAt: null,
        },
      ],
    });
    expect(troquel).toHaveLength(0);

    pills.add("impresion:35904" as CalendarioBandejaPillKey);
    const troquelOk = filterBandejaRows({
      ambito: "troquelado",
      verTodas: false,
      mostrarPruebas: true,
      filtroTexto: "",
      pills,
      itinerarioByOt,
      candidatos: [
        {
          otNumero: "35904",
          cliente: "LAB",
          trabajo: "EXP",
          fechaEntrega: null,
          despachadoAt: null,
        },
      ],
    });
    expect(troquelOk).toHaveLength(1);
  });

  it("filterBandejaRows — oculta OT con pastilla", () => {
    const pills = new Set<CalendarioBandejaPillKey>([
      "impresion:35904" as CalendarioBandejaPillKey,
    ]);
    const rows = filterBandejaRows({
      ambito: "impresion",
      verTodas: true,
      mostrarPruebas: true,
      filtroTexto: "",
      pills,
      itinerarioByOt: new Map([
        ["35904", itin([paso("impresion", "disponible")])],
      ]),
      candidatos: [
        {
          otNumero: "35904",
          cliente: null,
          trabajo: null,
          fechaEntrega: null,
          despachadoAt: null,
        },
      ],
    });
    expect(rows).toHaveLength(0);
  });
});
