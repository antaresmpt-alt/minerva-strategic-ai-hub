import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { assertPasswordOrMessage } from "@/lib/password-policy";
import { PROFILE_ROLES } from "@/lib/permissions";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { recordSecurityAudit } from "@/lib/security-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 1000,
      page: 1,
    });
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, role, created_at");

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const users = (list?.users ?? []).map((u) => {
      const prof = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        email_confirmed_at: u.email_confirmed_at ?? null,
        banned_until: u.banned_until ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at ?? null,
        profile_role: prof?.role ?? null,
        profile_created_at: prof?.created_at ?? null,
      };
    });

    return NextResponse.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  let body: {
    email?: string;
    password?: string;
    role?: string;
    mode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim();
  const role = body.role?.trim();
  const mode =
    body.mode === "invite" || body.mode === "password"
      ? body.mode
      : "password";

  if (!email || !role) {
    return NextResponse.json(
      { error: "email y role son obligatorios" },
      { status: 400 }
    );
  }

  if (!PROFILE_ROLES.has(role)) {
    return NextResponse.json({ error: "Rol no permitido" }, { status: 400 });
  }

  if (mode === "password") {
    const pwdErr = assertPasswordOrMessage(body.password);
    if (pwdErr) {
      return NextResponse.json({ error: pwdErr }, { status: 400 });
    }
  }

  const site = getPublicSiteUrl();
  const redirectTo = `${site}/auth/continue`;

  try {
    const admin = createSupabaseAdminClient();

    if (mode === "invite") {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });

      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message ?? "No se pudo enviar la invitación" },
          { status: 400 }
        );
      }

      const { error: upErr } = await admin
        .from("profiles")
        .upsert({ id: data.user.id, role }, { onConflict: "id" });

      if (upErr) {
        await admin.auth.admin.deleteUser(data.user.id);
        return NextResponse.json(
          { error: upErr.message ?? "Error al crear perfil" },
          { status: 500 }
        );
      }

      await recordSecurityAudit({
        accion: "INVITE_USER",
        tabla_afectada: "auth.users",
        registro_id: data.user.id,
        detalle: `Invitación por email (${role}). redirectTo=${redirectTo}`,
        actor_id: gate.ctx.userId,
        actor_email: gate.ctx.actorEmail,
      });

      return NextResponse.json({
        ok: true,
        mode: "invite" as const,
        user: { id: data.user.id, email: data.user.email },
      });
    }

    const password = body.password!;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo crear el usuario" },
        { status: 400 }
      );
    }

    const { error: upErr } = await admin
      .from("profiles")
      .upsert({ id: data.user.id, role }, { onConflict: "id" });

    if (upErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { error: upErr.message ?? "Error al crear perfil" },
        { status: 500 }
      );
    }

    await recordSecurityAudit({
      accion: "CREATE_USER_PASSWORD",
      tabla_afectada: "auth.users",
      registro_id: data.user.id,
      detalle: `Alta con contraseña definida por admin (${role}).`,
      actor_id: gate.ctx.userId,
      actor_email: gate.ctx.actorEmail,
    });

    return NextResponse.json({
      ok: true,
      mode: "password" as const,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
