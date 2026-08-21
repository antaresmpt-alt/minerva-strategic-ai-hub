import { describe, expect, it } from "vitest";

import { derivePastillaEspejo } from "@/lib/calendario-mesa-espejo";
import type { CalendarioItinerarioOt } from "@/lib/calendario-produccion-progreso";

describe("derivePastillaEspejo", () => {
  const itinerarioListo: CalendarioItinerarioOt = {
    progreso: "sin_empezar",
    pasos: [
      {
        orden: 1,
        estado: "disponible",
        nombre: "CTP",
        ambito: null,
      },
      {
        orden: 2,
        estado: "pendiente",
        nombre: "Offset",
        ambito: "impresion",
      },
    ],
  };

  it("planificada sin pool ni mesa", () => {
    const e = derivePastillaEspejo({
      ambito: "impresion",
      fechaCalendario: "2026-08-20",
      itinerario: itinerarioListo,
      espejo: undefined,
    });
    expect(e.fase).toBe("planificada");
    expect(e.badge).toBe("");
  });

  it("en cola cuando pool enviada_mesa", () => {
    const e = derivePastillaEspejo({
      ambito: "impresion",
      fechaCalendario: "2026-08-20",
      itinerario: itinerarioListo,
      espejo: { poolEstado: "enviada_mesa", mesaTrabajos: [] },
    });
    expect(e.fase).toBe("en_cola");
    expect(e.badge).toBe("En cola");
  });

  it("en mesa con fecha distinta marca difiere", () => {
    const e = derivePastillaEspejo({
      ambito: "impresion",
      fechaCalendario: "2026-08-20",
      itinerario: itinerarioListo,
      espejo: {
        poolEstado: "enviada_mesa",
        mesaTrabajos: [
          {
            otNumero: "90001",
            fechaPlanificada: "2026-08-22",
            turno: "tarde",
            maquinaId: "m1",
            maquinaNombre: "SM74",
            tipoMaquina: "impresion",
            estadoMesa: "borrador",
          },
        ],
      },
    });
    expect(e.fase).toBe("en_mesa");
    expect(e.fechaDifiere).toBe(true);
    expect(e.badge).toContain("≠");
  });

  it("no confunde troquel de mesa con pastilla impresión", () => {
    const e = derivePastillaEspejo({
      ambito: "impresion",
      fechaCalendario: "2026-08-20",
      itinerario: itinerarioListo,
      espejo: {
        poolEstado: "enviada_mesa",
        mesaTrabajos: [
          {
            otNumero: "90001",
            fechaPlanificada: "2026-08-22",
            turno: null,
            maquinaId: "t1",
            maquinaNombre: "JR",
            tipoMaquina: "troquelado",
            estadoMesa: "borrador",
          },
        ],
      },
    });
    expect(e.fase).toBe("en_cola");
    expect(e.fechaDifiere).toBe(false);
  });

  it("hecha gana sobre mesa", () => {
    const e = derivePastillaEspejo({
      ambito: "impresion",
      fechaCalendario: "2026-08-20",
      itinerario: {
        progreso: "completa",
        pasos: [
          {
            orden: 2,
            estado: "finalizado",
            nombre: "Offset",
            ambito: "impresion",
          },
        ],
      },
      espejo: {
        poolEstado: "enviada_mesa",
        mesaTrabajos: [
          {
            otNumero: "90001",
            fechaPlanificada: "2026-08-22",
            turno: null,
            maquinaId: "m1",
            maquinaNombre: "SM74",
            tipoMaquina: "impresion",
            estadoMesa: "en_ejecucion",
          },
        ],
      },
    });
    expect(e.fase).toBe("hecha");
  });
});
