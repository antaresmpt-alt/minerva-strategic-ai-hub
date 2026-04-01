import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Fila de `public.role_permissions` (lectura API / Supabase). */
export type RolePermissionRow = {
  role: string;
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
      .eq("role", role);
    if (error || !data?.length) {
      return null;
    }
    const m = new Map<string, boolean>();
    for (const row of data) {
      m.set(row.module_name, row.is_enabled);
    }
    return m;
  } catch {
    return null;
  }
}
