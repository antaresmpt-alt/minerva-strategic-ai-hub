import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CatalogTipo = "material" | "acabado_pral";

function isTipo(v: unknown): v is CatalogTipo {
  return v === "material" || v === "acabado_pral";
}

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_despacho_catalogo")
      .select("id, tipo, label, activo, orden, updated_at")
      .order("tipo", { ascending: true })
      .order("orden", { ascending: true })
      .order("label", { ascending: true });
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
  let body: { tipo?: unknown; label?: unknown; orden?: unknown; activo?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const tipo = body.tipo;
  const label = String(body.label ?? "").trim();
  const orden = Number(body.orden ?? 0);
  const activo = Boolean(body.activo ?? true);
  if (!isTipo(tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Label requerido" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_despacho_catalogo").insert({
      tipo,
      label,
      orden: Number.isFinite(orden) ? Math.trunc(orden) : 0,
      activo,
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
  let body: { id?: unknown; label?: unknown; orden?: unknown; activo?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const label = String(body.label ?? "").trim();
  const orden = Number(body.orden ?? 0);
  const activo = Boolean(body.activo ?? true);
  if (!label) return NextResponse.json({ error: "Label requerido" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("prod_despacho_catalogo")
      .update({
        label,
        orden: Number.isFinite(orden) ? Math.trunc(orden) : 0,
        activo,
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
    const { error } = await admin.from("prod_despacho_catalogo").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 },
    );
  }
}
