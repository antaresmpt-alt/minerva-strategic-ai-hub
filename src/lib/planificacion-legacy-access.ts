import { hasFullAccess, normalizeDbRole } from "@/lib/permissions";

/** Mesa diaria / semanal LEGACY: solo admin y gerencia (Bloque 11 §10). */
export function canAccessPlanificacionLegacyMesa(role: string | null): boolean {
  return hasFullAccess(normalizeDbRole(role));
}
