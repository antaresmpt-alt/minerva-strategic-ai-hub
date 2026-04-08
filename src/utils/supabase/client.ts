import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para componentes cliente (Next.js App Router).
 * Usa cookies gestionadas por @supabase/ssr; el middleware sincroniza la sesión.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
