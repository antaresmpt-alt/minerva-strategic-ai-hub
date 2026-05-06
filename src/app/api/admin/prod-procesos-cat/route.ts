import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TipoPlanificacion = "impresion" | "digital" | "troquelado" | "engomado";
type ProcesoPayload = {
  id?: number;
  nombre?: string;
  seccion_slug?: string;
  tipo_planificacion?: TipoPlanificacion | null;
  es_externo?: boolean;
  orden_sugerido?: number | null;
  activo?: boolean;
};

function normalizeTipoPlanificacion(v: unknown): TipoPlanificacion | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (
    s === "impresion" ||
    s === "digital" ||
    s === "troquelado" ||
    s === "engomado"
  ) {
    return s;
  }
  return null;
}

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_procesos_cat")
      .select(
        "id, nombre, seccion_slug, tipo_planificacion, es_externo, orden_sugerido, activo",
      )
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

export async function POST(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: ProcesoPayload;
  try {
    body = (await request.json()) as ProcesoPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const nombre = String(body.nombre ?? "").trim();
  const seccionSlug = String(body.seccion_slug ?? "").trim();
  const tipo = normalizeTipoPlanificacion(body.tipo_planificacion);
  if (!nombre || !seccionSlug || !tipo) {
    return NextResponse.json(
      {
        error:
          "nombre, seccion_slug y tipo_planificacion son obligatorios.",
      },
      { status: 400 },
    );
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_procesos_cat").insert({
      nombre,
      seccion_slug: seccionSlug,
      tipo_planificacion: tipo,
      es_externo: body.es_externo === true,
      orden_sugerido:
        body.orden_sugerido == null ? null : Math.trunc(Number(body.orden_sugerido)),
      activo: body.activo !== false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: ProcesoPayload;
  try {
    body = (await request.json()) as ProcesoPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.nombre === "string") patch.nombre = body.nombre.trim();
  if (typeof body.seccion_slug === "string") {
    patch.seccion_slug = body.seccion_slug.trim();
  }
  if (body.tipo_planificacion != null) {
    const tipo = normalizeTipoPlanificacion(body.tipo_planificacion);
    if (!tipo) {
      return NextResponse.json(
        { error: "tipo_planificacion inválido" },
        { status: 400 },
      );
    }
    patch.tipo_planificacion = tipo;
  }
  if (typeof body.es_externo === "boolean") patch.es_externo = body.es_externo;
  if (body.orden_sugerido != null) {
    patch.orden_sugerido = Math.trunc(Number(body.orden_sugerido));
  }
  if (typeof body.activo === "boolean") patch.activo = body.activo;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_procesos_cat").update(patch).eq("id", id);
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
  let body: ProcesoPayload;
  try {
    body = (await request.json()) as ProcesoPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  try {
    const admin = createSupabaseAdminClient();
    const [{ count: rutasUso }, { count: pasosUso }] = await Promise.all([
      admin
        .from("prod_rutas_plantilla_pasos")
        .select("*", { head: true, count: "exact" })
        .eq("proceso_id", id),
      admin
        .from("prod_ot_pasos")
        .select("*", { head: true, count: "exact" })
        .eq("proceso_id", id),
    ]);
    if ((rutasUso ?? 0) > 0 || (pasosUso ?? 0) > 0) {
      const { error: disErr } = await admin
        .from("prod_procesos_cat")
        .update({ activo: false })
        .eq("id", id);
      if (disErr) {
        return NextResponse.json({ error: disErr.message }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "Proceso en uso: se desactivó en lugar de eliminar.",
      });
    }
    const { error } = await admin.from("prod_procesos_cat").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
