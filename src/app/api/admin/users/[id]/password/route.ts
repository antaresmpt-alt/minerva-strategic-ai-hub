import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { assertPasswordOrMessage } from "@/lib/password-policy";
import { recordSecurityAudit } from "@/lib/security-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const password = body.password;
  const pwdErr = assertPasswordOrMessage(password);
  if (pwdErr) {
    return NextResponse.json({ error: pwdErr }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: existing, error: getErr } = await admin.auth.admin.getUserById(
      id
    );
    if (getErr || !existing.user) {
      return NextResponse.json(
        { error: getErr?.message ?? "Usuario no encontrado" },
        { status: 400 }
      );
    }

    const { error } = await admin.auth.admin.updateUserById(id, {
      password,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recordSecurityAudit({
      accion: "ADMIN_SET_PASSWORD",
      tabla_afectada: "auth.users",
      registro_id: id,
      detalle: `Contraseña actualizada por admin. target=${existing.user.email ?? id}`,
      actor_id: gate.ctx.userId,
      actor_email: gate.ctx.actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
