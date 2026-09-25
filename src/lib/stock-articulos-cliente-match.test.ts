import { describe, expect, it } from "vitest";

import { clientesOtLoteDifieren } from "@/lib/stock-articulos-cliente-match";

describe("clientesOtLoteDifieren", () => {
  it("no avisa si falta alguno", () => {
    expect(clientesOtLoteDifieren(null, "CHMLAB")).toBe(false);
    expect(clientesOtLoteDifieren("CHMLAB", null)).toBe(false);
    expect(clientesOtLoteDifieren("", "")).toBe(false);
  });

  it("no avisa si coinciden o uno contiene al otro", () => {
    expect(
      clientesOtLoteDifieren("CHMLAB GROUP 2005 SL", "CHMLAB GROUP 2005 SL")
    ).toBe(false);
    expect(clientesOtLoteDifieren("CHMLAB GROUP 2005 SL", "CHMLAB")).toBe(
      false
    );
  });

  it("avisa si son distintos", () => {
    expect(clientesOtLoteDifieren("TAKEIT", "CHMLAB GROUP 2005 SL")).toBe(true);
  });
});
