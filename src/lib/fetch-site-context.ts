export async function fetchSiteContext(
  url: string,
  maxChars = 14000
): Promise<string> {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return "";

    const res = await fetch(url, {
      headers: {
        "User-Agent": "MinervaStrategicAIHub/1.0 (+consulting)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(18000),
      redirect: "follow",
    });

    if (!res.ok) return "";
    const html = await res.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}
