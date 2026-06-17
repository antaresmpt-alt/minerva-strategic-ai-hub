/** Tamaño seguro para filtros `.in()` en PostgREST (evita 400 por URL demasiado larga). */
export const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

export function chunkValues<T>(
  values: readonly T[],
  chunkSize = SUPABASE_IN_FILTER_CHUNK_SIZE,
): T[][] {
  const unique = [...new Set(values)];
  const size = Math.max(1, Math.trunc(chunkSize));
  const out: T[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    out.push(unique.slice(i, i + size));
  }
  return out;
}

export async function fetchAllInChunks<T, V>(
  values: readonly V[],
  chunkSize: number,
  fetchChunk: (chunk: V[]) => Promise<T[]>,
): Promise<T[]> {
  const chunks = chunkValues(values, chunkSize);
  const out: T[] = [];
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const rows = await fetchChunk(chunk);
    out.push(...rows);
  }
  return out;
}
