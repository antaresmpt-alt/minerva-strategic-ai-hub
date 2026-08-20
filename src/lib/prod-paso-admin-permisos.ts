/**
 * Permisos para acciones administrativas sobre pasos cerrados (A/B + cartela).
 *
 * Patrón puente hasta rediseño de roles (Eje 2).
 */

import type { ProfileConPermisos } from "@/lib/prod-ot-cierre-permisos";

const ROLES_EDITAR_PASO = new Set(["admin", "gerencia", "oficina_tecnica"]);
const ROLES_REABRIR_PASO = new Set(["admin", "gerencia"]);
const ROLES_REVERTIR_CONSUMO = new Set(["admin", "gerencia", "oficina_tecnica"]);

/** Modo A — editar datos_proceso / ejecución sin reabrir el paso. */
export function puedeEditarPasoAdmin(profile: ProfileConPermisos | null): boolean {
  if (!profile?.role) return false;
  return ROLES_EDITAR_PASO.has(profile.role);
}

/** Corregir cartela en paso ya finalizado (descuenta stock si faltaba). */
export function puedeCorregirCartelaPaso(profile: ProfileConPermisos | null): boolean {
  return puedeEditarPasoAdmin(profile);
}

/** Modo B — reabrir paso finalizado para volver a ejecutarlo. */
export function puedeReabrirPasoAdmin(profile: ProfileConPermisos | null): boolean {
  if (!profile?.role) return false;
  return ROLES_REABRIR_PASO.has(profile.role);
}

/** Revertir consumo de cartela en paso finalizado (9.8.5 — Caso B STOP). */
export function puedeRevertirConsumoPasoAdmin(profile: ProfileConPermisos | null): boolean {
  if (!profile?.role) return false;
  return ROLES_REVERTIR_CONSUMO.has(profile.role);
}

/** Reset planificación STOP — anular huecos de mesa posteriores (9.8 §19). */
export function puedeResetPlanificacionStop(profile: ProfileConPermisos | null): boolean {
  if (!profile?.role) return false;
  return ROLES_REABRIR_PASO.has(profile.role);
}
