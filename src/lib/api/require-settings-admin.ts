import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SettingsAdminContext = {
  userId: string;
  role: string;
};

export type RequireSettingsAdminResult =
  | { ok: true; ctx: SettingsAdminContext }
  | { ok: false; response: NextResponse };

export async function requireSettingsAdmin(): Promise<RequireSettingsAdminResult> {
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

  const role = profile?.role;
  if (role !== "admin" && role !== "gerencia") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: { userId: user.id, role },
  };
}
