import { describe, expect, it } from "vitest";

import { repartirHojasEntrePalets } from "@/lib/cartela-wizard-reparto";

describe("repartirHojasEntrePalets", () => {
  it("reparte 16000 en 8 → ocho de 2000", () => {
    expect(repartirHojasEntrePalets(16000, 8)).toEqual([
      2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000,
    ]);
  });

  it("reparte resto en los primeros", () => {
    expect(repartirHojasEntrePalets(10, 3)).toEqual([4, 3, 3]);
  });

  it("n=1 devuelve el total", () => {
    expect(repartirHojasEntrePalets(16000, 1)).toEqual([16000]);
  });

  it("total 0 → ceros", () => {
    expect(repartirHojasEntrePalets(0, 4)).toEqual([0, 0, 0, 0]);
  });
});
