import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | undefined;

/**
 * Cliente Supabase para componentes cliente (Next.js App Router).
 * Singleton por pestaña: evita contención del lock de auth en localStorage.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
