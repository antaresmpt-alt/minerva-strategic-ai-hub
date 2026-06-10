/**
 * Helpers anti-duplicados para `prod_etiquetas_hoja_ruta` (Fase 1: solo UI).
 *
 * Mientras existan duplicados históricos en la tabla, no podemos añadir
 * un `UNIQUE (ot_numero)` en la BD (la migración fallaría). Este módulo
 * implementa la defensa en la UI: antes de insertar una fila nueva,
 * buscamos otras con el mismo `ot_numero` y dejamos al usuario decidir
 * (abrir la existente, o cancelar).
 *
 * Cuando se limpien los duplicados, ver migración pendiente en
 * `supabase/migrations/.pending/prod_etiquetas_hoja_ruta_ot_unique.sql`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

const TABLE_HR = "prod_etiquetas_hoja_ruta";

/** Normaliza un número de OT para comparaciones (trim + uppercase). */
export function normalizaOtNumero(input: string | null | undefined): string {
  return String(input ?? "")
    .trim()
    .toUpperCase();
}

/** OTs manuales de etiquetas que no existen en OT maestro (ej: FICT-001). */
export function isOtFicticia(input: string | null | undefined): boolean {
  return /^FICT-.+$/i.test(String(input ?? "").trim());
}

/**
 * Devuelve todas las filas en `prod_etiquetas_hoja_ruta` que coinciden con
 * `otNumero` (tras normalizar). Ordenadas de más reciente a más antigua.
 * Devuelve `[]` si no hay coincidencias o si `otNumero` está vacío.
 */
export async function findHojaRutaPorOtNumero(
  supabase: SupabaseClient,
  otNumero: string
): Promise<ProdEtiquetasHojaRutaRow[]> {
  const num = normalizaOtNumero(otNumero);
  if (!num) return [];
  const { data, error } = await supabase
    .from(TABLE_HR)
    .select("*")
    .eq("ot_numero", num)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as ProdEtiquetasHojaRutaRow[];
}

/**
 * Variante para edición: busca duplicados con un `ot_numero` dado,
 * excluyendo una fila por id (la que estamos editando).
 */
export async function findHojaRutaPorOtNumeroExcepto(
  supabase: SupabaseClient,
  otNumero: string,
  exceptId: string
): Promise<ProdEtiquetasHojaRutaRow[]> {
  const num = normalizaOtNumero(otNumero);
  if (!num) return [];
  const { data, error } = await supabase
    .from(TABLE_HR)
    .select("*")
    .eq("ot_numero", num)
    .neq("id", exceptId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as ProdEtiquetasHojaRutaRow[];
}
