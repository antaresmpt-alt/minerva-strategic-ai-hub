import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveRecepcionFotoPublicUrls } from "@/lib/recepcion-fotos-url";

/** Carga URLs públicas de fotos agrupadas por recepcion_id. */
export async function fetchFotosByRecepcionIds(
  supabase: SupabaseClient,
  recepcionIds: string[]
): Promise<Record<string, string[]>> {
  const ids = [...new Set(recepcionIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("prod_recepciones_fotos")
    .select("recepcion_id, foto_url")
    .in("recepcion_id", ids);

  if (error) throw error;

  const rawByRecepcion: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const rid = String(row.recepcion_id ?? "").trim();
    const url = typeof row.foto_url === "string" ? row.foto_url.trim() : "";
    if (!rid || !url) continue;
    if (!rawByRecepcion[rid]) rawByRecepcion[rid] = [];
    rawByRecepcion[rid].push(url);
  }

  const out: Record<string, string[]> = {};
  for (const [rid, raw] of Object.entries(rawByRecepcion)) {
    out[rid] = resolveRecepcionFotoPublicUrls(supabase, raw);
  }
  return out;
}

/** Une listas de URLs sin duplicados (orden estable). */
export function mergeFotoUrls(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const url of list ?? []) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}
