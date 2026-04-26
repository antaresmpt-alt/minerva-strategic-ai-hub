import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import {
  clampWeight,
  PLANIFICACION_IA_NUMERIC_KEYS,
  PLANIFICACION_IA_PARAM_KEYS,
} from "@/lib/planificacion-ia-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PutBody = {
  valores?: Record<string, number>;
  promptBase?: string;
};

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("sys_parametros")
    .select("id, seccion, clave, valor_num, valor_text, descripcion, updated_at")
    .eq("seccion", "planificacion_ia")
    .order("clave");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const allowed = new Set<string>([...PLANIFICACION_IA_NUMERIC_KEYS]);
  for (const [clave, raw] of Object.entries(body.valores ?? {})) {
    if (!allowed.has(clave)) continue;
    const { error } = await admin
      .from("sys_parametros")
      .update({ valor_num: clampWeight(raw), updated_at: now })
      .eq("clave", clave);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (typeof body.promptBase === "string") {
    const { error } = await admin
      .from("sys_parametros")
      .update({ valor_text: body.promptBase.trim(), updated_at: now })
      .eq("clave", PLANIFICACION_IA_PARAM_KEYS.promptBase);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
