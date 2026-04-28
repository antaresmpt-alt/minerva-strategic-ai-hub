/**
 * Matriz de permisos Minerva Hub / APIs.
 * Si `dynamicAccess` tiene entradas (desde `role_permissions`), tiene prioridad sobre la matriz por defecto.
 */

export type HubModuleId =
  | "sales"
  | "sem"
  | "seo"
  | "muelle"
  | "produccion"
  | "produccion_ejecucion"
  | "chat"
  | "settings";

export const HUB_MODULE_IDS: HubModuleId[] = [
  "sales",
  "sem",
  "seo",
  "muelle",
  "produccion",
  "produccion_ejecucion",
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

function hasDynamicAccess(
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
  if (hasDynamicAccess(dynamic)) {
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
  if (hasDynamicAccess(dynamic)) {
    return dynamic.get(module) === true;
  }
  if (hasFullAccess(r)) return true;

  if (r === "produccion" || r === "logistica") {
    return module === "chat" || module === "produccion";
  }

  if (r === "impresion") {
    return module === "produccion_ejecucion";
  }

  if (r === "almacen") {
    return module === "chat" || module === "muelle";
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
  if (hasDynamicAccess(dynamic)) {
    const p = pathname.split("?")[0] ?? pathname;
    if (p === "/" || p === "") return true;
    if (p.startsWith("/settings"))
      return canAccessSettings(role, dynamic);
    if (p.startsWith("/chat")) return canAccessHubModule(role, "chat", dynamic);
    if (p.startsWith("/analytics/sales"))
      return canAccessHubModule(role, "sales", dynamic);
    if (p.startsWith("/sem")) return canAccessHubModule(role, "sem", dynamic);
    if (p.startsWith("/seo")) return canAccessHubModule(role, "seo", dynamic);
    if (p.startsWith("/produccion/muelle"))
      return canAccessHubModule(role, "muelle", dynamic);
    if (p.startsWith("/produccion/ejecucion"))
      return canAccessHubModule(role, "produccion_ejecucion", dynamic);
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
  if (p.startsWith("/produccion/muelle"))
    return canAccessHubModule(role, "muelle");
  if (p.startsWith("/produccion/ejecucion"))
    return canAccessHubModule(role, "produccion_ejecucion");
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
  if (hasDynamicAccess(dynamic)) {
    if (pathname.startsWith("/api/admin")) {
      return canAccessSettings(role, dynamic);
    }
    if (
      pathname.startsWith("/api/ingest") ||
      pathname.startsWith("/api/rag-documents")
    ) {
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
    if (pathname.startsWith("/api/gemini/produccion-externos-analyze")) {
      return canAccessHubModule(role, "produccion", dynamic);
    }
    if (
      pathname.startsWith("/api/gemini/fichas-tecnicas-analyze") ||
      pathname.startsWith("/api/gemini/troqueles-analyze")
    ) {
      return canAccessHubModule(role, "produccion", dynamic);
    }
    if (pathname.startsWith("/api/produccion")) {
      return canAccessHubModule(role, "produccion", dynamic);
    }
    /** Reservado para APIs del módulo Muelle (misma convención que páginas). */
    if (pathname.startsWith("/api/muelle")) {
      return canAccessHubModule(role, "muelle", dynamic);
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

  if (
    pathname.startsWith("/api/ingest") ||
    pathname.startsWith("/api/rag-documents")
  ) {
    return false;
  }

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

  if (pathname.startsWith("/api/gemini/produccion-externos-analyze")) {
    return canAccessHubModule(role, "produccion");
  }

  if (
    pathname.startsWith("/api/gemini/fichas-tecnicas-analyze") ||
    pathname.startsWith("/api/gemini/troqueles-analyze")
  ) {
    return canAccessHubModule(role, "produccion");
  }

  if (pathname.startsWith("/api/produccion")) {
    return canAccessHubModule(role, "produccion");
  }

  if (pathname.startsWith("/api/muelle")) {
    return canAccessHubModule(role, "muelle");
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
  impresion: "Impresión",
  logistica: "Logística",
  almacen: "Almacén",
  oficina_tecnica: "Oficina técnica",
  administracion: "Administración",
  ctp: "CTP",
};

export const ASSIGNABLE_ROLES = [
  "admin",
  "gerencia",
  "comercial",
  "produccion",
  "impresion",
  "logistica",
  "almacen",
  "ctp",
  "administracion",
  "oficina_tecnica",
] as const;

/** Roles válidos en `profiles.role` (creación / actualización desde API admin). */
export const PROFILE_ROLES = new Set<string>([
  "admin",
  "gerencia",
  ...ASSIGNABLE_ROLES.filter((r) => r !== "admin" && r !== "gerencia"),
]);

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
  muelle: "Muelle",
  produccion: "Producción",
  produccion_ejecucion: "OTs en ejecución",
  chat: "Chat",
  settings: "Configuración",
};
