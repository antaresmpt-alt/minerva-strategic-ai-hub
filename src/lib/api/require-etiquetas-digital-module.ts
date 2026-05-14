import { NextResponse } from "next/server";

import { canAccessHubModule, normalizeDbRole } from "@/lib/permissions";
import {
  createServerSupabaseClient,
  getModuleAccessForCurrentUser,
} from "@/lib/supabase/server";

export type EtiquetasDigitalGateResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireEtiquetasDigitalModule(): Promise<EtiquetasDigitalGateResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = normalizeDbRole(profile?.role);
  const accessRecord = await getModuleAccessForCurrentUser();
  const dynamic =
    accessRecord != null && Object.keys(accessRecord).length > 0
      ? new Map<string, boolean>(
          Object.entries(accessRecord).map(([k, v]) => [k, Boolean(v)])
        )
      : null;

  if (!canAccessHubModule(role, "etiquetas_digital", dynamic)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
