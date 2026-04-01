/**
 * Matriz de permisos Minerva Hub / APIs.
 * Si `dynamicAccess` tiene entradas (desde `role_permissions`), tiene prioridad sobre la matriz por defecto.
 */

export type HubModuleId =
  | "sales"
  | "sem"
  | "seo"
  | "produccion"
  | "chat"
  | "settings";

export const HUB_MODULE_IDS: HubModuleId[] = [
  "sales",
  "sem",
  "seo",
  "produccion",
  "chat",
  "settings",
];

const FULL_ACCESS_ROLES = new Set(["admin", "gerencia"]);

/**
 * Alias históricos → valores del enum en Supabase (español).
 * Mantener hasta migrar filas antiguas en `profiles` / `role_permissions`.
 */
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  commercial: "comercial",
  production: "produccion",
};

/** Normaliza el rol leído de la BD para la lógica de permisos. */
export function normalizeDbRole(role: string | null | undefined): string | null {
  if (role == null || role === "") return null;
  return LEGACY_ROLE_ALIASES[role] ?? role;
}

export function hasFullAccess(role: string | null): boolean {
  const r = normalizeDbRole(role);
  return r != null && FULL_ACCESS_ROLES.has(r);
}

function useDynamic(
  dynamic: Map<string, boolean> | null | undefined
): dynamic is Map<string, boolean> {
  return dynamic != null && dynamic.size > 0;
}

export function canAccessSettings(
  role: string | null,
  dynamic?: Map<string, boolean> | null
): boolean {
  const r = normalizeDbRole(role);
  if (!r) return false;
  if (useDynamic(dynamic)) {
    return dynamic.get("settings") === true;
  }
  return hasFullAccess(r);
}

export function canAccessHubModule(
  role: string | null,
  module: HubModuleId,
  dynamic?: Map<string, boolean> | null
): boolean {
  const r = normalizeDbRole(role);
  if (!r) return false;
  if (useDynamic(dynamic)) {
    return dynamic.get(module) === true;
  }
  if (hasFullAccess(r)) return true;

  if (r === "produccion" || r === "logistica") {
    return module === "chat" || module === "produccion";
  }

  if (r === "comercial") {
    return (
      module === "chat" ||
      module === "sales" ||
      module === "sem" ||
      module === "seo"
    );
  }

  if (r === "ctp" || r === "administracion") {
    return module === "chat";
  }

  return false;
}

/** Prefijos de ruta de página (sin API). */
export function canAccessPagePath(
  role: string | null,
  pathname: string,
  dynamic?: Map<string, boolean> | null
): boolean {
  if (!normalizeDbRole(role)) return false;
  if (useDynamic(dynamic)) {
    const p = pathname.split("?")[0] ?? pathname;
    if (p === "/" || p === "") return true;
    if (p.startsWith("/settings"))
      return canAccessSettings(role, dynamic);
    if (p.startsWith("/chat")) return canAccessHubModule(role, "chat", dynamic);
    if (p.startsWith("/analytics/sales"))
      return canAccessHubModule(role, "sales", dynamic);
    if (p.startsWith("/sem")) return canAccessHubModule(role, "sem", dynamic);
    if (p.startsWith("/seo")) return canAccessHubModule(role, "seo", dynamic);
    if (p.startsWith("/produccion"))
      return canAccessHubModule(role, "produccion", dynamic);
    return false;
  }

  if (hasFullAccess(role)) return true;

  const p = pathname.split("?")[0] ?? pathname;

  if (p === "/" || p === "") return true;

  if (p.startsWith("/settings")) return canAccessSettings(role);

  if (p.startsWith("/chat")) return canAccessHubModule(role, "chat");
  if (p.startsWith("/analytics/sales"))
    return canAccessHubModule(role, "sales");
  if (p.startsWith("/sem")) return canAccessHubModule(role, "sem");
  if (p.startsWith("/seo")) return canAccessHubModule(role, "seo");
  if (p.startsWith("/produccion"))
    return canAccessHubModule(role, "produccion");

  return false;
}

/** Rutas /api/* según módulo (tras sesión válida). */
export function canAccessApiRoute(
  role: string | null,
  pathname: string,
  dynamic?: Map<string, boolean> | null
): boolean {
  if (!normalizeDbRole(role)) return false;
  if (useDynamic(dynamic)) {
    if (pathname.startsWith("/api/admin")) {
      return canAccessSettings(role, dynamic);
    }
    if (pathname.startsWith("/api/ingest")) {
      return canAccessSettings(role, dynamic);
    }
    if (pathname.startsWith("/api/chat")) {
      return canAccessHubModule(role, "chat", dynamic);
    }
    if (
      pathname.startsWith("/api/sales") ||
      pathname.startsWith("/api/lead-scoring")
    ) {
      return canAccessHubModule(role, "sales", dynamic);
    }
    if (
      pathname.startsWith("/api/seo") ||
      pathname.startsWith("/api/pagespeed")
    ) {
      return canAccessHubModule(role, "seo", dynamic);
    }
    if (pathname.startsWith("/api/gemini")) {
      return canAccessHubModule(role, "sem", dynamic);
    }
    return false;
  }

  if (hasFullAccess(role)) return true;

  if (pathname.startsWith("/api/admin")) {
    return canAccessSettings(role);
  }

  if (pathname.startsWith("/api/ingest")) return false;

  if (pathname.startsWith("/api/chat")) return canAccessHubModule(role, "chat");

  if (
    pathname.startsWith("/api/sales") ||
    pathname.startsWith("/api/lead-scoring")
  ) {
    return canAccessHubModule(role, "sales");
  }

  if (
    pathname.startsWith("/api/seo") ||
    pathname.startsWith("/api/pagespeed")
  ) {
    return canAccessHubModule(role, "seo");
  }

  if (pathname.startsWith("/api/gemini")) {
    return canAccessHubModule(role, "sem");
  }

  return false;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gerencia: "Gerencia",
  comercial: "Comercial",
  produccion: "Producción",
  logistica: "Logística",
  oficina_tecnica: "Oficina técnica",
  administracion: "Administración",
  ctp: "CTP",
};

export const ASSIGNABLE_ROLES = [
  "admin",
  "gerencia",
  "comercial",
  "produccion",
  "logistica",
  "ctp",
  "administracion",
  "oficina_tecnica",
] as const;

export function formatRoleLabel(role: string | null): string {
  if (!role) return "Sin rol asignado";
  const key = normalizeDbRole(role) ?? role;
  return ROLE_LABELS[key] ?? role.replace(/_/g, " ");
}

export function accessDeniedMessage(role: string | null): string {
  const label = formatRoleLabel(role);
  return `Tu perfil (${label}) no tiene acceso a este módulo. Contacta con Gerencia.`;
}

export const MODULE_LABELS: Record<HubModuleId, string> = {
  sales: "Ventas",
  sem: "SEM",
  seo: "SEO",
  produccion: "Producción",
  chat: "Chat",
  settings: "Configuración",
};
