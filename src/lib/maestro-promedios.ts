/**
 * Bloque 6.x — capas promedio / oficial en maestro (§7.1.3).
 * Prefill efectivo: oficial ?? promedio ?? habitual (bootstrap Fase 2).
 */

export type MaestroValorEfectivo<T> = {
  value: T | null;
  source: "oficial" | "promedio" | "habitual" | null;
};

/** Prefill: oficial gana; si no, promedio; si no, habitual. */
export function pickMaestroValorEfectivo<T>(args: {
  oficial: T | null | undefined;
  promedio: T | null | undefined;
  habitual?: T | null | undefined;
}): MaestroValorEfectivo<T> {
  const isPresent = (v: T | null | undefined): v is T => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  };
  if (isPresent(args.oficial)) {
    return { value: args.oficial, source: "oficial" };
  }
  if (isPresent(args.promedio)) {
    return { value: args.promedio, source: "promedio" };
  }
  if (isPresent(args.habitual)) {
    return { value: args.habitual, source: "habitual" };
  }
  return { value: null, source: null };
}

/**
 * Tiraje previsto a partir de horas/millar (§7.1.10):
 * horas_tiraje ≈ horas_millar × (cantidad / 1000)
 */
export function horasTirajeDesdeMillar(
  horasMillar: number | null | undefined,
  cantidadPedido: number | null | undefined,
): number | null {
  if (
    horasMillar == null ||
    !Number.isFinite(horasMillar) ||
    horasMillar < 0 ||
    cantidadPedido == null ||
    !Number.isFinite(cantidadPedido) ||
    cantidadPedido <= 0
  ) {
    return null;
  }
  return Math.round(horasMillar * (cantidadPedido / 1000) * 100) / 100;
}

/** Total proceso ≈ prep + tiraje (ambos opcionales). */
export function horasProcesoDesdePrepYMillar(args: {
  prep: number | null | undefined;
  horasMillar: number | null | undefined;
  cantidadPedido: number | null | undefined;
}): number | null {
  const tiraje = horasTirajeDesdeMillar(args.horasMillar, args.cantidadPedido);
  const prep =
    args.prep != null && Number.isFinite(args.prep) && args.prep >= 0
      ? args.prep
      : null;
  if (prep == null && tiraje == null) return null;
  return Math.round(((prep ?? 0) + (tiraje ?? 0)) * 100) / 100;
}

/** Lista de columnas `_promedio` que el botón de recálculo puede escribir. */
export const PROMEDIOS_MAESTRO_COLUMNAS_PROMEDIO = [
  "material_promedio",
  "troquel_promedio",
  "tintas_promedio",
  "acabado_promedio",
  "tipo_engomado_promedio",
  "caja_embalaje_promedio",
  "poses_promedio",
  "gramaje_promedio",
  "unidades_por_embalaje_promedio",
  "merma_promedio",
  "horas_prep_impresion_promedio",
  "horas_prep_troquelado_promedio",
  "horas_prep_engomado_promedio",
  "horas_millar_impresion_promedio",
  "horas_millar_troquelado_promedio",
  "horas_millar_engomado_promedio",
] as const;

export type PromedioMaestroColumna =
  (typeof PROMEDIOS_MAESTRO_COLUMNAS_PROMEDIO)[number];
