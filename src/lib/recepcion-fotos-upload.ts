import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_FOTOS = "recepciones-fotos";
const TABLE_RECEPCION_FOTOS = "prod_recepciones_fotos";

function extFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".gif")) return "gif";
  return "jpg";
}

/** Sube fotos de albarán y registra filas en prod_recepciones_fotos. */
export async function uploadRecepcionFotos(
  supabase: SupabaseClient,
  recepcionId: string,
  files: File[]
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const path = `${recepcionId}/${crypto.randomUUID()}.${extFromFile(f)}`;
    const { error: uErr } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(path, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || "image/jpeg",
      });
    if (uErr) throw uErr;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);

    const { error: insErr } = await supabase.from(TABLE_RECEPCION_FOTOS).insert({
      recepcion_id: recepcionId,
      foto_url: publicUrl || path,
    });
    if (insErr) throw insErr;
  }
}
