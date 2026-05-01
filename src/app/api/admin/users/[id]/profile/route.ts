import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { PROFILE_ROLES } from "@/lib/permissions";
import { recordSecurityAudit } from "@/lib/security-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let body: { role?: string };
  try {
    body = (await request.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const role = body.role?.trim();
  if (!role) {
    return NextResponse.json({ error: "role requerido" }, { status: 400 });
  }

  if (!PROFILE_ROLES.has(role)) {
    return NextResponse.json({ error: "Rol no permitido" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: prev } = await admin
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();

    const { data: authU } = await admin.auth.admin.getUserById(id);

    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recordSecurityAudit({
      accion: "PROFILE_ROLE_CHANGE",
      tabla_afectada: "profiles",
      registro_id: id,
      detalle: `Rol: ${prev?.role ?? "—"} → ${role}. user=${authU.user?.email ?? id}`,
      actor_id: gate.ctx.userId,
      actor_email: gate.ctx.actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
