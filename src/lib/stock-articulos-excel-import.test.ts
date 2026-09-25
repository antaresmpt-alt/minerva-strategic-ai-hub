import { describe, expect, it } from "vitest";

import {
  parseStockImportInt,
  parseStockImportNum,
  validateStockArticulosImportRows,
  type StockArticulosImportDraftRow,
} from "@/lib/stock-articulos-excel-import";

describe("parseStockImportInt", () => {
  it("usa number entero raw sin reinterpretar formato", () => {
    expect(parseStockImportInt(35900)).toBe(35900);
    expect(Number.isNaN(parseStockImportInt(35.9)!)).toBe(true);
  });

  it("quita puntos/comas de miles solo con grupos de 3", () => {
    expect(parseStockImportInt("35.900")).toBe(35900);
    expect(parseStockImportInt("35,900")).toBe(35900);
    expect(parseStockImportInt("1.000.000")).toBe(1000000);
    expect(parseStockImportInt("1.000")).toBe(1000);
  });

  it("rechaza decimales escritos como texto (no los convierte en enteros)", () => {
    expect(Number.isNaN(parseStockImportInt("1,5")!)).toBe(true);
    expect(Number.isNaN(parseStockImportInt("12,5")!)).toBe(true);
    expect(Number.isNaN(parseStockImportInt("1.5")!)).toBe(true);
    expect(Number.isNaN(parseStockImportInt("35.90")!)).toBe(true);
  });

  it("vacío → undefined; basura → NaN", () => {
    expect(parseStockImportInt("")).toBeUndefined();
    expect(parseStockImportInt(null)).toBeUndefined();
    expect(Number.isNaN(parseStockImportInt("abc")!)).toBe(true);
  });
});

describe("parseStockImportNum", () => {
  it("respeta decimales ES/EN y miles", () => {
    expect(parseStockImportNum(1.5)).toBe(1.5);
    expect(parseStockImportNum("1,5")).toBe(1.5);
    expect(parseStockImportNum("1.5")).toBe(1.5);
    expect(parseStockImportNum("1.500")).toBe(1500);
  });
});

function draft(
  partial: Partial<StockArticulosImportDraftRow> & { rowIndex: number }
): StockArticulosImportDraftRow {
  return {
    referencia_minerva: "",
    referencia_cliente: "",
    cliente: "",
    cantidad: "",
    unidad: "uds",
    proceso: "terminado",
    poses: "",
    bultos: "",
    uds_por_bulto: "",
    pico: "",
    palets: "",
    tipo_embalaje: "",
    ubicacion: "",
    ot_origen: "",
    notas: "",
    semaforo: "verde",
    mensajes: [],
    ...partial,
  };
}

describe("validateStockArticulosImportRows", () => {
  const catalog = [
    {
      id: "ref-1",
      codigo: "M-01632",
      referencia_cliente: "I02997",
      cliente: "TURRIS",
    },
  ];

  it("marca rojo notas con Ejemplo", () => {
    const rows = validateStockArticulosImportRows(
      [
        draft({
          rowIndex: 2,
          referencia_minerva: "M-01632",
          cantidad: "1000",
          notas: "Ejemplo PT — no importar",
        }),
      ],
      catalog,
      {
        fileTag: "[import:abc]",
        existingImportTags: new Set(),
        existingLoteKeys: new Set(),
      }
    );
    expect(rows[0]?.semaforo).toBe("rojo");
    expect(rows[0]?.payload).toBeUndefined();
  });

  it("aviso amarillo si fila repetida en el archivo", () => {
    const rows = validateStockArticulosImportRows(
      [
        draft({
          rowIndex: 2,
          referencia_minerva: "M-01632",
          cantidad: "1000",
          ot_origen: "35519",
        }),
        draft({
          rowIndex: 3,
          referencia_minerva: "M-01632",
          cantidad: "1000",
          ot_origen: "35519",
        }),
      ],
      catalog,
      {
        fileTag: "[import:abc]",
        existingImportTags: new Set(),
        existingLoteKeys: new Set(),
      }
    );
    expect(rows.every((r) => r.semaforo === "amarillo")).toBe(true);
    expect(rows[0]?.mensajes.some((m) => /repetida/i.test(m))).toBe(true);
  });

  it("parsea cantidad con miles en texto", () => {
    const rows = validateStockArticulosImportRows(
      [
        draft({
          rowIndex: 2,
          referencia_minerva: "M-01632",
          cantidad: "35.900",
        }),
      ],
      catalog,
      {
        fileTag: "[import:abc]",
        existingImportTags: new Set(),
        existingLoteKeys: new Set(),
      }
    );
    expect(rows[0]?.semaforo).not.toBe("rojo");
    expect(rows[0]?.payload?.p_cantidad).toBe(35900);
  });

  it("acepta sinónimos de unidad y proceso", () => {
    const rows = validateStockArticulosImportRows(
      [
        draft({
          rowIndex: 2,
          referencia_minerva: "M-01632",
          cantidad: "10",
          unidad: "unidades",
          proceso: "acabado",
        }),
        draft({
          rowIndex: 3,
          referencia_minerva: "M-01632",
          cantidad: "5",
          unidad: "hoja",
          proceso: "troquel",
          poses: "2",
        }),
      ],
      catalog,
      {
        fileTag: "[import:abc]",
        existingImportTags: new Set(),
        existingLoteKeys: new Set(),
      }
    );
    expect(rows[0]?.semaforo).not.toBe("rojo");
    expect(rows[0]?.unidad).toBe("uds");
    expect(rows[0]?.proceso).toBe("terminado");
    expect(rows[0]?.payload?.p_unidad).toBe("uds");
    expect(rows[1]?.unidad).toBe("hojas");
    expect(rows[1]?.proceso).toBe("troquelado");
  });
});
