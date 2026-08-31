import { describe, expect, it } from "vitest";

import {
  buildEnCursoItems,
  filterCandidatasBandeja,
  isOtEstadoOptimusElegibleBandeja,
  isOtFechaMinimaBandeja,
  isOtMaestroAbierta,
  isOtMaestroEtiquetaDigital,
  labelItinerarioEtiquetas,
  maquinaFlagsFromProcesoIds,
  tieneItinerarioEtiquetasHugo,
  mergePlanConCandidatas,
  resolveSemaforoItinerario,
} from "@/lib/etiquetas-pool-entrada";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

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

  it("isOtMaestroEtiquetaDigital", () => {
    expect(isOtMaestroEtiquetaDigital({ tipo_pedido: "Etiqueta" })).toBe(true);
    expect(isOtMaestroEtiquetaDigital({ titulo: "ETIQUETA VINO" })).toBe(true);
    expect(isOtMaestroEtiquetaDigital({ tipo_pedido: "Offset" })).toBe(false);
  });

  it("isOtEstadoOptimusElegibleBandeja", () => {
    expect(isOtEstadoOptimusElegibleBandeja("En producción")).toBe(true);
    expect(isOtEstadoOptimusElegibleBandeja("Terminado")).toBe(false);
    expect(isOtEstadoOptimusElegibleBandeja("Cancelado")).toBe(false);
    expect(isOtEstadoOptimusElegibleBandeja("En curso")).toBe(true);
  });

  it("isOtFechaMinimaBandeja", () => {
    expect(
      isOtFechaMinimaBandeja({ fecha_entrega: "2025-12-14", fecha_apertura: null }),
    ).toBe(false);
    expect(
      isOtFechaMinimaBandeja({ fecha_entrega: "2025-12-15", fecha_apertura: null }),
    ).toBe(true);
    expect(
      isOtFechaMinimaBandeja({ fecha_entrega: "2026-03-01", fecha_apertura: null }),
    ).toBe(true);
    expect(
      isOtFechaMinimaBandeja({ fecha_entrega: null, fecha_apertura: "2026-02-01" }),
    ).toBe(true);
  });

  it("tieneItinerarioEtiquetasHugo exige paso Konica/Troq/Num", () => {
    expect(
      tieneItinerarioEtiquetasHugo(maquinaFlagsFromProcesoIds([18])),
    ).toBe(true);
    expect(
      tieneItinerarioEtiquetasHugo(maquinaFlagsFromProcesoIds([19, 20])),
    ).toBe(true);
    expect(
      tieneItinerarioEtiquetasHugo(
        maquinaFlagsFromProcesoIds([]),
      ),
    ).toBe(false);
  });

  it("resolveSemaforoItinerario asume I+T+N sin itinerario", () => {
    expect(
      resolveSemaforoItinerario({
        konica: false,
        troqueladora: false,
        numeradora: false,
      }),
    ).toEqual({ konica: true, troqueladora: true, numeradora: true });
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
          fechaEntrega: "2026-09-01",
          fecha_apertura: "2026-08-28",
          estado_desc: "En producción",
          despachado: false,
          tipo_pedido: "Etiqueta",
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
          fecha_apertura: "2026-08-20",
          estado_desc: "En producción",
          despachado: true,
          tipo_pedido: "Etiqueta",
        },
      ],
    ]);

    const candidatas = filterCandidatasBandeja({
      candidatoOtIds: ["id-1", "id-2"],
      maestroByOtId,
      procesoIdsByOtId: new Map([
        ["id-1", [18]],
        ["id-2", [18, 19]],
      ]),
      enHojaRuta: new Set(["36002"]),
      enPool: new Set(),
      despachoByOt: new Map([
        [
          "36002",
          {
            ot_numero: "36002",
            material: "FEDRIGONI",
            despachado_at: "2026-08-20",
          },
        ],
      ]),
      filtroTexto: "",
    });

    expect(candidatas).toHaveLength(1);
    expect(candidatas[0]?.otNumero).toBe("36001");
    expect(candidatas[0]?.despachada).toBe(false);
  });

  it("filterCandidatasBandeja ordena por apertura más reciente primero", () => {
    const maestroByOtId = new Map([
      [
        "id-a",
        {
          id: "id-a",
          num_pedido: "98030",
          cliente: "A",
          titulo: "T",
          cantidad: 1,
          fecha_entrega: "2026-08-07",
          fecha_apertura: "2026-08-01",
          estado_desc: "En producción",
          despachado: false,
          tipo_pedido: "Etiqueta",
        },
      ],
      [
        "id-b",
        {
          id: "id-b",
          num_pedido: "98043",
          cliente: "B",
          titulo: "T",
          cantidad: 1,
          fecha_entrega: "2026-08-04",
          fecha_apertura: "2026-08-28",
          estado_desc: "No empezado",
          despachado: false,
          tipo_pedido: "Etiqueta",
        },
      ],
    ]);

    const candidatas = filterCandidatasBandeja({
      candidatoOtIds: ["id-a", "id-b"],
      maestroByOtId,
      procesoIdsByOtId: new Map([
        ["id-a", [18]],
        ["id-b", [18]],
      ]),
      enHojaRuta: new Set(),
      enPool: new Set(),
      despachoByOt: new Map(),
      filtroTexto: "",
      omitirPruebas: false,
    });

    expect(candidatas.map((c) => c.otNumero)).toEqual(["98043", "98030"]);
  });

  it("filterCandidatasBandeja excluye etiqueta Xerox sin pasos Konica/Troq/Num", () => {
    const maestroByOtId = new Map([
      [
        "id-xerox",
        {
          id: "id-xerox",
          num_pedido: "36100",
          cliente: "Cliente Xerox",
          titulo: "ETIQUETAS offset digital",
          cantidad: 500,
          fecha_entrega: "2026-06-01",
          fecha_apertura: "2026-05-20",
          estado_desc: "En producción",
          despachado: false,
          tipo_pedido: "Etiqueta",
        },
      ],
      [
        "id-hugo",
        {
          id: "id-hugo",
          num_pedido: "36101",
          cliente: "Cliente Hugo",
          titulo: "Etiquetas vino",
          cantidad: 1000,
          fecha_entrega: "2026-06-01",
          fecha_apertura: "2026-05-20",
          estado_desc: "En producción",
          despachado: false,
          tipo_pedido: "Etiqueta",
        },
      ],
    ]);

    const candidatas = filterCandidatasBandeja({
      candidatoOtIds: ["id-xerox", "id-hugo"],
      maestroByOtId,
      procesoIdsByOtId: new Map([["id-hugo", [18, 19]]]),
      enHojaRuta: new Set(),
      enPool: new Set(),
      despachoByOt: new Map(),
      filtroTexto: "",
    });

    expect(candidatas.map((c) => c.otNumero)).toEqual(["36101"]);
  });

  it("filterCandidatasBandeja omite OTs prueba por defecto", () => {
    const maestroByOtId = new Map([
      [
        "id-a",
        {
          id: "id-a",
          num_pedido: "36001",
          cliente: "A",
          titulo: "T",
          cantidad: 1,
          fecha_entrega: "2026-08-07",
          fecha_apertura: "2026-08-01",
          estado_desc: "En producción",
          despachado: false,
          tipo_pedido: "Etiqueta",
        },
      ],
      [
        "id-b",
        {
          id: "id-b",
          num_pedido: "98043",
          cliente: "B",
          titulo: "T",
          cantidad: 1,
          fecha_entrega: "2026-08-04",
          fecha_apertura: "2026-08-28",
          estado_desc: "No empezado",
          despachado: false,
          tipo_pedido: "Etiqueta",
        },
      ],
    ]);

    const candidatas = filterCandidatasBandeja({
      candidatoOtIds: ["id-a", "id-b"],
      maestroByOtId,
      procesoIdsByOtId: new Map([["id-a", [18]]]),
      enHojaRuta: new Set(),
      enPool: new Set(),
      despachoByOt: new Map(),
      filtroTexto: "",
      omitirPruebas: true,
    });

    expect(candidatas.map((c) => c.otNumero)).toEqual(["36001"]);
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
          fechaApertura: "2026-08-01",
          despachada: true,
          despachadoAt: null,
          materialDespacho: "PAPEL",
          itinerario: maquinaFlagsFromProcesoIds([18]),
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

  it("buildEnCursoItems separa itinerario de hecho", () => {
    const hr: ProdEtiquetasHojaRutaRow = {
      id: "hr-1",
      ot_numero: "98030",
      ot_general_id: "id-1",
      cliente: "C",
      trabajo: "T",
      papel: null,
      cantidad: 100,
      fecha_entrega_ot: "2026-08-07",
      fecha_entrada_depto: "2026-08-29",
      urgencia: "normal",
      observacion: null,
      konica: false,
      troqueladora: false,
      numeradora: false,
      fecha_fin_konica: null,
      fecha_fin_troqueladora: null,
      fecha_fin_numeradora: null,
      pdf_ok: false,
      fecha_pdf_ok: null,
      metros_impresion: null,
      troquel_id: null,
      troquel_utillaje: null,
      fecha_inicio_produccion: null,
      fecha_fin_produccion: null,
      cajas: null,
      bobinas: null,
      etiquetas: null,
      cajas_restantes: null,
      finalizado: false,
      created_at: "",
      updated_at: "",
    };

    const items = buildEnCursoItems(
      [hr],
      new Map([["id-1", [18, 19]]]),
      new Map(),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.itinerario).toEqual({
      konica: true,
      troqueladora: true,
      numeradora: false,
    });
    expect(items[0]?.hecho.konica).toBe(false);
  });
});
