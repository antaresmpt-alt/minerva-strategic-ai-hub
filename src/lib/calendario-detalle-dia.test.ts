import { describe, expect, it } from "vitest";

import {
  buildCalendarioOrdenUpdates,
  buildDetalleDiaBoardSavePlan,
  compareConPlanHoy,
  maquinaNombreConPlanDetalle,
  planHoyDetalleByOtFromRows,
  rankPlanHoyByOt,
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
    const slots = new Map([
      ["10", 2],
      ["20", 1],
    ]);
    const a = { otNumero: "30", fechaEntrega: "2026-01-01" };
    const b = { otNumero: "20", fechaEntrega: "2026-12-01" };
    const c = { otNumero: "10", fechaEntrega: "2026-12-01" };
    expect(compareConPlanHoy(b, a, slots)).toBeLessThan(0);
    expect(compareConPlanHoy(b, c, slots)).toBeLessThan(0);
  });

  it("rankPlanHoyByOt: mañana antes que tarde aunque slot tarde=1", () => {
    const ranks = rankPlanHoyByOt([
      row({ ot_numero: "36019", slot_orden: 1, turno: "manana" }),
      row({ ot_numero: "98025", slot_orden: 2, turno: "manana" }),
      row({ ot_numero: "98024", slot_orden: 3, turno: "manana" }),
      row({ ot_numero: "98023", slot_orden: 1, turno: "tarde" }),
    ]);
    expect(
      [...ranks.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([ot]) => ot),
    ).toEqual(["36019", "98025", "98024", "98023"]);
    expect(ranks.get("98023")).toBe(4);
    expect(ranks.get("98025")).toBe(2);
  });

  it("planHoyDetalleByOtFromRows incluye máquina y turno", () => {
    const detalle = planHoyDetalleByOtFromRows([
      row({
        ot_numero: "98002",
        slot_orden: 1,
        turno: "tarde",
        maquina_id: "maq-dayuan",
      }),
      row({
        ot_numero: "98024",
        slot_orden: 1,
        turno: "manana",
        maquina_id: "maq-jr",
      }),
    ]);
    expect(detalle.get("98002")).toMatchObject({
      rank: 2,
      maquinaId: "maq-dayuan",
      turno: "tarde",
    });
    expect(detalle.get("98024")).toMatchObject({
      rank: 1,
      maquinaId: "maq-jr",
      turno: "manana",
    });
    expect(
      maquinaNombreConPlanDetalle(
        "Troquelado (elegir al iniciar)",
        "Dayuan",
        "tarde",
      ),
    ).toBe("Dayuan · tarde");
  });

  it("buildCalendarioOrdenUpdates: mañana, tarde, sin secuencia", () => {
    const updates = buildCalendarioOrdenUpdates(
      [
        { calendarioOtId: "c-tarde", otNumero: "2", turno: "tarde", slotOrden: 1 },
        { calendarioOtId: "c-man", otNumero: "1", turno: "manana", slotOrden: 2 },
        { calendarioOtId: "c-man2", otNumero: "3", turno: "manana", slotOrden: 1 },
      ],
      ["c-pool"],
    );
    expect(updates).toEqual([
      { calendarioOtId: "c-man2", orden: 0 },
      { calendarioOtId: "c-man", orden: 1 },
      { calendarioOtId: "c-tarde", orden: 2 },
      { calendarioOtId: "c-pool", orden: 3 },
    ]);
  });

  it("buildDetalleDiaBoardSavePlan: borra fuera del tablero y renumerar slots", () => {
    const plan = buildDetalleDiaBoardSavePlan({
      ambito: "impresion",
      maquinaIds: ["maq-a"],
      draftByMaquina: new Map([
        [
          "maq-a",
          [
            {
              calendarioOtId: "cal-1",
              otNumero: "100",
              turno: "manana",
              slotOrden: 9,
            },
            {
              calendarioOtId: "cal-2",
              otNumero: "200",
              turno: "tarde",
              slotOrden: 3,
            },
          ],
        ],
      ]),
      savedRows: [
        row({
          calendario_ot_id: "cal-1",
          ot_numero: "100",
          slot_orden: 1,
          maquina_id: "maq-a",
        }),
        row({
          calendario_ot_id: "cal-old",
          ot_numero: "999",
          slot_orden: 1,
          maquina_id: "maq-a",
        }),
      ],
      unsequencedCalendarioOtIds: ["cal-pool"],
      createdBy: "user-1",
    });

    expect(plan.deleteIds).toEqual(["cal-old"]);
    expect(plan.upserts).toEqual([
      expect.objectContaining({
        calendarioOtId: "cal-1",
        maquinaId: "maq-a",
        turno: "manana",
        slotOrden: 1,
        createdBy: "user-1",
      }),
      expect.objectContaining({
        calendarioOtId: "cal-2",
        maquinaId: "maq-a",
        turno: "tarde",
        slotOrden: 1,
      }),
    ]);
    expect(plan.ordenUpdates).toEqual([
      { calendarioOtId: "cal-1", orden: 0 },
      { calendarioOtId: "cal-2", orden: 1 },
      { calendarioOtId: "cal-pool", orden: 2 },
    ]);
  });

  it("buildDetalleDiaBoardSavePlan: mover OT entre máquinas", () => {
    const plan = buildDetalleDiaBoardSavePlan({
      ambito: "impresion",
      maquinaIds: ["maq-a", "maq-b"],
      draftByMaquina: new Map([
        [
          "maq-b",
          [
            {
              calendarioOtId: "cal-move",
              otNumero: "50",
              turno: "manana",
              slotOrden: 1,
            },
          ],
        ],
      ]),
      savedRows: [
        row({
          calendario_ot_id: "cal-move",
          ot_numero: "50",
          slot_orden: 1,
          maquina_id: "maq-a",
        }),
      ],
      unsequencedCalendarioOtIds: [],
    });

    expect(plan.deleteIds).toContain("cal-move");
    expect(plan.upserts).toEqual([
      expect.objectContaining({
        calendarioOtId: "cal-move",
        maquinaId: "maq-b",
        slotOrden: 1,
      }),
    ]);
  });
});
