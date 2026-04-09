import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST LIKE: escapa %, _ y \ para ilike. */
export function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const SEARCH_COLUMNS = [
  "num_troquel",
  "proveedor",
  "ref_proveedor",
  "cliente",
  "descripcion",
  "tipo_producto",
  "mides",
  "num_figuras",
  "material",
  "formato_papel",
  "figuras_hoja",
  "pinza",
  "plancha_hendidos",
  "expulsion",
  "num_expulsion",
  "taco",
  "relieve_seco",
  "caucho_acrilico",
  "maquina",
  "notas",
] as const;

export const TROQUELES_PAGE_SIZE = 150;
export const TROQUELES_MAX_ROWS = 3000;
export const TROQUELES_CLIENTE_FETCH_CHUNK = 1000;

/**
 * Cadena `.or()` para Supabase: búsqueda insensible en columnas texto.
 * Si `term` está vacío, no aplica filtro de texto (devuelve null).
 */
/** Las comas rompen el operador `.or()` de PostgREST. */
export function sanitizeTroquelesSearchInput(s: string): string {
  return s.replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

export function troquelesSearchOrFilter(term: string): string | null {
  const t = sanitizeTroquelesSearchInput(term);
  if (!t) return null;
  const esc = escapeIlikePattern(t);
  const p = `%${esc}%`;
  return SEARCH_COLUMNS.map((col) => `${col}.ilike.${p}`).join(",");
}

type TroquelesQueryOpts = {
  search: string;
  /** Valor exacto de cliente o null = todos */
  cliente: string | null;
  offset: number;
  limit: number;
};

/**
 * Consulta paginada sobre prod_troqueles (filtros en servidor).
 */
export function troquelesSelectFiltered(
  supabase: SupabaseClient,
  { search, cliente, offset, limit }: TroquelesQueryOpts
) {
  let q = supabase.from("prod_troqueles").select("*", { count: "exact" });

  if (cliente) {
    q = q.eq("cliente", cliente);
  }

  const orFilter = troquelesSearchOrFilter(search);
  if (orFilter) {
    q = q.or(orFilter);
  }

  return q
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
}

/**
 * Misma lógica de filtro, hasta `maxRows` filas (p. ej. asistente IA o export).
 */
export function troquelesSelectFilteredAll(
  supabase: SupabaseClient,
  {
    search,
    cliente,
    maxRows,
  }: {
    search: string;
    cliente: string | null;
    maxRows: number;
  }
) {
  let q = supabase.from("prod_troqueles").select("*");

  if (cliente) {
    q = q.eq("cliente", cliente);
  }

  const orFilter = troquelesSearchOrFilter(search);
  if (orFilter) {
    q = q.or(orFilter);
  }

  return q
    .order("created_at", { ascending: false })
    .range(0, maxRows - 1);
}

/**
 * Obtiene clientes distintos recorriendo la tabla por bloques (solo columna cliente).
 */
export async function fetchDistinctClientes(
  supabase: SupabaseClient
): Promise<string[]> {
  const set = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("prod_troqueles")
      .select("cliente")
      .not("cliente", "is", null)
      .order("id", { ascending: true })
      .range(from, from + TROQUELES_CLIENTE_FETCH_CHUNK - 1);

    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      const c = String(row.cliente ?? "").trim();
      if (c) set.add(c);
    }
    if (batch.length < TROQUELES_CLIENTE_FETCH_CHUNK) break;
    from += TROQUELES_CLIENTE_FETCH_CHUNK;
    if (from > 200000) break;
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}
