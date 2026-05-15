import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PROD_ETIQUETAS_TIPO_LINEA_VALUES,
  type ProdEtiquetasCatalogCategoria,
} from "@/types/prod-etiquetas-catalogo";

const CATEGORIAS: ProdEtiquetasCatalogCategoria[] = [
  "producto",
  "tintas",
  "equipo",
  "marca",
  "propietario",
  "prioridad",
  "tipo_linea",
];

function isCategoria(v: unknown): v is ProdEtiquetasCatalogCategoria {
  return typeof v === "string" && (CATEGORIAS as string[]).includes(v);
}

function isTipoLineaGrupo(v: string): boolean {
  return (PROD_ETIQUETAS_TIPO_LINEA_VALUES as string[]).includes(v);
}

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("prod_etiquetas_catalogo")
      .select("id, categoria, grupo, label, activo, orden, updated_at")
      .order("categoria", { ascending: true })
      .order("grupo", { ascending: true })
      .order("orden", { ascending: true })
      .order("label", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: {
    categoria?: unknown;
    grupo?: unknown;
    label?: unknown;
    orden?: unknown;
    activo?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const categoria = body.categoria;
  const grupoRaw = body.grupo == null ? null : String(body.grupo).trim();
  const label = String(body.label ?? "").trim();
  const orden = Number(body.orden ?? 0);
  const activo = Boolean(body.activo ?? true);
  if (!isCategoria(categoria)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (!label) return NextResponse.json({ error: "Label requerido" }, { status: 400 });
  if (categoria === "marca") {
    if (!grupoRaw) {
      return NextResponse.json(
        { error: "Las marcas requieren tipo de línea (grupo)." },
        { status: 400 }
      );
    }
    if (!isTipoLineaGrupo(grupoRaw)) {
      return NextResponse.json({ error: "Grupo / tipo de línea inválido" }, { status: 400 });
    }
  } else if (grupoRaw) {
    return NextResponse.json(
      { error: "Solo las marcas llevan grupo (tipo de línea)." },
      { status: 400 }
    );
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("prod_etiquetas_catalogo").insert({
      categoria,
      grupo: categoria === "marca" ? grupoRaw : null,
      label,
      orden: Number.isFinite(orden) ? Math.trunc(orden) : 0,
      activo,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;
  let body: {
    id?: unknown;
    categoria?: unknown;
    label?: unknown;
    grupo?: unknown;
    orden?: unknown;
    activo?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const categoria = body.categoria;
  const label = String(body.label ?? "").trim();
  const orden = Number(body.orden ?? 0);
  const activo = Boolean(body.activo ?? true);
  const grupoRaw = body.grupo == null ? null : String(body.grupo).trim();
  if (!isCategoria(categoria)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (!label) return NextResponse.json({ error: "Label requerido" }, { status: 400 });
  if (categoria === "marca") {
    if (!grupoRaw) {
      return NextResponse.json(
        { error: "Las marcas requieren tipo de línea (grupo)." },
        { status: 400 }
      );
    }
    if (!isTipoLineaGrupo(grupoRaw)) {
      return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
    }
  } else if (grupoRaw) {
    return NextResponse.json(
      { error: "Solo las marcas llevan grupo." },
      { status: 400 }
    );
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("prod_etiquetas_catalogo")
      .update({
        label,
        orden: Number.isFinite(orden) ? Math.trunc(orden) : 0,
        activo,
        grupo: categoria === "marca" ? grupoRaw : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
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
    const { error } = await admin.from("prod_etiquetas_catalogo").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
