"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { getAalFromAccessToken } from "@/lib/jwt-aal";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { normalizeDbRole } from "@/lib/permissions";

function safeNextPath(next: string | null): string {
  if (!next || next === "") return "/";
  const path = next.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path.includes("://")) return "/";
  return path || "/";
}

function ContinueInner() {
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const [msg, setMsg] = useState("Comprobando sesión…");

  useEffect(() => {
    const dest = safeNextPath(nextRaw);
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        window.location.assign(`/login?reason=auth&next=${encodeURIComponent(dest)}`);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      const role = normalizeDbRole(prof?.role ?? null) ?? prof?.role ?? null;
      const needMfa =
        process.env.NEXT_PUBLIC_HUB_MFA_DISABLED !== "true" &&
        (role === "admin" || role === "gerencia");
      const aal = getAalFromAccessToken(session.access_token);

      if (needMfa && aal !== "aal2") {
        window.location.assign(
          `/login/mfa-setup?next=${encodeURIComponent(dest)}`
        );
        return;
      }

      setMsg("Redirigiendo…");
      window.location.assign(dest);
    })();
  }, [nextRaw]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

export default function AuthContinuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      }
    >
      <ContinueInner />
    </Suspense>
  );
}
