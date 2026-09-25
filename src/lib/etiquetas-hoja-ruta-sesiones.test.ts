import { describe, expect, it } from "vitest";

import {
  filaTieneProcesoEnCursoOMultiDia,
  hasSesionHoy,
  indexSesionesByKey,
  procesoEsMultiDiaOEnCurso,
  sesionKey,
} from "@/lib/etiquetas-hoja-ruta-sesiones";
import type { ProdEtiquetasHojaRutaSesionRow } from "@/types/prod-etiquetas-hoja-ruta-sesion";

function sesion(
  partial: Partial<ProdEtiquetasHojaRutaSesionRow> &
    Pick<ProdEtiquetasHojaRutaSesionRow, "hoja_ruta_id" | "proceso" | "fecha">
): ProdEtiquetasHojaRutaSesionRow {
  return {
    id: partial.id ?? "s1",
    hoja_ruta_id: partial.hoja_ruta_id,
    proceso: partial.proceso,
    fecha: partial.fecha,
    nota: partial.nota ?? null,
    created_at: partial.created_at ?? "2026-09-25T10:00:00Z",
  };
}

const baseRow = {
  konica: false,
  troqueladora: false,
  numeradora: false,
  fecha_fin_konica: null as string | null,
  fecha_fin_troqueladora: null as string | null,
  fecha_fin_numeradora: null as string | null,
};

describe("etiquetas-hoja-ruta-sesiones", () => {
  it("indexa sesión de hoy por clave", () => {
    const list = [
      sesion({ hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-25" }),
    ];
    const byKey = indexSesionesByKey(list);
    expect(hasSesionHoy(byKey, "hr1", "I", "2026-09-25")).toBe(true);
    expect(hasSesionHoy(byKey, "hr1", "T", "2026-09-25")).toBe(false);
    expect(sesionKey("hr1", "I", "2026-09-25")).toBe("hr1|I|2026-09-25");
  });

  it("marca en curso si hay sesión y el proceso no está cerrado", () => {
    const sesiones = [
      sesion({ hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-24" }),
    ];
    expect(procesoEsMultiDiaOEnCurso(baseRow, "I", sesiones)).toBe(true);
    expect(filaTieneProcesoEnCursoOMultiDia(baseRow, sesiones)).toBe(true);
  });

  it("no marca multi-día si solo hay sesión el mismo día del cierre", () => {
    const row = {
      ...baseRow,
      konica: true,
      fecha_fin_konica: "2026-09-25",
    };
    const sesiones = [
      sesion({ hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-25" }),
    ];
    expect(procesoEsMultiDiaOEnCurso(row, "I", sesiones)).toBe(false);
  });

  it("marca multi-día si sesiones + cierre en días distintos", () => {
    const row = {
      ...baseRow,
      konica: true,
      fecha_fin_konica: "2026-09-26",
    };
    const sesiones = [
      sesion({ hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-24" }),
      sesion({ hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-25" }),
    ];
    expect(procesoEsMultiDiaOEnCurso(row, "I", sesiones)).toBe(true);
  });
});
