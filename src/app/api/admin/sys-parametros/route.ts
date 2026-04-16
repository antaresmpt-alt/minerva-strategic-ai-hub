import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/api/require-settings-admin";
import {
  SYS_PARAM_OTS_COMPRAS_CLAVES,
  type SysParametroOtsCompraRow,
} from "@/lib/sys-parametros-ots-compras";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("sys_parametros")
      .select("id, seccion, clave, valor_num, descripcion, updated_at")
      .in("clave", [...SYS_PARAM_OTS_COMPRAS_CLAVES])
      .order("clave");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: (data ?? []) as SysParametroOtsCompraRow[],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "Service role no configurada en el servidor." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type PutBody = {
  valores?: Record<string, number>;
};

export async function PUT(request: Request) {
  const gate = await requireSettingsAdmin();
  if (!gate.ok) return gate.response;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const valores = body.valores;
  if (!valores || typeof valores !== "object") {
    return NextResponse.json({ error: "valores requerido" }, { status: 400 });
  }

  const allowed = new Set<string>([...SYS_PARAM_OTS_COMPRAS_CLAVES]);
  try {
    const admin = createSupabaseAdminClient();
    for (const [clave, raw] of Object.entries(valores)) {
      if (!allowed.has(clave)) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: `Valor numérico inválido para ${clave}` },
          { status: 400 }
        );
      }
      const { error } = await admin
        .from("sys_parametros")
        .update({
          valor_num: n,
          updated_at: new Date().toISOString(),
        })
        .eq("clave", clave);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
