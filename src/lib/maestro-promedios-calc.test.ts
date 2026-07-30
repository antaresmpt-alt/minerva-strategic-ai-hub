import { describe, expect, it } from "vitest";

import {
  computeHorasMillar,
  computeMedian,
  computeMode,
  computePromediosByReferencia,
  computePromediosForReferencia,
  computePromediosPatchForRows,
  selectLatestProducidasForPromedios,
  type ProducidaPromediosInput,
} from "@/lib/maestro-promedios-calc";
import { horasTirajeDesdeMillar } from "@/lib/maestro-promedios";

function row(
  overrides: Partial<ProducidaPromediosInput> &
    Pick<ProducidaPromediosInput, "ot_numero" | "referencia_id" | "version">,
): ProducidaPromediosInput {
  return {
    id: overrides.id ?? `id-${overrides.ot_numero}-v${overrides.version}`,
    ot_numero: overrides.ot_numero,
    referencia_id: overrides.referencia_id,
    version: overrides.version,
    excluido_de_promedios: overrides.excluido_de_promedios ?? false,
    cantidad_pedida: overrides.cantidad_pedida ?? null,
    material: overrides.material ?? null,
    gramaje: overrides.gramaje ?? null,
    tintas: overrides.tintas ?? null,
    troquel: overrides.troquel ?? null,
    poses: overrides.poses ?? null,
    acabado_pral: overrides.acabado_pral ?? null,
    tipo_engomado: overrides.tipo_engomado ?? null,
    codigo_caja_embalaje: overrides.codigo_caja_embalaje ?? null,
    estuches_por_bulto: overrides.estuches_por_bulto ?? null,
    merma_total: overrides.merma_total ?? null,
    horas_prep_impresion_reales: overrides.horas_prep_impresion_reales ?? null,
    horas_tiraje_impresion_reales:
      overrides.horas_tiraje_impresion_reales ?? null,
    horas_prep_troquelado_reales: overrides.horas_prep_troquelado_reales ?? null,
    horas_tiraje_troquelado_reales:
      overrides.horas_tiraje_troquelado_reales ?? null,
    horas_prep_engomado_reales: overrides.horas_prep_engomado_reales ?? null,
    horas_tiraje_engomado_reales: overrides.horas_tiraje_engomado_reales ?? null,
    horas_guillotina_reales: overrides.horas_guillotina_reales ?? null,
    horas_desbroce_reales: overrides.horas_desbroce_reales ?? null,
  };
}

