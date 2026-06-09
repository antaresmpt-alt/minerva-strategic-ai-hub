import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function parseIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  return Boolean(v);
}

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_cajas_embalaje")
      .select(
        "id, codigo, descripcion, bultos_por_palet_default, con_logo, activo, orden, notas, updated_at",
      )
      .order("orden", { ascending: true })
      .order("codigo", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: {
    codigo?: unknown;
    descripcion?: unknown;
    bultos_por_palet_default?: unknown;
    con_logo?: unknown;
    activo?: unknown;
    orden?: unknown;
    notas?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const codigo = String(body.codigo ?? "").trim();
  if (!codigo) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_cajas_embalaje").insert({
      codigo,
      descripcion: String(body.descripcion ?? "").trim() || null,
      bultos_por_palet_default: parseIntOrNull(body.bultos_por_palet_default),
      con_logo: parseBoolOrNull(body.con_logo),
      activo: Boolean(body.activo ?? true),
      orden: parseIntOrNull(body.orden) ?? 0,
      notas: String(body.notas ?? "").trim() || null,
      created_by: gate.ctx.userId,
      created_by_email: gate.ctx.actorEmail,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: {
    id?: unknown;
    codigo?: unknown;
    descripcion?: unknown;
    bultos_por_palet_default?: unknown;
    con_logo?: unknown;
    activo?: unknown;
    orden?: unknown;
    notas?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const codigo = String(body.codigo ?? "").trim();
  if (!codigo) return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("prod_cajas_embalaje")
      .update({
        codigo,
        descripcion: String(body.descripcion ?? "").trim() || null,
        bultos_por_palet_default: parseIntOrNull(body.bultos_por_palet_default),
        con_logo: parseBoolOrNull(body.con_logo),
        activo: Boolean(body.activo ?? true),
        orden: parseIntOrNull(body.orden) ?? 0,
        notas: String(body.notas ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: { id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_cajas_embalaje").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 },
    );
  }
}
