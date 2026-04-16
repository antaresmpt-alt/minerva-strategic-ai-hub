import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_RECEPCIONES_FOTOS = "recepciones-fotos";

/**
 * Normaliza entradas de `prod_recepciones_fotos.foto_url` a URL pública del bucket.
 * Acepta URL absoluta ya guardada o solo el `path` dentro del bucket (como en Storage).
 */
export function resolveRecepcionFotoPublicUrls(
  supabase: SupabaseClient,
  rawList: string[] | null | undefined
): string[] {
  if (!rawList?.length) return [];
  const out: string[] = [];
  for (const raw of rawList) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) {
      out.push(t);
      continue;
    }
    let path = t.replace(/^\/+/, "");
    if (path.startsWith(`${BUCKET_RECEPCIONES_FOTOS}/`)) {
      path = path.slice(BUCKET_RECEPCIONES_FOTOS.length + 1);
    }
    const { data } = supabase.storage
      .from(BUCKET_RECEPCIONES_FOTOS)
      .getPublicUrl(path);
    if (data?.publicUrl) out.push(data.publicUrl);
  }
  return out;
}
