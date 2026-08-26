import { describe, expect, it } from "vitest";

import {
  compareConPlanHoy,
  renumberDraftTurno,
  seedDraftFromCalendarioLineas,
  sortDetalleBySlot,
  tipoMaquinaForCalendarioAmbito,
} from "@/lib/calendario-detalle-dia";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import type { ProdCalendarioDetalleDiaRow } from "@/types/prod-calendario-detalle-dia";

function row(
  partial: Partial<ProdCalendarioDetalleDiaRow> & {
    ot_numero: string;
    slot_orden: number;
  },
): ProdCalendarioDetalleDiaRow {
  return {
    id: partial.id ?? partial.ot_numero,
    calendario_ot_id: partial.calendario_ot_id ?? `cal-${partial.ot_numero}`,
    ambito: partial.ambito ?? "impresion",
    ot_numero: partial.ot_numero,
    maquina_id: partial.maquina_id ?? null,
    turno: partial.turno ?? "manana",
    slot_orden: partial.slot_orden,
    horas_planificadas_snapshot: null,
    notas: null,
    created_by: null,
    created_at: "",
    updated_at: "",
  };
}

function linea(
  ot: string,
  orden: number,
  hecho = false,
): CalendarioProduccionLinea {
  return {
    id: `id-${ot}`,
    otNumero: ot,
    ambito: "impresion",
    label: ot,
    trabajo: "T",
    orden,
    marcadoHecho: hecho,
    hechoVisual: hecho,
  };
}

describe("calendario-detalle-dia", () => {
  it("tipo máquina = ámbito", () => {
    expect(tipoMaquinaForCalendarioAmbito("impresion")).toBe("impresion");
  });

  it("sortDetalleBySlot", () => {
    const sorted = sortDetalleBySlot([
      row({ ot_numero: "2", slot_orden: 2 }),
      row({ ot_numero: "1", slot_orden: 1 }),
    ]);
    expect(sorted.map((r) => r.ot_numero)).toEqual(["1", "2"]);
  });

  it("seed omite hechas si hay pendientes", () => {
    const seed = seedDraftFromCalendarioLineas(
      [linea("A", 0), linea("B", 1, true), linea("C", 2)],
      [linea("A", 0), linea("C", 2)],
    );
    expect(seed.map((s) => s.otNumero)).toEqual(["A", "C"]);
    expect(seed.every((s) => s.turno === "manana")).toBe(true);
  });

  it("renumberDraftTurno", () => {
    const next = renumberDraftTurno(
      [
        { calendarioOtId: "1", otNumero: "1", turno: "manana", slotOrden: 5 },
        { calendarioOtId: "2", otNumero: "2", turno: "tarde", slotOrden: 1 },
        { calendarioOtId: "3", otNumero: "3", turno: "manana", slotOrden: 9 },
      ],
      "manana",
    );
    const man = next
      .filter((d) => d.turno === "manana")
      .sort((a, b) => a.slotOrden - b.slotOrden);
    expect(man.map((d) => d.slotOrden)).toEqual([1, 2]);
  });

  it("compareConPlanHoy prioriza plan", () => {
    const slots = new Map([["10", 2], ["20", 1]]);
    const a = { otNumero: "30", fechaEntrega: "2026-01-01" };
    const b = { otNumero: "20", fechaEntrega: "2026-12-01" };
    const c = { otNumero: "10", fechaEntrega: "2026-12-01" };
    expect(compareConPlanHoy(b, a, slots)).toBeLessThan(0);
    expect(compareConPlanHoy(b, c, slots)).toBeLessThan(0);
  });
});
