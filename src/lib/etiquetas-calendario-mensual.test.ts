import { describe, expect, it } from "vitest";

import {
  eventosAutoPorDiaDesdeHojaRuta,
  filasHojaRutaEnMes,
} from "@/lib/etiquetas-calendario-mensual";

describe("eventosAutoPorDiaDesdeHojaRuta + sesiones", () => {
  const row = {
    id: "hr1",
    ot_numero: "35572",
    fecha_fin_konica: "2026-09-26",
    fecha_fin_troqueladora: null as string | null,
    fecha_fin_numeradora: null as string | null,
  };

  it("pinta I en días de sesión y en el día de cierre", () => {
    const map = eventosAutoPorDiaDesdeHojaRuta(
      [row],
      [
        { hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-24" },
        { hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-25" },
      ]
    );
    expect(map.get("2026-09-24")?.[0]).toMatchObject({
      tipo: "I",
      estado: "en_curso",
      label: "I-35.572",
    });
    expect(map.get("2026-09-25")?.[0]?.estado).toBe("en_curso");
    expect(map.get("2026-09-26")?.[0]).toMatchObject({
      tipo: "I",
      estado: "cerrado",
    });
  });

  it("el mismo día sesión + cierre → cerrado", () => {
    const map = eventosAutoPorDiaDesdeHojaRuta(
      [{ ...row, fecha_fin_konica: "2026-09-25" }],
      [{ hoja_ruta_id: "hr1", proceso: "I", fecha: "2026-09-25" }]
    );
    expect(map.get("2026-09-25")).toHaveLength(1);
    expect(map.get("2026-09-25")?.[0]?.estado).toBe("cerrado");
  });

  it("incluye filas solo por sesión en el mes", () => {
    const abierto = {
      id: "hr2",
      ot_numero: "36001",
      fecha_fin_konica: null as string | null,
      fecha_fin_troqueladora: null as string | null,
      fecha_fin_numeradora: null as string | null,
    };
    const enMes = filasHojaRutaEnMes(
      [abierto],
      "2026-09-01",
      "2026-09-30",
      [{ hoja_ruta_id: "hr2", fecha: "2026-09-10" }]
    );
    expect(enMes).toHaveLength(1);
  });
});
