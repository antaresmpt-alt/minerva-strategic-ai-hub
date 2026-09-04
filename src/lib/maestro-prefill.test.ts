import { describe, expect, it } from "vitest";

import {
  buildHorasFormPatchFromMaestro,
  maestroTipoEngomadoEfectivo,
  maestroValorEfectivoTexto,
} from "@/lib/maestro-prefill";
import { emptyDespachoForm } from "@/lib/despacho-wizard-shared";
import type { MaestroPrefillReferenciaRow } from "@/lib/maestro-prefill";

function baseRow(
  overrides: Partial<MaestroPrefillReferenciaRow> = {},
): MaestroPrefillReferenciaRow {
  return {
    material_habitual: null,
    gramaje_habitual: null,
    poses_habitual: null,
    troquel_habitual: null,
    tintas_habituales: null,
    acabado_habitual: null,
    tipo_engomado_habitual: null,
    caja_embalaje_habitual: null,
    unidades_por_embalaje_habitual: null,
    ruta_habitual: null,
    material_promedio: null,
    material_oficial: null,
    gramaje_promedio: null,
    gramaje_oficial: null,
    poses_promedio: null,
    poses_oficial: null,
    troquel_promedio: null,
    troquel_oficial: null,
    tintas_promedio: null,
    tintas_oficial: null,
    acabado_promedio: null,
    acabado_oficial: null,
    tipo_engomado_promedio: null,
    tipo_engomado_oficial: null,
    caja_embalaje_promedio: null,
    caja_embalaje_oficial: null,
    unidades_por_embalaje_promedio: null,
    unidades_por_embalaje_oficial: null,
    horas_prep_impresion_promedio: null,
    horas_prep_impresion_oficial: null,
    horas_prep_troquelado_promedio: null,
    horas_prep_troquelado_oficial: null,
    horas_prep_engomado_promedio: null,
    horas_prep_engomado_oficial: null,
    horas_millar_impresion_promedio: null,
    horas_millar_impresion_oficial: null,
    horas_millar_troquelado_promedio: null,
    horas_millar_troquelado_oficial: null,
    horas_millar_engomado_promedio: null,
    horas_millar_engomado_oficial: null,
    promedios_actualizados_at: null,
    promedios_basados_en_n_ots: null,
    defaults_proceso: null,
    ...overrides,
  };
}

describe("maestroValorEfectivoTexto", () => {
  it("prioriza oficial sobre promedio e habitual", () => {
    const row = baseRow({
      material_habitual: "HAB",
      material_promedio: "PROM",
      material_oficial: "OFI",
    });
    expect(maestroValorEfectivoTexto(row, "material_habitual")).toBe("OFI");
  });

  it("usa promedio si no hay oficial", () => {
    const row = baseRow({
      material_habitual: "HAB",
      material_promedio: "PROM",
    });
    expect(maestroValorEfectivoTexto(row, "material_habitual")).toBe("PROM");
  });

  it("tipo engomado efectivo", () => {
    expect(
      maestroTipoEngomadoEfectivo(
        baseRow({ tipo_engomado_promedio: "Pegado 4 puntos" }),
      ),
    ).toBe("Pegado 4 puntos");
  });
});

describe("buildHorasFormPatchFromMaestro", () => {
  it("rellena prep y tiraje desde millar con cantidad pedido", () => {
    const row = baseRow({
      horas_prep_impresion_promedio: 0.5,
      horas_millar_impresion_promedio: 1,
    });
    const form = emptyDespachoForm();
    const { patch } = buildHorasFormPatchFromMaestro(row, form, 5000);
    expect(patch.horas_entrada).toBe("0.5");
    expect(patch.horas_tiraje).toBe("5");
  });

  it("modo empty no pisa campos ya rellenados", () => {
    const row = baseRow({ horas_prep_impresion_promedio: 0.5 });
    const form = { ...emptyDespachoForm(), horas_entrada: "2" };
    const { patch, filledLabels } = buildHorasFormPatchFromMaestro(row, form, 1000);
    expect(patch.horas_entrada).toBeUndefined();
    expect(filledLabels).toEqual([]);
  });

  it("modo overwrite pisa campos ya rellenados", () => {
    const row = baseRow({
      horas_prep_impresion_promedio: 0.5,
      horas_millar_impresion_promedio: 0.343,
    });
    const form = {
      ...emptyDespachoForm(),
      horas_entrada: "0.65",
      horas_tiraje: "1.2",
    };
    const { patch, filledLabels } = buildHorasFormPatchFromMaestro(
      row,
      form,
      8000,
      { mode: "overwrite" },
    );
    expect(patch.horas_entrada).toBe("0.5");
    expect(patch.horas_tiraje).toBe("2.74");
    expect(filledLabels).toEqual([
      "Horas impresión (prep)",
      "Horas impresión (tiraje)",
    ]);
  });
});
