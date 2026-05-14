import { NextResponse } from "next/server";

import { requireEtiquetasDigitalModule } from "@/lib/api/require-etiquetas-digital-module";
import { SYS_PARAM_ETIQUETAS_COMPRAS_EMAIL_DESTINATARIOS } from "@/lib/sys-parametros-etiquetas-compras";
import { parseEmailDestinatarios } from "@/lib/etiquetas-compras-mailto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireEtiquetasDigitalModule();
  if (!gate.ok) return gate.response;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("sys_parametros")
      .select("valor_text")
      .eq("clave", SYS_PARAM_ETIQUETAS_COMPRAS_EMAIL_DESTINATARIOS)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const emails = parseEmailDestinatarios(data?.valor_text);
    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
