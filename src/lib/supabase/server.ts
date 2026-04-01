import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // RSC: cookies no siempre mutables; el middleware refresca la sesión.
          }
          void headers;
        },
      },
    }
  );
}

/** Rol en `profiles` para el usuario actual, o null si no hay sesión / fila. */
export async function getCurrentProfileRole(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role ?? null;
}

/** Email y rol para UI (Hub, UserNav). Null en /login o sin sesión. */
export async function getCurrentUserProfile(): Promise<{
  email: string;
  role: string | null;
} | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    email: user.email,
    role: profile?.role ?? null,
  };
}

/** Mapa module → allowed para el usuario actual (desde `role_permissions`). Null = usar matriz por defecto en cliente. */
export async function getModuleAccessForCurrentUser(): Promise<Record<
  string,
  boolean
> | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role;
  if (!role) return null;

  const { data: rows } = await supabase
    .from("role_permissions")
    .select("module_name, is_enabled")
    .eq("role", role);

  if (!rows?.length) return null;

  const o: Record<string, boolean> = {};
  for (const r of rows) {
    o[r.module_name] = r.is_enabled;
  }
  return o;
}
