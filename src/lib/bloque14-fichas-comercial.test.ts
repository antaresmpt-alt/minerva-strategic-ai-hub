import { describe, expect, it } from "vitest";

import {
  canAccessPagePath,
  isComercialProduccionPath,
} from "@/lib/permissions";
import { normalizeClienteNombre } from "@/types/prod-cliente-ficha";

describe("Bloque 14 — comercial paths", () => {
  it("permite solo articulos y pipeline (+ hub produccion)", () => {
    expect(isComercialProduccionPath("/produccion")).toBe(true);
    expect(isComercialProduccionPath("/produccion/articulos")).toBe(true);
    expect(isComercialProduccionPath("/produccion/articulos/x")).toBe(true);
    expect(isComercialProduccionPath("/produccion/pipeline")).toBe(true);
    expect(isComercialProduccionPath("/produccion/ots")).toBe(false);
    expect(isComercialProduccionPath("/produccion/ejecucion")).toBe(false);
    expect(isComercialProduccionPath("/produccion/muelle")).toBe(false);
  });

  it("canAccessPagePath comercial bloquea planta", () => {
    expect(canAccessPagePath("comercial", "/produccion/articulos")).toBe(true);
    expect(canAccessPagePath("comercial", "/produccion/pipeline")).toBe(true);
    expect(canAccessPagePath("comercial", "/analytics/sales")).toBe(true);
    expect(canAccessPagePath("comercial", "/produccion/ots")).toBe(false);
    expect(canAccessPagePath("comercial", "/produccion/ejecucion")).toBe(false);
    expect(canAccessPagePath("comercial", "/settings")).toBe(false);
  });
});

describe("normalizeClienteNombre", () => {
  it("trim y colapsa espacios", () => {
    expect(normalizeClienteNombre("  LAB  ANUR  ")).toBe("LAB ANUR");
    expect(normalizeClienteNombre(null)).toBe("");
  });
});

describe("Bloque 14 — PDF cliente fotos", () => {
  it("exportArticuloFichaPdf está disponible", async () => {
    const mod = await import("@/lib/articulos-maestro-ficha-pdf");
    expect(typeof mod.exportArticuloFichaPdf).toBe("function");
  });
});
