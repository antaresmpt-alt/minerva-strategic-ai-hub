import type { SupabaseClient } from "@supabase/supabase-js";

import { getCamposConfigByProcesoId } from "@/lib/hoja-ruta-campos-config";

/** IDs de procesos externos de familia hojas (plastificado, stamping, UVI, impresión ext.). */
export const EXTERNO_HOJAS_PROCESO_IDS = [3, 4, 5, 6, 9, 21] as const;

export type ExternoCantidadModo = "enviado" | "recibido";

export type PasoBriefSource = {
  id?: string | null;
  orden: number;
  procesoId: number | null;
  estado: string;
  datosProceso: Record<string, unknown> | null;
};

export type DespachoBriefSource = {
  material: string | null;
  gramaje: number | null;
  tamanoHoja: string | null;
  tintas: string | null;
  hojasNetas: number | null;
  hojasBrutas: number | null;
};

export type ExternoEnvioBrief = {
  formato: string | null;
  formatoOrigen: string | null;
  material: string | null;
  tintas: string | null;
  hojasSugeridas: number | null;
  hojasSugeridasOrigen: string | null;
};

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function asPositiveInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function parseHojasPositive(raw: string): number | null {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function materialFromDespacho(d: DespachoBriefSource | null): string | null {
  if (!d) return null;
  const mat = asStr(d.material);
  if (!mat) return null;
  return d.gramaje != null ? `${mat} ${d.gramaje}g` : mat;
}

function tintasFromDatos(datos: Record<string, unknown> | null): string | null {
  if (!datos) return null;
  const cara = asStr(datos.tintas_cara);
  const dorso = asStr(datos.tintas_dorso);
  if (cara && dorso && dorso !== "0") return `${cara}+${dorso}`;
  return cara ?? dorso;
}

/**
 * Resuelve formato / material / tintas / hojas sugeridas recorriendo
 * pasos finalizados hacia atrás y cayendo a despacho.
 */
export function resolveExternoEnvioBrief(args: {
  despacho: DespachoBriefSource | null;
  pasos: PasoBriefSource[];
  currentPasoId?: string | null;
  currentOrden?: number | null;
  hojasYaEnSeguimiento?: number | null;
}): ExternoEnvioBrief {
  const { despacho, pasos } = args;
  const current = args.currentPasoId
    ? pasos.find((p) => String(p.id ?? "") === String(args.currentPasoId))
    : null;
  const currentOrden = current?.orden ?? args.currentOrden ?? Number.POSITIVE_INFINITY;

  const anteriores = [...pasos]
    .filter((p) => p.orden < currentOrden)
    .sort((a, b) => b.orden - a.orden);

  let formato: string | null = null;
  let formatoOrigen: string | null = null;
  let material: string | null = null;
  let tintas: string | null = null;
  let hojasDePaso: number | null = null;
  let hojasDePasoOrigen: string | null = null;

  for (const paso of anteriores) {
    const estado = String(paso.estado ?? "").trim().toLowerCase();
    if (estado !== "finalizado") continue;
    const dp = paso.datosProceso;
    const pid = paso.procesoId;
    if (pid == null) continue;

    if (!formato) {
      const cfg = getCamposConfigByProcesoId(pid);
      const fromOut = cfg?.formatOutputField ? asStr(dp?.[cfg.formatOutputField]) : null;
      const fromIn = cfg?.formatInputField ? asStr(dp?.[cfg.formatInputField]) : null;
      const fmt = fromOut ?? fromIn;
      if (fmt) {
        formato = fmt;
        formatoOrigen = cfg?.procesoNombre ?? `paso ${paso.orden}`;
      }
    }

    if (!material) {
      const m = asStr(dp?.material_impresion);
      if (m) material = m;
    }

    if (!tintas) {
      const t = tintasFromDatos(dp);
      if (t) tintas = t;
    }

    if (hojasDePaso == null) {
      const cfg = getCamposConfigByProcesoId(pid);
      const outId = cfg?.outputField;
      const fromOut = outId ? asPositiveInt(dp?.[outId]) : null;
      const fromImp = asPositiveInt(dp?.hojas_impresas);
      const fromGuillo = asPositiveInt(dp?.hojas_finales);
      const n = fromOut ?? fromImp ?? fromGuillo;
      if (n != null) {
        hojasDePaso = n;
        hojasDePasoOrigen = cfg?.procesoNombre ?? `paso ${paso.orden}`;
      }
    }

    if (formato && material && tintas && hojasDePaso != null) break;
  }

  if (!formato && despacho?.tamanoHoja) {
    formato = despacho.tamanoHoja;
    formatoOrigen = "Despacho (formato compra)";
  }
  if (!material) material = materialFromDespacho(despacho);
  if (!tintas) tintas = asStr(despacho?.tintas);

  const ya = asPositiveInt(args.hojasYaEnSeguimiento);
  const hojasNetas = asPositiveInt(despacho?.hojasNetas);
  const hojasBrutas = asPositiveInt(despacho?.hojasBrutas);

  let hojasSugeridas: number | null = null;
  let hojasSugeridasOrigen: string | null = null;
  if (ya != null) {
    hojasSugeridas = ya;
    hojasSugeridasOrigen = "Seguimiento externo";
  } else if (hojasDePaso != null) {
    hojasSugeridas = hojasDePaso;
    hojasSugeridasOrigen = hojasDePasoOrigen;
  } else if (hojasNetas != null) {
    hojasSugeridas = hojasNetas;
    hojasSugeridasOrigen = "Despacho (netas)";
  } else if (hojasBrutas != null) {
    hojasSugeridas = hojasBrutas;
    hojasSugeridasOrigen = "Despacho (brutas)";
  }

  return {
    formato,
    formatoOrigen,
    material,
    tintas,
    hojasSugeridas,
    hojasSugeridasOrigen,
  };
}

export function resolveExternoRecibidoHojasSugeridas(args: {
  hojasEnviadas?: number | null;
  hojasRecibidasMuelle?: number | null;
}): { hojasSugeridas: number | null; hojasSugeridasOrigen: string | null } {
  const rec = asPositiveInt(args.hojasRecibidasMuelle);
  if (rec != null) {
    return { hojasSugeridas: rec, hojasSugeridasOrigen: "Muelle / ya informado" };
  }
  const env = asPositiveInt(args.hojasEnviadas);
  if (env != null) {
    return { hojasSugeridas: env, hojasSugeridasOrigen: "Hojas enviadas" };
  }
  return { hojasSugeridas: null, hojasSugeridasOrigen: null };
}

type PasoRow = {
  id: string;
  ot_id: string | null;
  orden: number | null;
  estado: string | null;
  proceso_id: number | null;
  datos_proceso: Record<string, unknown> | null;
};

/**
 * Carga despacho + itinerario para armar el brief del modal de Ramón.
 */
export async function fetchExternoEnvioBrief(
  supabase: SupabaseClient,
  args: {
    otNumero: string;
    otPasoId?: string | null;
    hojasYaEnSeguimiento?: number | null;
  },
): Promise<ExternoEnvioBrief> {
  const ot = String(args.otNumero ?? "").trim();
  const { data: despRow } = await supabase
    .from("produccion_ot_despachadas")
    .select("material, gramaje, tamano_hoja, tintas, num_hojas_netas, num_hojas_brutas")
    .eq("ot_numero", ot)
    .order("despachado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const despacho: DespachoBriefSource | null = despRow
    ? {
        material: asStr(despRow.material),
        gramaje:
          typeof despRow.gramaje === "number"
            ? despRow.gramaje
            : asPositiveInt(despRow.gramaje),
        tamanoHoja: asStr(despRow.tamano_hoja),
        tintas: asStr(despRow.tintas),
        hojasNetas: asPositiveInt(despRow.num_hojas_netas),
        hojasBrutas: asPositiveInt(despRow.num_hojas_brutas),
      }
    : null;

  let pasos: PasoBriefSource[] = [];
  let currentOrden: number | null = null;
  const pasoId = String(args.otPasoId ?? "").trim();
  if (pasoId) {
    const { data: current } = await supabase
      .from("prod_ot_pasos")
      .select("id, ot_id, orden")
      .eq("id", pasoId)
      .maybeSingle();
    currentOrden = typeof current?.orden === "number" ? current.orden : null;
    const otId = String(current?.ot_id ?? "").trim();
    if (otId) {
      const { data: pasoRows } = await supabase
        .from("prod_ot_pasos")
        .select("id, ot_id, orden, estado, proceso_id, datos_proceso")
        .eq("ot_id", otId)
        .order("orden", { ascending: true });
      pasos = ((pasoRows ?? []) as PasoRow[]).map((p) => ({
        id: p.id,
        orden: typeof p.orden === "number" ? p.orden : 0,
        procesoId: typeof p.proceso_id === "number" ? p.proceso_id : null,
        estado: String(p.estado ?? ""),
        datosProceso:
          p.datos_proceso && typeof p.datos_proceso === "object" ? p.datos_proceso : null,
      }));
    }
  }

  return resolveExternoEnvioBrief({
    despacho,
    pasos,
    currentPasoId: pasoId || null,
    currentOrden,
    hojasYaEnSeguimiento: args.hojasYaEnSeguimiento,
  });
}

export async function mergeDatosProcesoExternoPaso(
  supabase: SupabaseClient,
  otPasoId: string | null | undefined,
  patch: Record<string, unknown>,
): Promise<void> {
  const id = String(otPasoId ?? "").trim();
  if (!id) return;
  const { data, error } = await supabase
    .from("prod_ot_pasos")
    .select("datos_proceso")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const prev =
    data?.datos_proceso && typeof data.datos_proceso === "object"
      ? (data.datos_proceso as Record<string, unknown>)
      : {};
  const { error: upErr } = await supabase
    .from("prod_ot_pasos")
    .update({ datos_proceso: { ...prev, ...patch } })
    .eq("id", id);
  if (upErr) throw upErr;
}
