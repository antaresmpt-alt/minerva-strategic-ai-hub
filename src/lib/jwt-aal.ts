/**
 * Decodifica el payload del JWT (sin verificar firma). Solo para lectura de claims
 * como `aal` en middleware / cliente de confianza; la autorización real sigue en Supabase.
 */
export function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    if (typeof atob !== "function") {
      return null;
    }
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Nivel de autenticación Supabase: típicamente `aal1` (contraseña) o `aal2` (MFA verificado). */
export function getAalFromAccessToken(accessToken: string | undefined | null): string | null {
  if (!accessToken?.trim()) return null;
  const payload = decodeJwtPayload(accessToken);
  const aal = payload?.aal;
  return typeof aal === "string" ? aal : null;
}
