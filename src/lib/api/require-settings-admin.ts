import { NextResponse } from "next/server";

import { recordSecurityAudit } from "@/lib/security-audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SettingsAdminContext = {
  userId: string;
  role: string;
  actorEmail: string | null;
};

export type RequireSettingsAdminResult =
  | { ok: true; ctx: SettingsAdminContext }
  | { ok: false; response: NextResponse };

export async function requireSettingsAdmin(
  request?: Request
): Promise<RequireSettingsAdminResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    await recordSecurityAudit({
      accion: "ADMIN_ACCESS_DENIED_UNAUTHORIZED",
      tabla_afectada: "api.admin",
      detalle: `Intento sin sesión en ${request?.url ?? "unknown"}`,
      actor_id: null,
      actor_email: null,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role !== "admin" && role !== "gerencia") {
    await recordSecurityAudit({
      accion: "ADMIN_ACCESS_DENIED_FORBIDDEN",
      tabla_afectada: "api.admin",
      registro_id: user.id,
      detalle: `Rol sin privilegios (${role ?? "null"}) en ${request?.url ?? "unknown"}`,
      actor_id: user.id,
      actor_email: user.email ?? null,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      role,
      actorEmail: user.email ?? null,
    },
  };
}
