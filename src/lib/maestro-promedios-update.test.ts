import { describe, expect, it } from "vitest";
import { buildPromediosDbUpdate } from "@/lib/maestro-promedios-update";
import type { MaestroPromediosPatch } from "@/lib/maestro-promedios-calc";

const EMPTY_PATCH: MaestroPromediosPatch = {
  promedios_basados_en_n_ots: 0,
  material_promedio: null,
  troquel_promedio: null,
  tintas_promedio: null,
  acabado_promedio: null,
  tipo_engomado_promedio: null,
  caja_embalaje_promedio: null,
  poses_promedio: null,
  poses_muestra_n: null,
  gramaje_promedio: null,
  gramaje_muestra_n: null,
  unidades_por_embalaje_promedio: null,
  unidades_por_embalaje_muestra_n: null,
  merma_promedio: null,
  merma_muestra_n: null,
  horas_prep_impresion_promedio: null,
  horas_prep_impresion_muestra_n: null,
  horas_prep_troquelado_promedio: null,
  horas_prep_troquelado_muestra_n: null,
  horas_prep_engomado_promedio: null,
  horas_prep_engomado_muestra_n: null,
  horas_millar_impresion_promedio: null,
  horas_millar_impresion_muestra_n: null,
  horas_millar_troquelado_promedio: null,
  horas_millar_troquelado_muestra_n: null,
  horas_millar_engomado_promedio: null,
  horas_millar_engomado_muestra_n: null,
};

describe("buildPromediosDbUpdate", () => {
  it("incluye meta y promedios, nunca claves _oficial ni _habitual", () => {
    const at = "2026-07-28T12:00:00.000Z";
    const payload = buildPromediosDbUpdate(
      {
        ...EMPTY_PATCH,
        promedios_basados_en_n_ots: 3,
        material_promedio: "GC1",
        horas_millar_impresion_promedio: 0.42,
        horas_millar_impresion_muestra_n: 2,
      },
      at,
    );

    expect(payload.promedios_actualizados_at).toBe(at);
    expect(payload.promedios_basados_en_n_ots).toBe(3);
    expect(payload.material_promedio).toBe("GC1");
    expect(payload.horas_millar_impresion_promedio).toBe(0.42);

    const keys = Object.keys(payload);
    expect(keys.some((k) => k.endsWith("_oficial"))).toBe(false);
    expect(keys.some((k) => k.endsWith("_habitual"))).toBe(false);
    expect(keys).not.toContain("codigo");
    expect(keys).not.toContain("defaults_proceso");
  });
});
