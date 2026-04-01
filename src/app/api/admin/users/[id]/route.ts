import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (id === gate.ctx.userId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error: delAuth } = await admin.auth.admin.deleteUser(id);
    if (delAuth) {
      return NextResponse.json(
        { error: delAuth.message },
        { status: 400 }
      );
    }

    await admin.from("profiles").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
