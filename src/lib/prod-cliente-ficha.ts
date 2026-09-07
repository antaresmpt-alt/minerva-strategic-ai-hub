import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeClienteNombre,
  type ProdClienteFichaRow,
  type ProdClienteFichaUpsert,
} from "@/types/prod-cliente-ficha";

const TABLE = "prod_cliente_ficha";

export async function fetchClienteFichaByCliente(
  supabase: SupabaseClient,
  cliente: string | null | undefined,
): Promise<ProdClienteFichaRow | null> {
  const key = normalizeClienteNombre(cliente);
  if (!key) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("cliente", key)
    .maybeSingle();
  if (error) throw error;
  return (data as ProdClienteFichaRow | null) ?? null;
}

/** Mapa cliente → ficha (para PDF lote / listado). */
export async function fetchClienteFichasMap(
  supabase: SupabaseClient,
  clientes: readonly string[],
): Promise<Map<string, ProdClienteFichaRow>> {
  const keys = [
    ...new Set(
      clientes.map(normalizeClienteNombre).filter((c) => c.length > 0),
    ),
  ];
  const out = new Map<string, ProdClienteFichaRow>();
  if (keys.length === 0) return out;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .in("cliente", keys);
  if (error) throw error;
  for (const row of (data ?? []) as ProdClienteFichaRow[]) {
    out.set(normalizeClienteNombre(row.cliente), row);
  }
  return out;
}

export async function upsertClienteFicha(
  supabase: SupabaseClient,
  input: ProdClienteFichaUpsert,
): Promise<ProdClienteFichaRow> {
  const cliente = normalizeClienteNombre(input.cliente);
  if (!cliente) throw new Error("Indica el nombre del cliente.");
  const payload = {
    cliente,
    registro_sanitario:
      input.registro_sanitario != null
        ? String(input.registro_sanitario).trim() || null
        : null,
    temperatura_conservacion:
      input.temperatura_conservacion != null
        ? String(input.temperatura_conservacion).trim() || null
        : null,
    notas:
      input.notas != null ? String(input.notas).trim() || null : null,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "cliente" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProdClienteFichaRow;
}
