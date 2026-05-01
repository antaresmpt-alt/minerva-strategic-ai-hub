import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { recordSecurityAudit } from "@/lib/security-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  if (id === gate.ctx.userId) {
    return NextResponse.json(
      { error: "No puedes suspender tu propia cuenta" },
      { status: 400 }
    );
  }

  let body: { banned?: boolean };
  try {
    body = (await request.json()) as { banned?: boolean };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const banned = body.banned === true;

  try {
    const admin = createSupabaseAdminClient();
    const { data: ures } = await admin.auth.admin.getUserById(id);
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: banned ? "876000h" : "none",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recordSecurityAudit({
      accion: banned ? "USER_BAN" : "USER_UNBAN",
      tabla_afectada: "auth.users",
      registro_id: id,
      detalle: `${banned ? "Suspensión" : "Reactivación"} de cuenta. target=${ures.user?.email ?? id}`,
      actor_id: gate.ctx.userId,
      actor_email: gate.ctx.actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
