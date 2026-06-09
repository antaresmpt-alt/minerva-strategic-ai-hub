/** Claves en `public.sys_parametros` para avisos de sobreproducción. */
export const SYS_PARAM_CLAVE_SOBREPROD_IMPRESION =
  "produccion_sobreprod_margen_impresion" as const;
export const SYS_PARAM_CLAVE_SOBREPROD_TROQUELADO =
  "produccion_sobreprod_margen_troquelado" as const;
export const SYS_PARAM_CLAVE_SOBREPROD_ENGOMADO =
  "produccion_sobreprod_margen_engomado" as const;

export const SYS_PARAM_SOBREPROD_CLAVES = [
  SYS_PARAM_CLAVE_SOBREPROD_IMPRESION,
  SYS_PARAM_CLAVE_SOBREPROD_TROQUELADO,
  SYS_PARAM_CLAVE_SOBREPROD_ENGOMADO,
] as const;

export type SysParamSobreproduccionClave =
  (typeof SYS_PARAM_SOBREPROD_CLAVES)[number];

/** Márgenes en porcentaje sobre la cantidad del pedido. */
export type SobreproduccionMargenesParametros = {
  impresion: number;
  troquelado: number;
  engomado: number;
};

export const DEFAULT_SOBREPRODUCCION_MARGENES: SobreproduccionMargenesParametros =
  {
    impresion: 10,
    troquelado: 5,
    engomado: 5,
  };

export type SysParametroSobreproduccionRow = {
  id?: string;
  seccion?: string | null;
  clave: string;
  valor_num: number | null;
  descripcion: string | null;
  updated_at?: string | null;
};

export function mergeSobreproduccionMargenesDesdeFilas(
  filas: { clave: string; valor_num: number | null }[] | null | undefined,
): SobreproduccionMargenesParametros {
  const out = { ...DEFAULT_SOBREPRODUCCION_MARGENES };
  if (!filas?.length) return out;
  for (const r of filas) {
    const v = r.valor_num;
    if (v == null || !Number.isFinite(Number(v))) continue;
    const n = Number(v);
    if (r.clave === SYS_PARAM_CLAVE_SOBREPROD_IMPRESION) out.impresion = n;
    else if (r.clave === SYS_PARAM_CLAVE_SOBREPROD_TROQUELADO)
      out.troquelado = n;
    else if (r.clave === SYS_PARAM_CLAVE_SOBREPROD_ENGOMADO)
      out.engomado = n;
  }
  return out;
}

export function margenSobreproduccionPorProceso(
  procesoId: number | null | undefined,
  margenes: SobreproduccionMargenesParametros,
): number | null {
  if (procesoId === 1 || procesoId === 2) return margenes.impresion;
  if (procesoId === 10) return margenes.troquelado;
  if (procesoId === 12) return margenes.engomado;
  return null;
}
