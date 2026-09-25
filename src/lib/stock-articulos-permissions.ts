import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileCapacidad } from "@/types/prod-stock-articulos";

const WRITE_ROLES = new Set([
  "admin",
  "gerencia",
  "administracion",
  "almacen",
  "oficina_tecnica",
  "logistica",
]);

/** Roles con escritura por rol (sin capacidad extra). */
export function roleCanWriteStockArticulos(role: string | null | undefined): boolean {
  if (!role) return false;
  return WRITE_ROLES.has(role.trim().toLowerCase());
}

/**
 * Lectura de la bandeja: quien ya entra en Producción (engomado incluido).
 * Escritura: rol writer O capacidad stock_articulos_write.
 */
export function canWriteStockArticulosClient(
  role: string | null | undefined,
  capacidades: ReadonlySet<string> | ProfileCapacidad[] | null | undefined
): boolean {
  if (roleCanWriteStockArticulos(role)) return true;
  if (!capacidades) return false;
  if (capacidades instanceof Set) {
    return capacidades.has("stock_articulos_write");
  }
  return Array.isArray(capacidades) && capacidades.includes("stock_articulos_write");
}

export async function fetchProfileCapacidades(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("profiles_capacidades")
    .select("capacidad")
    .eq("user_id", userId);
  if (error || !data) return new Set();
  return new Set(
    data
      .map((r) => (typeof r.capacidad === "string" ? r.capacidad : ""))
      .filter(Boolean)
  );
}
