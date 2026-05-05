import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PutBody = {
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

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const plantillaId = String(id ?? "").trim();
  if (!plantillaId) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: plantilla, error: pErr } = await admin
      .from("prod_rutas_plantilla")
      .select("id, nombre, descripcion, activo, creado_at")
      .eq("id", plantillaId)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
    if (!plantilla) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    }

    const { data: pasosRows, error: pasosErr } = await admin
      .from("prod_rutas_plantilla_pasos")
      .select("id, proceso_id, orden")
      .eq("plantilla_id", plantillaId)
      .order("orden", { ascending: true });

    if (pasosErr) {
      return NextResponse.json({ error: pasosErr.message }, { status: 500 });
    }

    const procesoIds = [...new Set((pasosRows ?? []).map((r) => r.proceso_id as number))];
    const nombreById = new Map<number, string>();
    if (procesoIds.length > 0) {
      const { data: cats, error: cErr } = await admin
        .from("prod_procesos_cat")
        .select("id, nombre")
        .in("id", procesoIds);
      if (cErr) {
        return NextResponse.json({ error: cErr.message }, { status: 500 });
      }
      for (const c of cats ?? []) {
        nombreById.set(c.id as number, String(c.nombre ?? ""));
      }
    }

    const pasos = (pasosRows ?? []).map((r) => ({
      id: r.id as string,
      proceso_id: r.proceso_id as number,
      orden: r.orden as number,
      nombre: nombreById.get(r.proceso_id as number) ?? `Proceso #${r.proceso_id}`,
    }));

    return NextResponse.json({ plantilla, pasos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const plantillaId = String(id ?? "").trim();
  if (!plantillaId) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
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

    const { data: exists, error: exErr } = await admin
      .from("prod_rutas_plantilla")
      .select("id")
      .eq("id", plantillaId)
      .maybeSingle();
    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    if (!exists) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    }

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

    const { error: upErr } = await admin
      .from("prod_rutas_plantilla")
      .update({ nombre, descripcion, activo })
      .eq("id", plantillaId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    const { error: delErr } = await admin
      .from("prod_rutas_plantilla_pasos")
      .delete()
      .eq("plantilla_id", plantillaId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    const pasoRows = pasos.map((proceso_id, i) => ({
      plantilla_id: plantillaId,
      proceso_id,
      orden: i + 1,
    }));

    const { error: insErr } = await admin.from("prod_rutas_plantilla_pasos").insert(pasoRows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const plantillaId = String(id ?? "").trim();
  if (!plantillaId) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_rutas_plantilla").delete().eq("id", plantillaId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
