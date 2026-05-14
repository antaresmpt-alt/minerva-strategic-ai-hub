import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { SYS_PARAM_ETIQUETAS_COMPRAS_EMAIL_DESTINATARIOS } from "@/lib/sys-parametros-etiquetas-compras";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_LEN = 2000;

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("sys_parametros")
      .select("id, clave, valor_text, descripcion, updated_at")
      .eq("clave", SYS_PARAM_ETIQUETAS_COMPRAS_EMAIL_DESTINATARIOS)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      valor_text: data?.valor_text ?? "",
      updated_at: data?.updated_at ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}

type PutBody = { valor_text?: unknown };

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const valor_text = String(body.valor_text ?? "").trim();
  if (valor_text.length > MAX_LEN) {
    return NextResponse.json({ error: "Texto demasiado largo" }, { status: 400 });
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("sys_parametros")
      .update({
        valor_text,
        updated_at: new Date().toISOString(),
      })
      .eq("clave", SYS_PARAM_ETIQUETAS_COMPRAS_EMAIL_DESTINATARIOS);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
