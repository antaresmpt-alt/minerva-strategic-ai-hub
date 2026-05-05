import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PostBody = {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
  pasos?: unknown;
};

function parsePasos(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out: number[] = [];
  for (const x of raw) {
    const n = Number(x);
    if (!Number.isInteger(n) || n < 1) return null;
    out.push(n);
  }
  return out;
}

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_rutas_plantilla")
      .select("id, nombre, descripcion, activo, creado_at")
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

export async function POST(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "nombre es obligatorio." }, { status: 400 });
  }

  const pasos = parsePasos(body.pasos);
  if (!pasos || pasos.length === 0) {
    return NextResponse.json(
      { error: "pasos debe ser un array no vacío de proceso_id (enteros)." },
      { status: 400 },
    );
  }

  const descripcion =
    typeof body.descripcion === "string" && body.descripcion.trim()
      ? body.descripcion.trim()
      : null;
  const activo = body.activo !== false;

  try {
    const admin = createSupabaseAdminClient();

    const { data: catRows, error: catErr } = await admin
      .from("prod_procesos_cat")
      .select("id")
      .in("id", pasos);
    if (catErr) {
      return NextResponse.json({ error: catErr.message }, { status: 400 });
    }
    const valid = new Set((catRows ?? []).map((r) => r.id as number));
    for (const pid of pasos) {
      if (!valid.has(pid)) {
        return NextResponse.json(
          { error: `proceso_id ${pid} no existe en el catálogo.` },
          { status: 400 },
        );
      }
    }

    const { data: created, error: insErr } = await admin
      .from("prod_rutas_plantilla")
      .insert({
        nombre,
        descripcion,
        activo,
      })
      .select("id")
      .single();

    if (insErr || !created?.id) {
      return NextResponse.json(
        { error: insErr?.message ?? "No se pudo crear la plantilla." },
        { status: 400 },
      );
    }

    const plantillaId = created.id as string;
    const pasoRows = pasos.map((proceso_id, i) => ({
      plantilla_id: plantillaId,
      proceso_id,
      orden: i + 1,
    }));

    const { error: pasosErr } = await admin
      .from("prod_rutas_plantilla_pasos")
      .insert(pasoRows);

    if (pasosErr) {
      await admin.from("prod_rutas_plantilla").delete().eq("id", plantillaId);
      return NextResponse.json({ error: pasosErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: plantillaId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
