/**
 * Bloque 6.x Paso D — prefill despacho desde maestro con capas
 * oficial ?? promedio ?? habitual (§7.1.3).
 */

import type { MaestroSugerenciaKey } from "@/lib/articulos-maestro-sugerencias";
import {
  horasTirajeDesdeMillar,
  pickMaestroValorEfectivo,
  type MaestroValorEfectivo,
} from "@/lib/maestro-promedios";
import type { DespachoFormState } from "@/lib/despacho-wizard-shared";
import type { ProdReferenciaRow } from "@/types/prod-referencias";

type ScalarSpec = {
  habitual: keyof ProdReferenciaRow;
  promedio: keyof ProdReferenciaRow;
  oficial: keyof ProdReferenciaRow;
  numeric?: boolean;
};

const MAESTRO_SCALAR_SPECS: Record<MaestroSugerenciaKey, ScalarSpec> = {
  material_habitual: {
    habitual: "material_habitual",
    promedio: "material_promedio",
    oficial: "material_oficial",
  },
  gramaje_habitual: {
    habitual: "gramaje_habitual",
    promedio: "gramaje_promedio",
    oficial: "gramaje_oficial",
    numeric: true,
  },
  poses_habitual: {
    habitual: "poses_habitual",
    promedio: "poses_promedio",
    oficial: "poses_oficial",
    numeric: true,
  },
  troquel_habitual: {
    habitual: "troquel_habitual",
    promedio: "troquel_promedio",
    oficial: "troquel_oficial",
  },
  tintas_habituales: {
    habitual: "tintas_habituales",
    promedio: "tintas_promedio",
    oficial: "tintas_oficial",
  },
  acabado_habitual: {
    habitual: "acabado_habitual",
    promedio: "acabado_promedio",
    oficial: "acabado_oficial",
  },
  tipo_engomado_habitual: {
    habitual: "tipo_engomado_habitual",
    promedio: "tipo_engomado_promedio",
    oficial: "tipo_engomado_oficial",
  },
  caja_embalaje_habitual: {
    habitual: "caja_embalaje_habitual",
    promedio: "caja_embalaje_promedio",
    oficial: "caja_embalaje_oficial",
  },
  unidades_por_embalaje_habitual: {
    habitual: "unidades_por_embalaje_habitual",
    promedio: "unidades_por_embalaje_promedio",
    oficial: "unidades_por_embalaje_oficial",
    numeric: true,
  },
  ruta_habitual: {
    habitual: "ruta_habitual",
    promedio: "ruta_habitual",
    oficial: "ruta_habitual",
  },
};

/** Columnas para SELECT al prefill «Usar maestro». */
export const MAESTRO_PREFILL_REFERENCIA_SELECT = [
  "material_habitual",
  "gramaje_habitual",
  "poses_habitual",
  "troquel_habitual",
  "tintas_habituales",
  "acabado_habitual",
  "tipo_engomado_habitual",
  "caja_embalaje_habitual",
  "unidades_por_embalaje_habitual",
  "ruta_habitual",
  "material_promedio",
  "material_oficial",
  "gramaje_promedio",
  "gramaje_oficial",
  "poses_promedio",
  "poses_oficial",
  "troquel_promedio",
  "troquel_oficial",
  "tintas_promedio",
  "tintas_oficial",
  "acabado_promedio",
  "acabado_oficial",
  "tipo_engomado_promedio",
  "tipo_engomado_oficial",
  "caja_embalaje_promedio",
  "caja_embalaje_oficial",
  "unidades_por_embalaje_promedio",
  "unidades_por_embalaje_oficial",
  "horas_prep_impresion_promedio",
  "horas_prep_impresion_oficial",
  "horas_prep_troquelado_promedio",
  "horas_prep_troquelado_oficial",
  "horas_prep_engomado_promedio",
  "horas_prep_engomado_oficial",
  "horas_millar_impresion_promedio",
  "horas_millar_impresion_oficial",
  "horas_millar_troquelado_promedio",
  "horas_millar_troquelado_oficial",
  "horas_millar_engomado_promedio",
  "horas_millar_engomado_oficial",
  "promedios_actualizados_at",
  "promedios_basados_en_n_ots",
  "defaults_proceso",
].join(", ");

