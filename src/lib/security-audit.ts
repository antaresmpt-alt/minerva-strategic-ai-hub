import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TABLE = "prod_logs_auditoria";

export async function recordSecurityAudit(payload: {
  accion: string;
  tabla_afectada: string;
  registro_id?: string | null;
  detalle: string;
  actor_id: string | null;
  actor_email: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from(TABLE).insert({
      tabla_afectada: payload.tabla_afectada,
      accion: payload.accion,
      registro_id: payload.registro_id ?? null,
      detalle: payload.detalle.slice(0, 8000),
      actor_id: payload.actor_id,
      actor_email: payload.actor_email,
    });
    if (error) {
      console.error("[security-audit]", error.message);
    }
  } catch (e) {
    console.error("[security-audit]", e);
  }
}
