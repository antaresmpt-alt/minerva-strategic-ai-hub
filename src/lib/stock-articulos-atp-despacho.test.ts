import { describe, expect, it } from "vitest";

import {
  buildReservaNotas,
  loteClienteCompatible,
  OT_ENTREGA_TAG,
  planReservaLotes,
  resumenAtpDespacho,
  type AtpDespachoLote,
} from "@/lib/stock-articulos-atp-despacho";

function lote(p: Partial<AtpDespachoLote> & { id: string }): AtpDespachoLote {
  return {
    referencia_codigo: "M-01632",
    referencia_cliente: "3310017",
    cliente: null,
    unidad: "uds",
    poses: null,
    estado_proceso: "terminado",
    cantidad_fisica: 100,
    cantidad_libre: 100,
    ubicacion_fisica: null,
    ot_origen: null,
    created_at: "2026-09-01T00:00:00Z",
    ...p,
  };
}

describe("loteClienteCompatible", () => {
  it("lote sin cliente sirve a cualquiera", () => {
    expect(loteClienteCompatible(null, "CHMLAB")).toBe(true);
    expect(loteClienteCompatible("", null)).toBe(true);
  });
  it("lote con cliente exige OT del mismo cliente", () => {
    expect(loteClienteCompatible("CHMLAB GROUP 2005 SL", "chmlab group 2005 sl")).toBe(true);
    expect(loteClienteCompatible("CHMLAB GROUP 2005 SL", "TAKEIT")).toBe(false);
    expect(loteClienteCompatible("CHMLAB", null)).toBe(false);
  });
});

describe("resumenAtpDespacho", () => {
  it("pedido 300 con 120 libres → parcial, usa 120, faltan 180", () => {
    const r = resumenAtpDespacho(
      [lote({ id: "a", cliente: "CHMLAB", cantidad_libre: 120 })],
      "CHMLAB",
      300
    );
    expect(r.cobertura).toBe("parcial");
    expect(r.usarDeStock).toBe(120);
    expect(r.faltan).toBe(180);
  });

  it("cubre total y prioriza lote dedicado al cliente antes que genérico", () => {
    const r = resumenAtpDespacho(
      [
        lote({ id: "gen", cantidad_libre: 500, created_at: "2026-01-01T00:00:00Z" }),
        lote({ id: "ded", cliente: "CHMLAB", cantidad_libre: 100 }),
      ],
      "CHMLAB",
      400
    );
    expect(r.cobertura).toBe("total");
    expect(r.ptUsables.map((l) => l.id)).toEqual(["ded", "gen"]);
    expect(r.faltan).toBe(0);
  });

  it("cliente distinto de la misma referencia se ofrece y se avisa", () => {
    const r = resumenAtpDespacho(
      [
        lote({ id: "wip", unidad: "hojas", estado_proceso: "impreso" }),
        lote({ id: "otro", cliente: "TAKEIT", cantidad_libre: 40 }),
        lote({ id: "cero", cantidad_libre: 0 }),
      ],
      "CHMLAB",
      50
    );
    expect(r.cobertura).toBe("parcial");
    expect(r.ptUsables.map((l) => l.id)).toEqual(["otro"]);
    expect(r.clienteDistinto.map((l) => l.id)).toEqual(["otro"]);
    expect(r.otrosClientes).toEqual([]);
    expect(r.wipUsables.map((l) => l.id)).toEqual(["wip"]);
    expect(r.usarDeStock).toBe(40);
  });

  it("OT sin cliente no esconde el lote que sí tiene cliente", () => {
    const r = resumenAtpDespacho(
      [lote({ id: "a", cliente: "CHMLAB", cantidad_libre: 10 })],
      null,
      10
    );
    expect(r.ptUsables.map((l) => l.id)).toEqual(["a"]);
    expect(r.clienteDistinto.map((l) => l.id)).toEqual(["a"]);
    expect(r.cobertura).toBe("total");
  });

  it("sin cantidad en la OT → sin_cantidad", () => {
    const r = resumenAtpDespacho([lote({ id: "a" })], null, null);
    expect(r.cobertura).toBe("sin_cantidad");
    expect(r.usarDeStock).toBe(0);
  });
});

describe("planReservaLotes", () => {
  it("reparte en orden sin pasar del libre", () => {
    expect(
      planReservaLotes(
        [
          { id: "a", cantidad_libre: 100 },
          { id: "b", cantidad_libre: 500 },
        ],
        250
      )
    ).toEqual([
      { stockId: "a", cantidad: 100 },
      { stockId: "b", cantidad: 150 },
    ]);
  });
});

describe("buildReservaNotas", () => {
  it("no duplica el tag de entrega", () => {
    expect(buildReservaNotas(true, `${OT_ENTREGA_TAG} - para la semana`)).toBe(
      `${OT_ENTREGA_TAG} para la semana`
    );
    expect(buildReservaNotas(true, "")).toBe(OT_ENTREGA_TAG);
  });
  it("reserva normal deja las notas tal cual", () => {
    expect(buildReservaNotas(false, " hola ")).toBe("hola");
  });
});
