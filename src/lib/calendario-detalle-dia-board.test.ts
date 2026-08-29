import { describe, expect, it } from "vitest";

import {
  applyDetalleBoardTransition,
  detalleDiaDialogMaxWidth,
  draftByMaquinaFromBoard,
  lineaToPoolOt,
} from "@/lib/calendario-detalle-dia-board";
import { dailySlotKey } from "@/lib/planificacion-mesa-diaria";
import { POOL_CONTAINER_ID } from "@/components/produccion/planificacion/mesa/turno-column";
import { dailyContainerId } from "@/lib/planificacion-mesa-diaria";
import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";

describe("calendario-detalle-dia-board", () => {
  it("detalleDiaDialogMaxWidth crece con columnas visibles", () => {
    expect(detalleDiaDialogMaxWidth(1)).toContain("56rem");
    expect(detalleDiaDialogMaxWidth(2)).toContain("72rem");
    expect(detalleDiaDialogMaxWidth(4)).toContain("120rem");
  });

  const dayYmd = "2026-08-29";
  const maqA = "maq-a";
  const maqB = "maq-b";
  const visibleSlotKeys = [
    dailySlotKey(maqA, "manana"),
    dailySlotKey(maqA, "tarde"),
    dailySlotKey(maqB, "manana"),
    dailySlotKey(maqB, "tarde"),
  ];

  const linea = (ot: string, id: string): CalendarioProduccionLinea => ({
    id,
    otNumero: ot,
    ambito: "troquelado",
    label: ot,
    trabajo: "Test",
    orden: 1,
    marcadoHecho: false,
  });

  it("mueve del pool a columna con slot", () => {
    const pool = lineaToPoolOt(linea("98024", "cal-1"));
    const poolByOt = new Map([["98024", pool]]);
    const lineaIdByOt = new Map([["98024", "cal-1"]]);
    const currentBySlot = Object.fromEntries(
      visibleSlotKeys.map((k) => [k, []]),
    ) as Record<string, never[]>;

    const t = applyDetalleBoardTransition({
      activeContainer: POOL_CONTAINER_ID,
      activeId: "pool::98024",
      overContainer: dailyContainerId(maqA, "manana"),
      overId: null,
      currentBySlot,
      visibleSlotKeys,
      dayYmd,
      poolByOt,
      lineaIdByOt,
      otsPlaced: new Set(),
    });

    expect(t).not.toBeNull();
    const list = t!.next[dailySlotKey(maqA, "manana")]!;
    expect(list).toHaveLength(1);
    expect(list[0]!.ot).toBe("98024");
    expect(list[0]!.maquinaId).toBe(maqA);
    expect(list[0]!.slotOrden).toBe(1);
  });

  it("draftByMaquina agrupa por máquina y turno", () => {
    const bySlot = {
      [dailySlotKey(maqA, "manana")]: [
        {
          id: "cal-1",
          ot: "98024",
          maquinaId: maqA,
          fechaPlanificada: dayYmd,
          turno: "manana" as const,
          slotOrden: 1,
          estadoMesa: "borrador",
          fechaEntrega: null,
          materialStatus: "rojo",
          troquelStatus: "no_aplica",
          acabadoPralSnapshot: "—",
          clienteSnapshot: "—",
          papelSnapshot: "—",
          tintasSnapshot: "—",
          barnizSnapshot: null,
          numHojasBrutasSnapshot: 0,
          horasPlanificadasSnapshot: 1,
        },
      ],
      [dailySlotKey(maqA, "tarde")]: [],
      [dailySlotKey(maqB, "manana")]: [],
      [dailySlotKey(maqB, "tarde")]: [],
    };
    const draft = draftByMaquinaFromBoard(bySlot, [maqA, maqB]);
    expect(draft.get(maqA)).toHaveLength(1);
    expect(draft.get(maqA)![0]!.otNumero).toBe("98024");
    expect(draft.get(maqB)).toHaveLength(0);
  });
});
