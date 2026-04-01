import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data: list, error: listErr } =
      await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    if (listErr) {
      return NextResponse.json(
        { error: listErr.message },
        { status: 500 }
      );
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, role, created_at");

    const profileById = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

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

  let body: { email?: string; password?: string; role?: string };
  try {
    body = (await request.json()) as {
      email?: string;
      password?: string;
      role?: string;
    };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  const role = body.role?.trim();

  if (!email || !password || !role) {
    return NextResponse.json(
      { error: "email, password y role son obligatorios" },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    // Marca el email como verificado de inmediato (columna Confirmado en el panel).
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
      .upsert(
        { id: data.user.id, role },
        { onConflict: "id" }
      );

    if (upErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { error: upErr.message ?? "Error al crear perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
