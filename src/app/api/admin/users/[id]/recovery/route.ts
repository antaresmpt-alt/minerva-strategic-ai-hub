import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { recordSecurityAudit } from "@/lib/security-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Dispara el flujo de recuperación de contraseña (email vía plantilla Supabase).
 */
export async function POST(_request: Request, ctx: Ctx) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const admin = createSupabaseAdminClient();
    const { data: ures, error: uerr } = await admin.auth.admin.getUserById(id);
    if (uerr || !ures.user?.email) {
      return NextResponse.json(
        { error: uerr?.message ?? "Usuario no encontrado" },
        { status: 400 }
      );
    }
    const email = ures.user.email;

    const recoverRes = await fetch(`${url}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!recoverRes.ok) {
      const t = await recoverRes.text();
      return NextResponse.json(
        { error: t || "No se pudo enviar el email de recuperación" },
        { status: 400 }
      );
    }

    await recordSecurityAudit({
      accion: "PASSWORD_RECOVERY_EMAIL",
      tabla_afectada: "auth.users",
      registro_id: id,
      detalle: `Email de recuperación disparado por admin. target=${email}`,
      actor_id: gate.ctx.userId,
      actor_email: gate.ctx.actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
