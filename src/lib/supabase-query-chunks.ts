/** Tamaño seguro para filtros `.in()` en PostgREST (evita 400 por URL demasiado larga). */
export const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

/** Concurrencia por defecto al pedir varios chunks (evita saturar pool PostgREST). */
export const SUPABASE_IN_FILTER_CONCURRENCY = 5;

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

/**
 * Ejecuta promesas en paralelo con un tope de concurrencia (orden de resultados = orden de entrada).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];
  const limit = Math.max(1, Math.min(n, Math.trunc(concurrency) || 1));
  const results: R[] = new Array(n);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= n) return;
      results[i] = await mapper(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

export async function fetchAllInChunks<T, V>(
  values: readonly V[],
  chunkSize: number,
  fetchChunk: (chunk: V[]) => Promise<T[]>,
  concurrency: number = SUPABASE_IN_FILTER_CONCURRENCY,
): Promise<T[]> {
  const chunks = chunkValues(values, chunkSize).filter((c) => c.length > 0);
  if (chunks.length === 0) return [];
  const parts = await mapPool(chunks, concurrency, (chunk) => fetchChunk(chunk));
  return parts.flat();
}
