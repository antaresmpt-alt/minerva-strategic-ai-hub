/**
 * Bloque 6 — Helpers de permisos para cierre/reapertura de OTs.
 *
 * Patrón puente hasta el rediseño de roles/permisos (Eje 2 de
 * MINERVA_ROLES_Y_NAVEGACION.md).
 *
 * Roles admin/gerencia siempre pueden; otros usuarios necesitan flag explícito.
 */

/**
 * Tipo de la fila de `profiles` con los campos de permisos OT.
 * Si usas otro tipo más completo en el proyecto, extiéndelo en lugar de duplicar.
 */
export type ProfileConPermisos = {
  id: string;
  role: string | null;
  puede_cerrar_ot?: boolean;
  puede_reabrir_ot?: boolean;
};

/** Roles que siempre pueden cerrar/reabrir OTs sin mirar flags. */
const ROLES_SIEMPRE_PUEDEN = new Set(["admin", "gerencia"]);

/**
 * ¿Puede este usuario cerrar una OT (enviarla a prod_ot_producidas)?
 */
export function puedeCerrarOt(profile: ProfileConPermisos | null): boolean {
  if (!profile) return false;
  if (profile.role && ROLES_SIEMPRE_PUEDEN.has(profile.role)) return true;
  return profile.puede_cerrar_ot === true;
}

/**
 * ¿Puede este usuario reabrir una OT ya cerrada (generar version + 1)?
 */
export function puedeReabrirOt(profile: ProfileConPermisos | null): boolean {
  if (!profile) return false;
  if (profile.role && ROLES_SIEMPRE_PUEDEN.has(profile.role)) return true;
  return profile.puede_reabrir_ot === true;
}
