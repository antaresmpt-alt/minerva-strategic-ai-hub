import type { Database } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UserRole = Database["public"]["Enums"]["user_role"];

/** Fila de `public.role_permissions` (lectura API / Supabase). */
export type RolePermissionRow = {
  role: UserRole;
  module_name: string;
  is_enabled: boolean;
};

/** Carga permisos desde `role_permissions` (service role; usa en middleware). */
export async function fetchRolePermissionMap(
  role: string
): Promise<Map<string, boolean> | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return null;
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("module_name, is_enabled")
      .eq("role", role as UserRole);
    if (error || !data?.length) {
      return null;
    }
    const m = new Map<string, boolean>();
    for (const row of data) {
      m.set(row.module_name, row.is_enabled ?? false);
    }
    return m;
  } catch {
    return null;
  }
}
