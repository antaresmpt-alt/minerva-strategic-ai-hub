import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeOtTipo } from "@/lib/planificacion-contenedor-query";

/**
 * Bloque 6 MVP — Helper de estado derivado "pendiente de revisión".
 *
 * Una OT está pendiente de revisión si:
 * 1. Es simple (ot_tipo null o 'simple') — contenedores/hijas tienen flujo distinto (Fase 8.4)
 * 2. Itinerario completo (todos los pasos en estado 'finalizado')
 * 3. Aún NO está archivada (sin fila en prod_ot_producidas)
 *
 * Esto es un estado DERIVADO; no hay columna prod_ots_general.estado_cierre en el MVP.
 */

/**
 * ¿Es esta OT "simple" (no contenedor/hija)?
 * Contenedores y hijas tienen flujo de cierre distinto (Fase 8.4).
 */
export function esOtSimple(otTipo: string | null | undefined): boolean {
  const tipo = normalizeOtTipo(otTipo);
  return tipo === null || tipo === "simple";
}

/**
 * ¿Está el itinerario completo (todos los pasos finalizados)?
 */
export function itinerarioCompleto(pasos: { estado: string | null }[]): boolean {
  if (pasos.length === 0) return false;
  return pasos.every((p) => String(p.estado ?? "").trim().toLowerCase() === "finalizado");
}

/**
 * ¿Está esta OT ya archivada en prod_ot_producidas?
 * (cualquier version; en MVP solo existirá version=1)
 */
export async function estaOtArchivada(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("prod_ot_producidas")
    .select("id")
    .eq("ot_numero", otNumero)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/**
 * ¿Está esta OT pendiente de revisión (lista para cerrar)?
 * Combina las tres condiciones: simple + itinerario completo + no archivada.
 */
export async function isOtPendienteRevision(
  supabase: SupabaseClient,
  otNumero: string,
  otTipo: string | null | undefined,
  pasos: { estado: string | null }[],
): Promise<boolean> {
  if (!esOtSimple(otTipo)) return false;
  if (!itinerarioCompleto(pasos)) return false;
  const archivada = await estaOtArchivada(supabase, otNumero);
  return !archivada;
}
