import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditLogRow = {
  id: string;
  tabla_afectada: string;
  accion: string;
  registro_id: string | null;
  detalle: string | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
};

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return i > 0 ? i : fallback;
}

export async function GET(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const accion = (searchParams.get("accion") ?? "").trim();
    const tabla = (searchParams.get("tabla") ?? "").trim();
    const from = (searchParams.get("from") ?? "").trim();
    const to = (searchParams.get("to") ?? "").trim();
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 50), 200);
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const admin = createSupabaseAdminClient();
    let query = admin
      .from("prod_logs_auditoria")
      .select(
        "id, tabla_afectada, accion, registro_id, detalle, actor_id, actor_email, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(start, end);

    if (accion) query = query.eq("accion", accion);
    if (tabla) query = query.eq("tabla_afectada", tabla);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    if (q) {
      const escaped = q.replace(/[%_]/g, "\\$&");
      query = query.or(
        `actor_email.ilike.%${escaped}%,registro_id.ilike.%${escaped}%,detalle.ilike.%${escaped}%`
      );
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: (data ?? []) as AuditLogRow[],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