describe("computeMedian", () => {
  it("vacío → null", () => {
    expect(computeMedian([])).toBeNull();
  });
  it("impar", () => {
    expect(computeMedian([3, 1, 2])).toBe(2);
  });
  it("par → media de centrales", () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("computeMode", () => {
  it("vacío → null", () => {
    expect(computeMode([])).toBeNull();
  });
  it("elige el más frecuente", () => {
    expect(computeMode(["A", "B", "A", "C", "A"])).toBe("A");
  });
  it("empate → primero en aparición", () => {
    expect(computeMode(["X", "Y", "X", "Y"])).toBe("X");
  });
});

describe("computeHorasMillar", () => {
  it("H=2, Q=4000 → 0.5", () => {
    expect(computeHorasMillar(2, 4000)).toBe(0.5);
  });
  it("Q<=0 → null", () => {
    expect(computeHorasMillar(2, 0)).toBeNull();
  });
  it("round-trip con horasTirajeDesdeMillar", () => {
    const millar = computeHorasMillar(2.5, 5000);
    expect(millar).toBe(0.5);
    expect(horasTirajeDesdeMillar(millar, 10000)).toBe(5);
  });
});

describe("selectLatestProducidasForPromedios", () => {
  it("queda MAX(version) por OT y excluye flag / sin referencia", () => {
    const latest = selectLatestProducidasForPromedios([
      row({
        ot_numero: "100",
        referencia_id: "ref-a",
        version: 1,
        material: "viejo",
      }),
      row({
        ot_numero: "100",
        referencia_id: "ref-a",
        version: 2,
        material: "nuevo",
      }),
      row({
        ot_numero: "200",
        referencia_id: "ref-a",
        version: 1,
        excluido_de_promedios: true,
        material: "excluido",
      }),
      row({
        ot_numero: "300",
        referencia_id: null,
        version: 1,
        material: "sin-ref",
      }),
    ]);
    expect(latest).toHaveLength(1);
    expect(latest[0]?.ot_numero).toBe("100");
    expect(latest[0]?.version).toBe(2);
    expect(latest[0]?.material).toBe("nuevo");
  });
});

describe("computePromediosPatchForRows", () => {
  it("moda material + mediana prep + millar tiraje", () => {
    const patch = computePromediosPatchForRows([
      row({
        ot_numero: "1",
        referencia_id: "ref-a",
        version: 1,
        material: "Zenith",
        troquel: "T1",
        cantidad_pedida: 4000,
        horas_prep_impresion_reales: 0.5,
        horas_tiraje_impresion_reales: 2, // millar = 0.5
        poses: 4,
      }),
      row({
        ot_numero: "2",
        referencia_id: "ref-a",
        version: 1,
        material: "Zenith",
        troquel: "T2",
        cantidad_pedida: 8000,
        horas_prep_impresion_reales: 0.7,
        horas_tiraje_impresion_reales: 4, // millar = 0.5
        poses: 8,
      }),
      row({
        ot_numero: "3",
        referencia_id: "ref-a",
        version: 1,
        material: "Otro",
        troquel: "T1",
        cantidad_pedida: 2000,
        horas_prep_impresion_reales: 0.6,
        horas_tiraje_impresion_reales: 1, // millar = 0.5
        poses: 4,
      }),
    ]);

    expect(patch.promedios_basados_en_n_ots).toBe(3);
    expect(patch.material_promedio).toBe("Zenith");
    expect(patch.troquel_promedio).toBe("T1");
    expect(patch.horas_prep_impresion_promedio).toBe(0.6);
    expect(patch.horas_prep_impresion_muestra_n).toBe(3);
    expect(patch.horas_millar_impresion_promedio).toBe(0.5);
    expect(patch.horas_millar_impresion_muestra_n).toBe(3);
    expect(patch.poses_promedio).toBe(4);
    expect(patch.poses_muestra_n).toBe(3);
  });

  it("mediana absoluta guillotina y desbroce", () => {
    const patch = computePromediosPatchForRows([
      row({
        ot_numero: "1",
        referencia_id: "ref-a",
        version: 1,
        horas_guillotina_reales: 0.3,
        horas_desbroce_reales: 0.5,
      }),
      row({
        ot_numero: "2",
        referencia_id: "ref-a",
        version: 1,
        horas_guillotina_reales: 0.5,
        horas_desbroce_reales: 0.7,
      }),
    ]);
    expect(patch.horas_guillotina_promedio).toBe(0.4);
    expect(patch.horas_guillotina_muestra_n).toBe(2);
    expect(patch.horas_desbroce_promedio).toBe(0.6);
    expect(patch.horas_desbroce_muestra_n).toBe(2);
  });

  it("muestra_n de millar ignora OTs sin tiraje o sin Q", () => {
    const patch = computePromediosPatchForRows([
      row({
        ot_numero: "1",
        referencia_id: "ref-a",
        version: 1,
        cantidad_pedida: 1000,
        horas_tiraje_impresion_reales: 1,
      }),
      row({
        ot_numero: "2",
        referencia_id: "ref-a",
        version: 1,
        cantidad_pedida: 1000,
        horas_tiraje_impresion_reales: null,
      }),
    ]);
    expect(patch.horas_millar_impresion_muestra_n).toBe(1);
    expect(patch.horas_millar_impresion_promedio).toBe(1);
    expect(patch.promedios_basados_en_n_ots).toBe(2);
  });
});

describe("computePromediosByReferencia / ForReferencia", () => {
  it("agrupa por referencia y aplica latest version", () => {
    const results = computePromediosByReferencia([
      row({
        ot_numero: "10",
        referencia_id: "ref-b",
        version: 1,
        material: "A",
      }),
      row({
        ot_numero: "10",
        referencia_id: "ref-b",
        version: 2,
        material: "B",
      }),
      row({
        ot_numero: "20",
        referencia_id: "ref-a",
        version: 1,
        material: "C",
      }),
    ]);
    expect(results).toHaveLength(2);
    const a = results.find((r) => r.referenciaId === "ref-a");
    const b = results.find((r) => r.referenciaId === "ref-b");
    expect(a?.nOts).toBe(1);
    expect(a?.patch.material_promedio).toBe("C");
    expect(b?.nOts).toBe(1);
    expect(b?.patch.material_promedio).toBe("B");
  });

  it("referencia sin OTs → n=0 y patch vacío de métricas", () => {
    const r = computePromediosForReferencia([], "ref-x");
    expect(r?.nOts).toBe(0);
    expect(r?.patch.material_promedio).toBeNull();
    expect(r?.patch.promedios_basados_en_n_ots).toBe(0);
  });
});