export type MaestroPrefillReferenciaRow = Pick<
  ProdReferenciaRow,
  | "material_habitual"
  | "gramaje_habitual"
  | "poses_habitual"
  | "troquel_habitual"
  | "tintas_habituales"
  | "acabado_habitual"
  | "tipo_engomado_habitual"
  | "caja_embalaje_habitual"
  | "unidades_por_embalaje_habitual"
  | "ruta_habitual"
  | "material_promedio"
  | "material_oficial"
  | "gramaje_promedio"
  | "gramaje_oficial"
  | "poses_promedio"
  | "poses_oficial"
  | "troquel_promedio"
  | "troquel_oficial"
  | "tintas_promedio"
  | "tintas_oficial"
  | "acabado_promedio"
  | "acabado_oficial"
  | "tipo_engomado_promedio"
  | "tipo_engomado_oficial"
  | "caja_embalaje_promedio"
  | "caja_embalaje_oficial"
  | "unidades_por_embalaje_promedio"
  | "unidades_por_embalaje_oficial"
  | "horas_prep_impresion_promedio"
  | "horas_prep_impresion_oficial"
  | "horas_prep_troquelado_promedio"
  | "horas_prep_troquelado_oficial"
  | "horas_prep_engomado_promedio"
  | "horas_prep_engomado_oficial"
  | "horas_millar_impresion_promedio"
  | "horas_millar_impresion_oficial"
  | "horas_millar_troquelado_promedio"
  | "horas_millar_troquelado_oficial"
  | "horas_millar_engomado_promedio"
  | "horas_millar_engomado_oficial"
  | "promedios_actualizados_at"
  | "promedios_basados_en_n_ots"
  | "defaults_proceso"
>;

function readRow<T extends string | number | null>(
  row: MaestroPrefillReferenciaRow,
  key: keyof ProdReferenciaRow,
): T | null | undefined {
  return row[key as keyof MaestroPrefillReferenciaRow] as T | null | undefined;
}

function formatEffectiveValue(
  spec: ScalarSpec,
  effective: MaestroValorEfectivo<string | number>,
): string | null {
  if (effective.value == null) return null;
  if (spec.numeric && typeof effective.value === "number") {
    return String(effective.value);
  }
  const s = String(effective.value).trim();
  return s || null;
}

/** Valor efectivo para prefill (oficial ?? promedio ?? habitual). */
export function maestroValorEfectivoParaPrefill(
  row: MaestroPrefillReferenciaRow,
  key: MaestroSugerenciaKey,
): MaestroValorEfectivo<string | number> {
  const spec = MAESTRO_SCALAR_SPECS[key];
  if (key === "ruta_habitual") {
    const v = readRow<string>(row, "ruta_habitual");
    return v?.trim() ? { value: v.trim(), source: "habitual" } : { value: null, source: null };
  }
  return pickMaestroValorEfectivo({
    oficial: readRow(row, spec.oficial),
    promedio: readRow(row, spec.promedio),
    habitual: readRow(row, spec.habitual),
  });
}

/** String listo para el formulario de despacho. */
export function maestroValorEfectivoTexto(
  row: MaestroPrefillReferenciaRow,
  key: MaestroSugerenciaKey,
): string | null {
  const spec = MAESTRO_SCALAR_SPECS[key];
  const effective = maestroValorEfectivoParaPrefill(row, key);
  return formatEffectiveValue(spec, effective);
}

export function maestroTipoEngomadoEfectivo(
  row: MaestroPrefillReferenciaRow,
): string | null {
  return maestroValorEfectivoTexto(row, "tipo_engomado_habitual");
}

