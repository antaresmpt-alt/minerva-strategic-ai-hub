import { normalizeDbRole } from "@/lib/permissions";

export const HUB_MFA_REQUIRED_DB_ROLES = new Set(["admin", "gerencia"]);

/** Solo lectura server (middleware, API). En local se puede poner HUB_MFA_DISABLED=true */
export function isHubMfaEnforcementDisabled(): boolean {
  return process.env.HUB_MFA_DISABLED === "true";
}

export function roleRequiresMfa(role: string | null | undefined): boolean {
  if (isHubMfaEnforcementDisabled()) return false;
  const r = normalizeDbRole(role);
  return r != null && HUB_MFA_REQUIRED_DB_ROLES.has(r);
}

/** Rutas accesibles con sesión AAL1 para usuarios que aún deben pasar MFA. */
export function isMfaSetupExemptPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/continue")
  );
}
