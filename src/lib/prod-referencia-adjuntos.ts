import type { SupabaseClient } from "@supabase/supabase-js";

export const REFERENCIAS_ADJUNTOS_BUCKET = "referencias-adjuntos";
export const MAX_ADJUNTO_BYTES = 15 * 1024 * 1024;

/** Mismos formatos en foto producto y troquel/perfil (sin distinción). */
export const ADJUNTO_ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/x-ms-bmp",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/tif",
] as const;

export const ADJUNTO_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/bmp,image/webp,image/gif,image/tiff,.pdf,.jpg,.jpeg,.png,.bmp,.webp,.gif,.tif,.tiff";

export const ADJUNTO_HINT =
  "PDF, JPG, PNG, BMP, WEBP, GIF… · máx. 15 MB";

export type ReferenciaAdjuntoTipo = "foto_producto" | "perfil_troquel";

export type ProdReferenciaAdjuntoRow = {
  id: string;
  referencia_id: string;
  tipo: string;
  storage_path: string;
  public_url: string | null;
  created_by: string | null;
  created_at: string | null;
};

function normalizeMime(file: File): string {
  const t = (file.type || "").toLowerCase().trim();
  if (t) {
    if (t === "image/jpg") return "image/jpeg";
    if (t === "image/x-bmp") return "image/bmp";
    return t;
  }
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".bmp")) return "image/bmp";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".tif") || n.endsWith(".tiff")) return "image/tiff";
  return "";
}

function extFromMime(mime: string, fileName: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/bmp" || mime === "image/x-ms-bmp") return "bmp";
  if (mime === "image/tiff" || mime === "image/tif") return "tiff";
  if (mime === "image/jpeg") return "jpg";
  const n = fileName.toLowerCase();
  const m = n.match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "bin";
}

export function validateReferenciaAdjuntoFile(
  _tipo: ReferenciaAdjuntoTipo,
  file: File,
): string | null {
  if (file.size <= 0) return "Archivo vacío.";
  if (file.size > MAX_ADJUNTO_BYTES) {
    return `Máximo ${Math.round(MAX_ADJUNTO_BYTES / (1024 * 1024))} MB.`;
  }
  const mime = normalizeMime(file);
  if (
    !mime ||
    !(ADJUNTO_ALLOWED_MIMES as readonly string[]).includes(mime)
  ) {
    return "Formato no admitido. Usa PDF, JPG, PNG, BMP, WEBP o GIF.";
  }
  return null;
}

export function isImageStoragePath(pathOrUrl: string | null | undefined): boolean {
  const s = String(pathOrUrl ?? "").toLowerCase();
  return /\.(png|jpe?g|bmp|webp|gif|tiff?)(\?|$)/i.test(s);
}

export function isPdfStoragePath(pathOrUrl: string | null | undefined): boolean {
  const s = String(pathOrUrl ?? "").toLowerCase();
  return /\.pdf(\?|$)/i.test(s);
}

export async function fetchAdjuntosByReferencia(
  supabase: SupabaseClient,
  referenciaId: string,
): Promise<ProdReferenciaAdjuntoRow[]> {
  const { data, error } = await supabase
    .from("prod_referencia_adjuntos")
    .select("*")
    .eq("referencia_id", referenciaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProdReferenciaAdjuntoRow[];
}

export function publicUrlForStoragePath(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  const { data } = supabase.storage
    .from(REFERENCIAS_ADJUNTOS_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Sube un adjunto, registra fila y actualiza foto_*_path en prod_referencias.
 * Sustituye el adjunto previo del mismo tipo (borra storage + fila).
 */
export async function uploadReferenciaAdjunto(
  supabase: SupabaseClient,
  opts: {
    referenciaId: string;
    codigo: string;
    tipo: ReferenciaAdjuntoTipo;
    file: File;
    userId?: string | null;
  },
): Promise<{ storagePath: string; publicUrl: string }> {
  const err = validateReferenciaAdjuntoFile(opts.tipo, opts.file);
  if (err) throw new Error(err);

  const mime = normalizeMime(opts.file);
  const ext = extFromMime(mime, opts.file.name);
  const safeCodigo = opts.codigo.trim().replace(/[^\w.-]+/g, "_") || "ref";
  const storagePath = `${safeCodigo}/${opts.tipo}/${crypto.randomUUID()}.${ext}`;

  // Quitar adjunto previo del mismo tipo
  const { data: prev } = await supabase
    .from("prod_referencia_adjuntos")
    .select("id, storage_path")
    .eq("referencia_id", opts.referenciaId)
    .eq("tipo", opts.tipo);

  for (const row of prev ?? []) {
    const path = String((row as { storage_path?: string }).storage_path ?? "");
    if (path) {
      await supabase.storage.from(REFERENCIAS_ADJUNTOS_BUCKET).remove([path]);
    }
    await supabase
      .from("prod_referencia_adjuntos")
      .delete()
      .eq("id", (row as { id: string }).id);
  }

  const { error: upErr } = await supabase.storage
    .from(REFERENCIAS_ADJUNTOS_BUCKET)
    .upload(storagePath, opts.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: mime || opts.file.type || undefined,
    });
  if (upErr) throw upErr;

  const publicUrl = publicUrlForStoragePath(supabase, storagePath);

  const { error: insErr } = await supabase.from("prod_referencia_adjuntos").insert({
    referencia_id: opts.referenciaId,
    tipo: opts.tipo,
    storage_path: storagePath,
    public_url: publicUrl,
    created_by: opts.userId ?? null,
  });
  if (insErr) throw insErr;

  const pathCol =
    opts.tipo === "foto_producto" ? "foto_producto_path" : "foto_troquel_path";
  const { error: updErr } = await supabase
    .from("prod_referencias")
    .update({ [pathCol]: storagePath })
    .eq("id", opts.referenciaId);
  if (updErr) throw updErr;

  return { storagePath, publicUrl };
}

export async function removeReferenciaAdjunto(
  supabase: SupabaseClient,
  opts: {
    referenciaId: string;
    tipo: ReferenciaAdjuntoTipo;
  },
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("prod_referencia_adjuntos")
    .select("id, storage_path")
    .eq("referencia_id", opts.referenciaId)
    .eq("tipo", opts.tipo);
  if (error) throw error;

  for (const row of rows ?? []) {
    const path = String((row as { storage_path?: string }).storage_path ?? "");
    if (path) {
      await supabase.storage.from(REFERENCIAS_ADJUNTOS_BUCKET).remove([path]);
    }
    await supabase
      .from("prod_referencia_adjuntos")
      .delete()
      .eq("id", (row as { id: string }).id);
  }

  const pathCol =
    opts.tipo === "foto_producto" ? "foto_producto_path" : "foto_troquel_path";
  const { error: updErr } = await supabase
    .from("prod_referencias")
    .update({ [pathCol]: null })
    .eq("id", opts.referenciaId);
  if (updErr) throw updErr;
}
