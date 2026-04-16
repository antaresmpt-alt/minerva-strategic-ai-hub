/** Claves en `public.sys_parametros` para umbrales OT / Compras. */
export const SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO =
  "produccion_ots_compras_dias_critico_rojo" as const;
export const SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA =
  "produccion_ots_compras_dias_aviso_naranja" as const;
export const SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK =
  "produccion_ots_compras_sobrestock_umbral" as const;

export const SYS_PARAM_OTS_COMPRAS_CLAVES = [
  SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO,
  SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA,
  SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK,
] as const;

export type SysParamOtsComprasClave =
  (typeof SYS_PARAM_OTS_COMPRAS_CLAVES)[number];

/** Umbrales efectivos (días naturales hasta entrega OT). */
export type OtsComprasUmbralesParametros = {
  criticoRojo: number;
  avisoNaranja: number;
  sobrestockUmbral: number;
};

export const DEFAULT_OTS_COMPRAS_UMBRALES: OtsComprasUmbralesParametros = {
  criticoRojo: 14,
  avisoNaranja: 25,
  sobrestockUmbral: 30,
};

export type SysParametroOtsCompraRow = {
  id?: string;
  seccion?: string | null;
  clave: string;
  valor_num: number | null;
  descripcion: string | null;
  updated_at?: string | null;
};

export function mergeOtsComprasUmbralesDesdeFilas(
  filas: { clave: string; valor_num: number | null }[] | null | undefined
): OtsComprasUmbralesParametros {
  const out = { ...DEFAULT_OTS_COMPRAS_UMBRALES };
  if (!filas?.length) return out;
  for (const r of filas) {
    const v = r.valor_num;
    if (v == null || !Number.isFinite(Number(v))) continue;
    const n = Number(v);
    if (r.clave === SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO) out.criticoRojo = n;
    else if (r.clave === SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA)
      out.avisoNaranja = n;
    else if (r.clave === SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK)
      out.sobrestockUmbral = n;
  }
  return out;
}

/** Variante de semáforo según días hasta entrega (null = sin fecha). */
export type SemaforoOtEntregaVariant = "sin_fecha" | "rojo" | "naranja" | "ok";

export function semaforoOtEntregaVariant(
  diasHastaEntrega: number | null,
  u: OtsComprasUmbralesParametros
): SemaforoOtEntregaVariant {
  if (diasHastaEntrega === null) return "sin_fecha";
  if (diasHastaEntrega <= u.criticoRojo) return "rojo";
  if (diasHastaEntrega <= u.avisoNaranja) return "naranja";
  return "ok";
}

/** Clases Tailwind del chip OT (fondo sólido + texto legible sin negrita). */
export function clasesBadgeSemaforoOt(v: SemaforoOtEntregaVariant): string {
  switch (v) {
    case "rojo":
      return "bg-red-600 text-white";
    case "naranja":
      return "bg-orange-600 text-white";
    case "ok":
      return "bg-emerald-600 text-white";
    default:
      /* Sin fecha: chip sólido neutro, texto claro */
      return "bg-slate-500 text-white";
  }
}

/** Tablas maestro/compras: fondo muy claro + texto de color (sin pastilla sólida). */
export function clasesSemaforoOtSuave(v: SemaforoOtEntregaVariant): string {
  switch (v) {
    case "rojo":
      return "bg-red-50/90 text-red-800";
    case "naranja":
      return "bg-amber-50/90 text-amber-900";
    case "ok":
      return "bg-emerald-50/90 text-emerald-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

/** Punto pequeño de semáforo (p. ej. columna OT en Externos, sin pastilla). */
export function clasesPuntoSemaforoOt(v: SemaforoOtEntregaVariant): string {
  switch (v) {
    case "rojo":
      return "bg-red-500";
    case "naranja":
      return "bg-amber-500";
    case "ok":
      return "bg-emerald-500";
    default:
      return "bg-slate-400";
  }
}
