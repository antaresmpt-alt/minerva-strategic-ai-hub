import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARTELA_DATOS_KEYS,
  fetchPaletByIdStock,
  normalizeIdStockInput,
  notaConsumoCartelaPorProceso,
  parseCartelaConsumosLineasFromDatos,
  procesoUsaCartela,
  type CartelaConsumoLineaDatos,
  type PasoItinerarioConsumo,
} from "@/lib/cartela-ejecucion";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";

export type CartelaConsumoParsed = {
  paletId: string | null;
  idStock: number | null;
  hojas: number | null;
};

/**
 * Compat: 1ª línea o legacy. Para multi usa `parseCartelaConsumosLineasFromDatos`
 * / `parseCartelaConsumosCompletosFromDatos`.
 */
export function parseCartelaConsumoFromDatos(
  datos: DatosProcesoGenerico,
): CartelaConsumoParsed {
  const lineas = parseCartelaConsumosLineasFromDatos(datos);
  if (lineas.length > 0) {
    const first = lineas[0]!;
    const total = lineas.reduce((s, l) => s + l.hojas, 0);
    return {
      paletId: first.palet_id ?? null,
      idStock: first.id_stock,
      hojas: total,
    };
  }

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

/** Líneas completas listas para descontar stock. */
export function parseCartelaConsumosCompletosFromDatos(
  datos: DatosProcesoGenerico,
): CartelaConsumoLineaDatos[] {
  return parseCartelaConsumosLineasFromDatos(datos);
}

/** True si hay al menos una línea completa y debe intentarse descontar stock. */
export function debeRegistrarConsumoCartela(
  procesoId: number | null,
  datos: DatosProcesoGenerico,
  pasosItinerario?: PasoItinerarioConsumo[] | null,
): boolean {
  if (!procesoUsaCartela(procesoId, pasosItinerario)) return false;
  return parseCartelaConsumosCompletosFromDatos(datos).length > 0;
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
  },
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
  parsed: CartelaConsumoParsed,
): Promise<string | null> {
  if (parsed.paletId) return parsed.paletId;
  if (parsed.idStock == null) return null;
  const palet = await fetchPaletByIdStock(supabase, parsed.idStock);
  return palet?.id ?? null;
}

async function resolverPaletIdLinea(
  supabase: SupabaseClient,
  linea: CartelaConsumoLineaDatos,
): Promise<string | null> {
  if (linea.palet_id) return linea.palet_id;
  const palet = await fetchPaletByIdStock(supabase, linea.id_stock);
  return palet?.id ?? null;
}

/**
 * Ejecuta consumo 9.4 (1 o N cartelas). Lanza Error si hay hojas pero no se puede descontar.
 */
export async function aplicarConsumoCartelaSiCorresponde(
  supabase: SupabaseClient,
  params: {
    procesoId: number | null;
    otNumero: string;
    pasoId?: string | null;
    datos: DatosProcesoGenerico;
    pasosItinerario?: PasoItinerarioConsumo[] | null;
  },
): Promise<{ consumido: boolean; hojas: number | null }> {
  if (!debeRegistrarConsumoCartela(params.procesoId, params.datos, params.pasosItinerario)) {
    return { consumido: false, hojas: null };
  }

  const lineas = parseCartelaConsumosCompletosFromDatos(params.datos);
  let totalHojas = 0;

  for (const linea of lineas) {
    const paletId = await resolverPaletIdLinea(supabase, linea);
    if (!paletId) {
      throw new Error(
        `Hay hojas consumidas en cartela #${linea.id_stock} pero el ID Stock no existe en Minerva. Corrige la cartela o quita las hojas antes de cerrar.`,
      );
    }
    await registrarConsumoCartelaEjecucion(supabase, {
      paletId,
      hojas: linea.hojas,
      otNumero: params.otNumero,
      pasoId: params.pasoId,
      procesoId: params.procesoId,
    });
    totalHojas += linea.hojas;
  }

  return { consumido: true, hojas: totalHojas };
}

/**
 * Valida cartela(s) antes de cerrar.
 * Acepta multi (`cartela_consumos`) o legacy 1 ID.
 */
export function validarCartelaConsumoAntesCerrar(
  datos: DatosProcesoGenerico,
): string | null {
  const rawArray = datos[CARTELA_DATOS_KEYS.consumos];
  if (Array.isArray(rawArray) && rawArray.length > 0) {
    for (let i = 0; i < rawArray.length; i++) {
      const item = rawArray[i];
      if (!item || typeof item !== "object") {
        return `Consumo ${i + 1}: datos de cartela incompletos.`;
      }
      const row = item as Record<string, unknown>;
      let idStock: number | null = null;
      if (typeof row.id_stock === "number" && row.id_stock > 0) idStock = row.id_stock;
      else if (typeof row.id_stock === "string") idStock = normalizeIdStockInput(row.id_stock);
      const hojas =
        typeof row.hojas === "number" && row.hojas > 0 ? Math.round(row.hojas) : null;
      if (idStock != null && hojas == null) {
        return `Consumo ${i + 1}: indica las hojas o quita el ID Stock.`;
      }
      if (hojas != null && idStock == null) {
        return `Consumo ${i + 1}: selecciona un ID Stock o deja vacías las hojas.`;
      }
    }
    const completas = parseCartelaConsumosCompletosFromDatos(datos);
    if (completas.length === 0) {
      return "Indica al menos una cartela con hojas consumidas, o vacía los consumos.";
    }
    const ids = completas.map((l) => l.id_stock);
    const dup = ids.find((id, idx) => ids.indexOf(id) !== idx);
    if (dup != null) {
      return `La cartela #${dup} está repetida. Une las hojas en una sola línea o elige otro palet.`;
    }
    return null;
  }

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

/** True si hay ≥1 consumo completo (para cartela obligatoria en UI). */
export function cartelaConsumoCompleto(datos: DatosProcesoGenerico): boolean {
  return parseCartelaConsumosCompletosFromDatos(datos).length > 0;
}
