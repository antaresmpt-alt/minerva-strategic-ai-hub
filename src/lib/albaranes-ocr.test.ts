import { describe, expect, it } from "vitest";

import {
  buildOcrDraftRows,
  hojasDesdeKilos,
  matchProveedor,
  normalizeFormato,
  normalizeProveedorKey,
  parseFechaYmd,
  parseOtNumero,
  rankComprasParaLinea,
  scoreCompraContraLinea,
  type AlbaranOcrCompra,
  type AlbaranOcrProveedor,
} from "@/lib/albaranes-ocr";

describe("normalizeFormato", () => {
  it("normaliza 72x102 a aspa", () => {
    expect(normalizeFormato("72x102")).toBe("72×102");
    expect(normalizeFormato("72 x 102 cm")).toBe("72×102");
  });

  it("convierte mm a cm", () => {
    expect(normalizeFormato("720x1020")).toBe("72×102");
  });
});

describe("hojasDesdeKilos", () => {
  it("OFFSET 70×100 100 g · 35 kg → 500 h", () => {
    expect(hojasDesdeKilos(35, 100, "70×100")).toBe(500);
  });

  it("OFFSET 102×72 200 g · 29.38 kg → ~200 h", () => {
    expect(hojasDesdeKilos(29.38, 200, "102×72")).toBe(200);
  });

  it("OFFSET 70×100 300 g · 52.50 kg → 250 h", () => {
    expect(hojasDesdeKilos(52.5, 300, "70×100")).toBe(250);
  });

  it("sin formato o gramaje → null", () => {
    expect(hojasDesdeKilos(35, 100, "")).toBeNull();
    expect(hojasDesdeKilos(35, 0, "70×100")).toBeNull();
  });
});

describe("matchProveedor", () => {
  const catalog: AlbaranOcrProveedor[] = [
    { id: "1", nombre: "CARPAPSA, S.A." },
    { id: "2", nombre: "PAPERS TORDERA SL" },
    { id: "3", nombre: "TORRASPAPEL S.A." },
  ];

  it("casa CARPAPSA ignorando S.A.", () => {
    expect(matchProveedor("CARPAPSA", catalog)?.id).toBe("1");
    expect(normalizeProveedorKey("CARPAPSA, S.A.")).toBe("carpapsa");
  });

  it("casa Papers Tordera", () => {
    expect(matchProveedor("Papers Tordera", catalog)?.id).toBe("2");
  });

  it("no casa un nombre inventado", () => {
    expect(matchProveedor("Acme Inventada 2099", catalog)).toBeNull();
  });
});

describe("parseOtNumero / fecha", () => {
  it("acepta 5-7 dígitos", () => {
    expect(parseOtNumero("OT 36016")).toBe("36016");
    expect(parseOtNumero("98013")).toBe("98013");
    expect(parseOtNumero("12")).toBe("");
  });

  it("parsea fechas EU", () => {
    expect(parseFechaYmd("15/06/26")).toBe("2026-06-15");
    expect(parseFechaYmd("2026-06-15")).toBe("2026-06-15");
  });
});

describe("rankComprasParaLinea", () => {
  const compras: AlbaranOcrCompra[] = [
    {
      id: "c1",
      ot_numero: "36016",
      num_compra: "OCM-36016",
      material: "Folding Allyking 235",
      gramaje: 235,
      tamano_hoja: "72×102",
      num_hojas_brutas: 2400,
      proveedor_id: "1",
      proveedor_nombre: "CARPAPSA, S.A.",
      estado: "Pendiente",
    },
    {
      id: "c2",
      ot_numero: "35990",
      num_compra: "OCM-35990",
      material: "Offset blanco",
      gramaje: 300,
      tamano_hoja: "70×100",
      num_hojas_brutas: 1000,
      proveedor_id: "2",
      proveedor_nombre: "PAPERS TORDERA SL",
      estado: "Confirmado",
    },
  ];

  it("prioriza misma OT + proveedor + material", () => {
    const score = scoreCompraContraLinea({
      otNumero: "36016",
      proveedorId: "1",
      material: "Folding Allyking",
      gramaje: 235,
      formato: "72x102",
      compra: compras[0]!,
    });
    expect(score).toBeGreaterThanOrEqual(70);
    const ranked = rankComprasParaLinea({
      otNumero: "36016",
      proveedorId: "1",
      material: "Folding Allyking",
      gramaje: 235,
      formato: "72×102",
      compras,
    });
    expect(ranked[0]?.id).toBe("c1");
  });
});

describe("buildOcrDraftRows", () => {
  const catalog: AlbaranOcrProveedor[] = [
    { id: "1", nombre: "CARPAPSA, S.A." },
  ];
  const compras: AlbaranOcrCompra[] = [
    {
      id: "c1",
      ot_numero: "36016",
      num_compra: "OCM-36016",
      material: "Folding 235",
      gramaje: 235,
      tamano_hoja: "72×102",
      num_hojas_brutas: 2400,
      proveedor_id: "1",
      proveedor_nombre: "CARPAPSA, S.A.",
      estado: "Pendiente",
    },
  ];

  it("marca duplicado y lo deja fuera por defecto", () => {
    const rows = buildOcrDraftRows({
      llmRows: [
        {
          proveedor_nombre: "CARPAPSA",
          albaran: "G6-3305",
          ot_numero: "36016",
          material: "Folding 235",
          gramaje: 235,
          formato: "72x102",
          hojas: 2400,
          palets: 1,
        },
      ],
      fallbackFile: "DOC.pdf",
      catalog,
      compras,
      albaranesExistentes: new Set(["g6-3305"]),
      idFactory: () => "row-1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.included).toBe(false);
    expect(rows[0]!.semaforo).toBe("rojo");
    expect(rows[0]!.avisos.some((a) => /ya tiene recepción/i.test(a))).toBe(
      true
    );
  });

  it("calcula hojas desde kilos si el albarán no las trae", () => {
    const rows = buildOcrDraftRows({
      llmRows: [
        {
          proveedor_nombre: "CARPAPSA",
          albaran: "AV26-04186",
          material: "OFFSET BLANC",
          gramaje: 100,
          formato: "70x100",
          kilos: 35,
          es_stock: true,
        },
      ],
      fallbackFile: "tordera.pdf",
      catalog,
      compras: [],
      albaranesExistentes: new Set(),
      idFactory: () => "row-2",
    });
    expect(rows[0]!.hojas).toBe(500);
    expect(rows[0]!.hojas_origen).toBe("calculadas");
    expect(rows[0]!.es_stock).toBe(true);
  });
});
