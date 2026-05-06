import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TipoMaquina = "impresion" | "digital" | "troquelado" | "engomado";

type MaquinaPayload = {
  id?: string;
  codigo?: string;
  nombre?: string;
  tipo_maquina?: TipoMaquina;
  activa?: boolean;
  orden_visual?: number;
  capacidad_horas_default_manana?: number;
  capacidad_horas_default_tarde?: number;
  notas?: string | null;
};

function normalizeTipo(raw: unknown): TipoMaquina | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (
    t === "impresion" ||
    t === "digital" ||
    t === "troquelado" ||
    t === "engomado"
  ) {
    return t;
  }
  return null;
}

function parseNonNegative(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_maquinas")
      .select(
        "id, codigo, nombre, tipo_maquina, activa, orden_visual, capacidad_horas_default_manana, capacidad_horas_default_tarde, notas, updated_at",
      )
      .order("tipo_maquina")
      .order("orden_visual")
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

  let body: MaquinaPayload;
  try {
    body = (await request.json()) as MaquinaPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const codigo = String(body.codigo ?? "").trim();
  const nombre = String(body.nombre ?? "").trim();
  const tipo = normalizeTipo(body.tipo_maquina);
  if (!codigo || !nombre || !tipo) {
    return NextResponse.json(
      { error: "codigo, nombre y tipo_maquina son obligatorios." },
      { status: 400 },
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_maquinas").insert({
      codigo,
      nombre,
      tipo_maquina: tipo,
      activa: body.activa ?? true,
      orden_visual: Math.trunc(parseNonNegative(body.orden_visual, 0)),
      capacidad_horas_default_manana: parseNonNegative(
        body.capacidad_horas_default_manana,
        8,
      ),
      capacidad_horas_default_tarde: parseNonNegative(
        body.capacidad_horas_default_tarde,
        8,
      ),
      notas:
        typeof body.notas === "string" && body.notas.trim()
          ? body.notas.trim()
          : null,
      created_by: gate.ctx.userId,
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

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  let body: MaquinaPayload;
  try {
    body = (await request.json()) as MaquinaPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.codigo === "string") patch.codigo = body.codigo.trim();
  if (typeof body.nombre === "string") patch.nombre = body.nombre.trim();
  if (body.tipo_maquina != null) {
    const tipo = normalizeTipo(body.tipo_maquina);
    if (!tipo) {
      return NextResponse.json({ error: "tipo_maquina inválido" }, { status: 400 });
    }
    patch.tipo_maquina = tipo;
  }
  if (typeof body.activa === "boolean") patch.activa = body.activa;
  if (body.orden_visual != null) {
    patch.orden_visual = Math.trunc(parseNonNegative(body.orden_visual, 0));
  }
  if (body.capacidad_horas_default_manana != null) {
    patch.capacidad_horas_default_manana = parseNonNegative(
      body.capacidad_horas_default_manana,
      8,
    );
  }
  if (body.capacidad_horas_default_tarde != null) {
    patch.capacidad_horas_default_tarde = parseNonNegative(
      body.capacidad_horas_default_tarde,
      8,
    );
  }
  if (body.notas != null) {
    patch.notas =
      typeof body.notas === "string" && body.notas.trim()
        ? body.notas.trim()
        : null;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_maquinas").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_maquinas").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
