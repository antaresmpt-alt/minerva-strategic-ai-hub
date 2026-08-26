import { describe, expect, it } from "vitest";

import {
  sortDetalleBySlot,
  tipoMaquinaForCalendarioAmbito,
} from "@/lib/calendario-detalle-dia";
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

describe("calendario-detalle-dia", () => {
  it("tipo máquina = ámbito", () => {
    expect(tipoMaquinaForCalendarioAmbito("impresion")).toBe("impresion");
    expect(tipoMaquinaForCalendarioAmbito("troquelado")).toBe("troquelado");
  });

  it("sortDetalleBySlot", () => {
    const sorted = sortDetalleBySlot([
      row({ ot_numero: "2", slot_orden: 2 }),
      row({ ot_numero: "1", slot_orden: 1 }),
      row({ ot_numero: "3", slot_orden: 1 }),
    ]);
    expect(sorted.map((r) => r.ot_numero)).toEqual(["1", "3", "2"]);
  });
});