function pickHorasEfectivo(
  row: MaestroPrefillReferenciaRow,
  oficialKey: keyof ProdReferenciaRow,
  promedioKey: keyof ProdReferenciaRow,
): number | null {
  const { value } = pickMaestroValorEfectivo({
    oficial: readRow<number>(row, oficialKey),
    promedio: readRow<number>(row, promedioKey),
  });
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export type MaestroHorasFormPatch = Partial<
  Pick<
    DespachoFormState,
    | "horas_entrada"
    | "horas_tiraje"
    | "horas_troquel_preparacion"
    | "horas_troquel_tiraje"
    | "horas_estimadas_troquelado"
    | "horas_engomado_preparacion"
    | "horas_engomado_tiraje"
    | "horas_estimadas_engomado"
  >
>;

function roundHoras(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function sumHoras(prep: number | null, tiraje: number | null): string | null {
  if (prep == null && tiraje == null) return null;
  return roundHoras((prep ?? 0) + (tiraje ?? 0));
}

/** Horas previstas desde maestro (prep + millar × cantidad) — solo campos vacíos. */
export function buildHorasFormPatchFromMaestro(
  row: MaestroPrefillReferenciaRow,
  currentForm: DespachoFormState,
  cantidadPedido: number | null | undefined,
): { patch: MaestroHorasFormPatch; filledLabels: string[] } {
  const patch: MaestroHorasFormPatch = {};
  const filledLabels: string[] = [];

  const prepImp = pickHorasEfectivo(
    row,
    "horas_prep_impresion_oficial",
    "horas_prep_impresion_promedio",
  );
  const millarImp = pickHorasEfectivo(
    row,
    "horas_millar_impresion_oficial",
    "horas_millar_impresion_promedio",
  );
  const tirajeImp = horasTirajeDesdeMillar(millarImp, cantidadPedido);

  if (!currentForm.horas_entrada.trim() && prepImp != null) {
    patch.horas_entrada = roundHoras(prepImp);
    filledLabels.push("Horas impresión (prep)");
  }
  if (!currentForm.horas_tiraje.trim() && tirajeImp != null) {
    patch.horas_tiraje = roundHoras(tirajeImp);
    filledLabels.push("Horas impresión (tiraje)");
  }

  const prepTroq = pickHorasEfectivo(
    row,
    "horas_prep_troquelado_oficial",
    "horas_prep_troquelado_promedio",
  );
  const millarTroq = pickHorasEfectivo(
    row,
    "horas_millar_troquelado_oficial",
    "horas_millar_troquelado_promedio",
  );
  const tirajeTroq = horasTirajeDesdeMillar(millarTroq, cantidadPedido);

  if (!currentForm.horas_troquel_preparacion.trim() && prepTroq != null) {
    patch.horas_troquel_preparacion = roundHoras(prepTroq);
    filledLabels.push("Horas troquel (prep)");
  }
  if (!currentForm.horas_troquel_tiraje.trim() && tirajeTroq != null) {
    patch.horas_troquel_tiraje = roundHoras(tirajeTroq);
    filledLabels.push("Horas troquel (tiraje)");
  }
  if (
    !currentForm.horas_estimadas_troquelado.trim() &&
  (prepTroq != null || tirajeTroq != null)
  ) {
    const total = sumHoras(prepTroq, tirajeTroq);
    if (total) patch.horas_estimadas_troquelado = total;
  }

  const prepEng = pickHorasEfectivo(
    row,
    "horas_prep_engomado_oficial",
    "horas_prep_engomado_promedio",
  );
  const millarEng = pickHorasEfectivo(
    row,
    "horas_millar_engomado_oficial",
    "horas_millar_engomado_promedio",
  );
  const tirajeEng = horasTirajeDesdeMillar(millarEng, cantidadPedido);

  if (!currentForm.horas_engomado_preparacion.trim() && prepEng != null) {
    patch.horas_engomado_preparacion = roundHoras(prepEng);
    filledLabels.push("Horas engomado (prep)");
  }
  if (!currentForm.horas_engomado_tiraje.trim() && tirajeEng != null) {
    patch.horas_engomado_tiraje = roundHoras(tirajeEng);
    filledLabels.push("Horas engomado (tiraje)");
  }
  if (
    !currentForm.horas_estimadas_engomado.trim() &&
    (prepEng != null || tirajeEng != null)
  ) {
    const total = sumHoras(prepEng, tirajeEng);
    if (total) patch.horas_estimadas_engomado = total;
  }

  return { patch, filledLabels };
}

export function formatPromediosActualizadosAt(
  at: string | null | undefined,
): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Líneas legibles para panel Maestro (promedio + n global). */
export function buildMaestroPromediosResumenLines(
  row: Pick<
    ProdReferenciaRow,
    | "promedios_actualizados_at"
    | "promedios_basados_en_n_ots"
    | "material_promedio"
    | "poses_promedio"
    | "poses_muestra_n"
    | "horas_millar_impresion_promedio"
    | "horas_millar_impresion_muestra_n"
    | "horas_prep_impresion_promedio"
    | "horas_prep_impresion_muestra_n"
  >,
): string[] {
  const lines: string[] = [];
  const when = formatPromediosActualizadosAt(row.promedios_actualizados_at);
  const nGlobal = row.promedios_basados_en_n_ots;
  if (when) {
    lines.push(
      nGlobal != null && nGlobal > 0
        ? `Actualizado ${when} · ${nGlobal} OTs`
        : `Actualizado ${when}`,
    );
  } else if (nGlobal != null && nGlobal > 0) {
    lines.push(`Basado en ${nGlobal} OTs`);
  }
  if (row.material_promedio) {
    lines.push(`Material (prom.): ${row.material_promedio}`);
  }
  if (row.poses_promedio != null) {
    const n = row.poses_muestra_n;
    lines.push(
      n != null ? `Poses (prom.): ${row.poses_promedio} (n=${n})` : `Poses (prom.): ${row.poses_promedio}`,
    );
  }
  if (row.horas_prep_impresion_promedio != null) {
    const n = row.horas_prep_impresion_muestra_n;
    lines.push(
      n != null
        ? `Prep impresión (prom.): ${row.horas_prep_impresion_promedio} h (n=${n})`
        : `Prep impresión (prom.): ${row.horas_prep_impresion_promedio} h`,
    );
  }
  if (row.horas_millar_impresion_promedio != null) {
    const n = row.horas_millar_impresion_muestra_n;
    lines.push(
      n != null
        ? `Millar impresión (prom.): ${row.horas_millar_impresion_promedio} (n=${n})`
        : `Millar impresión (prom.): ${row.horas_millar_impresion_promedio}`,
    );
  }
  return lines;
}
