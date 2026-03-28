/**
 * Lee la respuesta de una Route Handler esperando JSON.
 * Si el servidor devuelve texto/HTML (p. ej. 413 "Request Entity Too Large"), muestra un mensaje claro.
 */
export async function readApiJson<T extends Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const t = text.trim();
    const lower = t.toLowerCase();
    if (
      res.status === 413 ||
      lower.includes("entity too large") ||
      lower.includes("request entity too large") ||
      lower.includes("payload too large")
    ) {
      throw new Error(
        "La petición supera el límite de tamaño del servidor. Prueba con una imagen más pequeña o reduce la resolución de la foto."
      );
    }
    throw new Error(
      t.length > 0
        ? t.slice(0, 240)
        : `Respuesta no válida del servidor (HTTP ${res.status}).`
    );
  }

  const obj = parsed as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof obj.error === "string" && obj.error.length > 0
        ? obj.error
        : `Error HTTP ${res.status}`
    );
  }
  return parsed as T;
}
