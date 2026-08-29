import { describe, expect, it } from "vitest";

import {
  filterCandidatasBandeja,
  isOtMaestroAbierta,
  labelItinerarioEtiquetas,
  maquinaFlagsFromProcesoIds,
  mergePlanConCandidatas,
} from "@/lib/etiquetas-pool-entrada";

describe("etiquetas-pool-entrada", () => {
  it("maquinaFlagsFromProcesoIds", () => {
    expect(maquinaFlagsFromProcesoIds([18, 19])).toEqual({
      konica: true,
      troqueladora: true,
      numeradora: false,
    });
  });

  it("labelItinerarioEtiquetas", () => {
    expect(
      labelItinerarioEtiquetas({
        konica: true,
        troqueladora: false,
        numeradora: true,
      }),
    ).toBe("I·N");
  });

  it("isOtMaestroAbierta", () => {
    expect(isOtMaestroAbierta("En curso")).toBe(true);
    expect(isOtMaestroAbierta("Cerrada")).toBe(false);
    expect(isOtMaestroAbierta("Producida")).toBe(false);
  });

  it("filterCandidatasBandeja excluye HR y pool", () => {
    const maestroByOtId = new Map([
      [
        "id-1",
        {
          id: "id-1",
          num_pedido: "36001",
          cliente: "Cliente A",
          titulo: "Etiquetas vino",
          cantidad: 1000,
          fecha_entrega: "2026-09-01",
          estado_desc: "En curso",
          despachado: false,
        },
      ],
      [
        "id-2",
        {
          id: "id-2",
          num_pedido: "36002",
          cliente: "Cliente B",
          titulo: "Otra",
          cantidad: 500,
          fecha_entrega: "2026-09-05",
          estado_desc: "En curso",
          despachado: true,
        },
      ],
    ]);

    const candidatas = filterCandidatasBandeja({
      maestroByOtId,
      procesoIdsByOtId: new Map([
        ["id-1", [18]],
        ["id-2", [18, 19]],
      ]),
      enHojaRuta: new Set(["36002"]),
      enPool: new Set(),
      despachoByOt: new Map([
        ["36002", { ot_numero: "36002", material: "FEDRIGONI", despachado_at: "2026-08-20" }],
      ]),
      filtroTexto: "",
    });

    expect(candidatas).toHaveLength(1);
    expect(candidatas[0]?.otNumero).toBe("36001");
    expect(candidatas[0]?.despachada).toBe(false);
  });

  it("mergePlanConCandidatas mantiene orden", () => {
    const candidataByOt = new Map([
      [
        "36001",
        {
          otGeneralId: "id-1",
          otNumero: "36001",
          cliente: "A",
          trabajo: "T",
          cantidad: 1,
          fechaEntrega: "2026-09-01",
          despachada: true,
          despachadoAt: null,
          materialDespacho: "PAPEL",
          maquinas: maquinaFlagsFromProcesoIds([18]),
        },
      ],
    ]);

    const plan = mergePlanConCandidatas(
      [
        {
          id: "p1",
          ot_numero: "36001",
          orden: 1,
          created_at: "2026-08-29",
          updated_at: "2026-08-29",
        },
      ],
      candidataByOt,
    );

    expect(plan).toHaveLength(1);
    expect(plan[0]?.cliente).toBe("A");
    expect(plan[0]?.id).toBe("p1");
  });
});
