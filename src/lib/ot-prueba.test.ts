import { describe, expect, it } from "vitest";

import { isOtNumeroPrueba, parseOtNumeroBase } from "@/lib/ot-prueba";

describe("ot-prueba", () => {
  it("parsea base e hijas", () => {
    expect(parseOtNumeroBase("98010")).toBe(98010);
    expect(parseOtNumeroBase("98010-01")).toBe(98010);
    expect(parseOtNumeroBase("36112")).toBe(36112);
    expect(parseOtNumeroBase("")).toBeNull();
  });

  it("marca ≥98000 como prueba", () => {
    expect(isOtNumeroPrueba("98000")).toBe(true);
    expect(isOtNumeroPrueba("98022")).toBe(true);
    expect(isOtNumeroPrueba("98010-02")).toBe(true);
    expect(isOtNumeroPrueba("36112")).toBe(false);
    expect(isOtNumeroPrueba("97999")).toBe(false);
  });
});
