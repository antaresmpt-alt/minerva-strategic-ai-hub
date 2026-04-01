import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { HUB_MODULE_IDS } from "@/lib/permissions";
import type { RolePermissionRow } from "@/lib/role-permissions-fetch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("role_permissions")
      .select("role, module_name, is_enabled")
      .order("role")
      .order("module_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: (data ?? []) as RolePermissionRow[],
      modules: HUB_MODULE_IDS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type PutBody = {
  matrix?: Record<string, Record<string, boolean>>;
};

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const matrix = body.matrix;
  if (!matrix || typeof matrix !== "object") {
    return NextResponse.json({ error: "matrix requerida" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const upserts: RolePermissionRow[] = [];

    for (const [role, mods] of Object.entries(matrix)) {
      if (!mods || typeof mods !== "object") continue;
      for (const [moduleName, enabled] of Object.entries(mods)) {
        upserts.push({
          role,
          module_name: moduleName,
          is_enabled: Boolean(enabled),
        });
      }
    }

    if (upserts.length === 0) {
      return NextResponse.json({ error: "Sin filas" }, { status: 400 });
    }

    const { error } = await admin.from("role_permissions").upsert(upserts, {
      onConflict: "role,module_name",
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
