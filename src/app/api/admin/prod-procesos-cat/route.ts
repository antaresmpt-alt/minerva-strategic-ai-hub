import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_procesos_cat")
      .select("id, nombre, seccion_slug, es_externo, orden_sugerido, activo")
      .order("orden_sugerido", { ascending: true, nullsFirst: false })
      .order("nombre");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
