/** Helpers desbroce multi-ref en OTs hija (Bloque 8.3). */

export const TABLE_HIJA_COMPONENTES = "prod_ot_hija_componentes";

export type HijaComponenteRow = {
  referencia_codigo: string;
  referencia_descripcion: string | null;
  poses_en_forma: number;
  cantidad_objetivo: number | null;
  orden: number;
};

export type OtHijaMeta = {
  otTipo: string | null;
  otPadreNumero: string | null;
  tipoHija: string | null;
  formaDescripcion: string | null;
  cantidad: number | null;
};

/** Hojas netas de la forma: cantidad_objetivo / poses_en_forma (primer componente). */
export function hojasNetasFormaFromComponentes(
  comps: HijaComponenteRow[],
): number | null {
  const c = comps[0];
  if (!c || c.poses_en_forma <= 0 || c.cantidad_objetivo == null) return null;
  return Math.max(0, Math.round(c.cantidad_objetivo / c.poses_en_forma));
}

export function estuchesEsperadosComponente(c: HijaComponenteRow): number {
  return Math.max(0, c.cantidad_objetivo ?? 0);
}

export function totalEstuchesFormaComponentes(comps: HijaComponenteRow[]): number {
  return comps.reduce((acc, c) => acc + estuchesEsperadosComponente(c), 0);
}

export function shouldShowNoMezclarBanner(
  tipoHija: string | null | undefined,
  comps: HijaComponenteRow[],
): boolean {
  return String(tipoHija ?? "").trim() === "forma" && comps.length >= 2;
}

export function buildComponentesDesbroceSeed(
  comps: HijaComponenteRow[],
): Array<{
  referencia_codigo: string;
  referencia_descripcion: string | null;
  poses_en_forma: number;
  cantidad_objetivo: number | null;
}> {
  return comps.map((c) => ({
    referencia_codigo: c.referencia_codigo,
    referencia_descripcion: c.referencia_descripcion,
    poses_en_forma: c.poses_en_forma,
    cantidad_objetivo: c.cantidad_objetivo,
  }));
}
