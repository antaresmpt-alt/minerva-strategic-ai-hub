import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARTELA_DATOS_KEYS,
  fetchPaletByIdStock,
  normalizeIdStockInput,
  notaConsumoCartelaPorProceso,
  procesoUsaCartela,
  type PasoItinerarioConsumo,
} from "@/lib/cartela-ejecucion";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";

export type CartelaConsumoParsed = {
  paletId: string | null;
  idStock: number | null;
  hojas: number | null;
};

export function parseCartelaConsumoFromDatos(
  datos: DatosProcesoGenerico
): CartelaConsumoParsed {
  const paletIdRaw = datos[CARTELA_DATOS_KEYS.paletId];
  const paletId =
    typeof paletIdRaw === "string" && paletIdRaw.trim()
      ? paletIdRaw.trim()
      : null;

  const idStockRaw = datos[CARTELA_DATOS_KEYS.idStock];
  let idStock: number | null = null;
  if (typeof idStockRaw === "number" && idStockRaw > 0) idStock = idStockRaw;
  else if (typeof idStockRaw === "string") idStock = normalizeIdStockInput(idStockRaw);

  const hojasRaw = datos[CARTELA_DATOS_KEYS.hojasConsumidas];
  const hojas =
    typeof hojasRaw === "number" && hojasRaw > 0
      ? Math.round(hojasRaw)
      : null;

  return { paletId, idStock, hojas };
}

/** True si hay hojas declaradas y debe intentarse descontar stock. */
export function debeRegistrarConsumoCartela(
  procesoId: number | null,
  datos: DatosProcesoGenerico,
  pasosItinerario?: PasoItinerarioConsumo[] | null,
): boolean {
  if (!procesoUsaCartela(procesoId, pasosItinerario)) return false;
  const parsed = parseCartelaConsumoFromDatos(datos);
  const tienePalet = parsed.paletId != null || parsed.idStock != null;
  return (
    parsed.hojas != null &&
    parsed.hojas > 0 &&
    tienePalet
  );
}

/**
 * Descuenta stock vía RPC atómica. Requiere palet resuelto y hojas > 0.
 */
export async function registrarConsumoCartelaEjecucion(
  supabase: SupabaseClient,
  params: {
    paletId: string;
    hojas: number;
    otNumero: string;
    pasoId?: string | null;
    procesoId?: number | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("prod_stock_registrar_consumo", {
    p_palet_id: params.paletId,
    p_cantidad: params.hojas,
    p_ot_numero: params.otNumero,
    p_paso_id: params.pasoId ?? null,
    p_notas: notaConsumoCartelaPorProceso(params.procesoId ?? null),
  });
  if (error) {
    throw new Error(error.message || "No se pudo descontar el stock de la cartela.");
  }
}

export async function resolverPaletIdParaConsumo(
  supabase: SupabaseClient,
  parsed: CartelaConsumoParsed
): Promise<string | null> {
  if (parsed.paletId) return parsed.paletId;
  if (parsed.idStock == null) return null;
  const palet = await fetchPaletByIdStock(supabase, parsed.idStock);
  return palet?.id ?? null;
}

/**
 * Ejecuta consumo 9.4 si aplica. Lanza Error si hay hojas pero no se puede descontar.
 */
export async function aplicarConsumoCartelaSiCorresponde(
  supabase: SupabaseClient,
  params: {
    procesoId: number | null;
    otNumero: string;
    pasoId?: string | null;
    datos: DatosProcesoGenerico;
    pasosItinerario?: PasoItinerarioConsumo[] | null;
  }
): Promise<{ consumido: boolean; hojas: number | null }> {
  if (!debeRegistrarConsumoCartela(params.procesoId, params.datos, params.pasosItinerario)) {
    return { consumido: false, hojas: null };
  }

  const parsed = parseCartelaConsumoFromDatos(params.datos);
  const hojas = parsed.hojas!;
  const paletId = await resolverPaletIdParaConsumo(supabase, parsed);

  if (!paletId) {
    throw new Error(
      "Hay hojas consumidas declaradas pero el ID Stock no existe en Minerva. Corrige la cartela o quita las hojas antes de cerrar."
    );
  }

  await registrarConsumoCartelaEjecucion(supabase, {
    paletId,
    hojas,
    otNumero: params.otNumero,
    pasoId: params.pasoId,
    procesoId: params.procesoId,
  });

  return { consumido: true, hojas };
}

/** Valida cartela parcial antes de cerrar (id sin hojas o hojas sin id). */
export function validarCartelaConsumoAntesCerrar(
  datos: DatosProcesoGenerico,
): string | null {
  const parsed = parseCartelaConsumoFromDatos(datos);
  const hasId = parsed.paletId != null || parsed.idStock != null;
  const hasHojas = parsed.hojas != null && parsed.hojas > 0;
  if (hasId && !hasHojas) {
    return "Indica las hojas consumidas de la cartela o quita el ID Stock.";
  }
  if (hasHojas && !hasId) {
    return "Selecciona un ID Stock válido o deja vacías las hojas de cartela.";
  }
  return null;
}
