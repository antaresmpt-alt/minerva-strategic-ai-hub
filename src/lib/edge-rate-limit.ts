/**
 * Rate limiting best-effort en Edge/isolados (Vercel). No es global entre instancias;
 * mitiga abuso razonable. Para límites duros usar Upstash/KV.
 */
type Bucket = number[];

function getStore(): Map<string, Bucket> {
  const g = globalThis as unknown as { __hubRateLimit?: Map<string, Bucket> };
  if (!g.__hubRateLimit) {
    g.__hubRateLimit = new Map();
  }
  return g.__hubRateLimit;
}

export function rateLimitAllow(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const store = getStore();
  const now = Date.now();
  let arr = store.get(key) ?? [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    store.set(key, arr);
    return false;
  }
  arr.push(now);
  store.set(key, arr);
  return true;
}

export function clientIpFromRequest(request: Request): string {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
}
