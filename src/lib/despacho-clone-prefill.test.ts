import { describe, expect, it } from "vitest";
import {
  applyClonePrefill,
  emptyDespachoForm,
  extractDespachoCloneFromPasos,
  formatDespachoMesAnio,
  formatOtHistorialLabel,
  PROCESO_CTP_ID,
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

describe("extractDespachoCloneFromPasos CTP", () => {
  it("extrae checks CTP del paso 16", () => {
    const { ctp, extras } = extractDespachoCloneFromPasos([
      {
        proceso_id: PROCESO_CTP_ID,
        datos_proceso: {
          requiere_prueba_digital: true,
          requiere_pdf_x_ok: true,
          requiere_gestion_troquel: true,
        },
      },
      {
        proceso_id: 12,
        datos_proceso: { codigo_caja_embalaje: "MN2L", estuches_por_bulto: 450 },
      },
    ]);
    expect(ctp).not.toBeNull();
    expect(ctp!.prueba_digital).toBe(true);
    expect(ctp!.pdf_x_ok).toBe(true);
    expect(ctp!.gestion_troquel).toBe(true);
    expect(ctp!.prueba_gmg).toBe(false);
    expect(extras.codigo_caja_embalaje).toBe("MN2L");
  });

  it("ctp null si la OT no tenía paso CTP", () => {
    const { ctp } = extractDespachoCloneFromPasos([
      { proceso_id: 1, datos_proceso: { horas_entrada_previsto: 0.5 } },
    ]);
    expect(ctp).toBeNull();
  });
});
