import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
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
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: banned ? "876000h" : "none",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
