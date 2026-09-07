/** Bloque 14 — Defaults ficha técnica a nivel cliente (RGS, temperatura). */

export type ProdClienteFichaRow = {
  id: string;
  cliente: string;
  registro_sanitario: string | null;
  temperatura_conservacion: string | null;
  notas: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProdClienteFichaUpsert = {
  cliente: string;
  registro_sanitario?: string | null;
  temperatura_conservacion?: string | null;
  notas?: string | null;
};

/** Normaliza nombre cliente para match (trim, colapsar espacios). */
export function normalizeClienteNombre(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
