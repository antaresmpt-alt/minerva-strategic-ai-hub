import { describe, expect, it } from "vitest";
import {
  applyClonePrefill,
  emptyDespachoForm,
  formatDespachoMesAnio,
  formatOtHistorialLabel,
} from "@/lib/despacho-wizard-shared";

describe("formatOtHistorialLabel", () => {
  it("formatea OT + mes/año", () => {
    expect(formatDespachoMesAnio("2026-07-15T10:00:00Z")).toBe("jul / 2026");
    expect(formatOtHistorialLabel("98004", "2026-07-15")).toBe(
      "OT 98004 — jul / 2026",
    );
    expect(formatOtHistorialLabel("98004", null)).toBe("OT 98004");
  });
});

describe("applyClonePrefill overwrite", () => {
  it("machaca material aunque el form ya tenga valor", () => {
    const form = { ...emptyDespachoForm(), material: "ZENITH" };
    const { next, filled } = applyClonePrefill(
      form,
      { material: "TPWHITE", gramaje: 300 },
      { mode: "overwrite" },
    );
    expect(next.material).toBe("TPWHITE");
    expect(next.gramaje).toBe("300");
    expect(filled).toBeGreaterThanOrEqual(2);
  });

  it("modo empty no pisa material existente", () => {
    const form = { ...emptyDespachoForm(), material: "ZENITH" };
    const { next } = applyClonePrefill(
      form,
      { material: "TPWHITE" },
      { mode: "empty" },
    );
    expect(next.material).toBe("ZENITH");
  });
});
