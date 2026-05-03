import { createServerClient } from "@supabase/ssr";
import {
  clientIpFromRequest,
  rateLimitAllow,
} from "@/lib/edge-rate-limit";
import { getAalFromAccessToken } from "@/lib/jwt-aal";
import {
  isHubMfaEnforcementDisabled,
  isMfaSetupExemptPath,
  roleRequiresMfa,
} from "@/lib/hub-mfa";
import {
  canAccessApiRoute,
  canAccessPagePath,
  normalizeDbRole,
} from "@/lib/permissions";
import { fetchRolePermissionMap } from "@/lib/role-permissions-fetch";
import { NextResponse, type NextRequest } from "next/server";

function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isMfaSetupPath(pathname: string) {
  return (
    pathname === "/login/mfa-setup" ||
    pathname.startsWith("/login/mfa-setup/")
  );
}

/** Evita redirecciones abiertas: solo rutas relativas internas. */
function safeNextPathnameFromSearch(next: string | null): string {
  if (!next || next === "") return "/";
  const path = next.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path.includes("://")) return "/";
  return path || "/";
}

async function auditAccessDenied(
  request: NextRequest,
  payload: {
    reason: string;
    path: string;
    role?: string | null;
    userId?: string | null;
  }
) {
  try {
    await fetch(new URL("/api/security/access-denied", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    // Best-effort de auditoría en Edge.
  }
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const ip = clientIpFromRequest(request);

  /** Chrome/DevTools u otros clientes; no son rutas de la app ni deben auditar PAGE_FORBIDDEN. */
  if (pathname.startsWith("/.well-known/")) {
    return response;
  }

  if (isMfaSetupPath(pathname)) {
    if (userError || !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.delete("next");
      url.searchParams.set("reason", "auth");
      url.searchParams.set(
        "next",
        `/login/mfa-setup${request.nextUrl.search ?? ""}`
      );
      const redirect = NextResponse.redirect(url);
      copyAuthCookies(response, redirect);
      return redirect;
    }
    return response;
  }

  if (isLoginPath(pathname)) {
    if (!rateLimitAllow(`login:page:ip:${ip}`, 120, 60_000)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
    if (!userError && user) {
      const nextPath = safeNextPathnameFromSearch(
        request.nextUrl.searchParams.get("next")
      );
      const url = request.nextUrl.clone();
      url.pathname = "/auth/continue";
      url.searchParams.set("next", nextPath);
      const redirect = NextResponse.redirect(url);
      copyAuthCookies(response, redirect);
      return redirect;
    }
    return response;
  }

  /** CSV/xlsx de ejemplo en `public/data/*`. Deben servirse sin `canAccessPagePath` (no son rutas de módulo). */
  if (pathname.startsWith("/data/")) {
    return response;
  }

  if (pathname.startsWith("/api")) {
    if (pathname.startsWith("/api/security/")) {
      return response;
    }
    const isAdminApi = pathname.startsWith("/api/admin/");
    const isGeminiApi = pathname.startsWith("/api/gemini/");
    const isAiCostlyApi =
      isGeminiApi ||
      pathname === "/api/chat" ||
      pathname === "/api/sales-chat" ||
      pathname === "/api/sales-email";
    const ipLimit = isAdminApi ? 40 : isAiCostlyApi ? 25 : 120;
    const userLimit = isAdminApi ? 80 : isAiCostlyApi ? 35 : 400;
    const bucket = isAdminApi ? "admin" : isAiCostlyApi ? "ai" : "default";

    if (!rateLimitAllow(`api:ip:${ip}:${bucket}`, ipLimit, 60_000)) {
      const tooMany = NextResponse.json(
        { error: "Too Many Requests", message: "Demasiadas peticiones. Espera un momento." },
        { status: 429 }
      );
      copyAuthCookies(response, tooMany);
      return tooMany;
    }

    if (userError || !user) {
      const unauthorized = NextResponse.json(
        {
          error: "Unauthorized",
          message: "Sesión requerida. Inicia sesión en el Hub.",
        },
        { status: 401 }
      );
      copyAuthCookies(response, unauthorized);
      return unauthorized;
    }

    if (!rateLimitAllow(`api:user:${user.id}:${bucket}`, userLimit, 60_000)) {
      const tooMany = NextResponse.json(
        { error: "Too Many Requests", message: "Demasiadas peticiones desde esta cuenta." },
        { status: 429 }
      );
      copyAuthCookies(response, tooMany);
      return tooMany;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role ?? null;

    if (
      !isHubMfaEnforcementDisabled() &&
      roleRequiresMfa(role) &&
      !isMfaSetupExemptPath(pathname)
    ) {
      const { data: sess } = await supabase.auth.getSession();
      const aal = getAalFromAccessToken(sess.session?.access_token);
      if (aal !== "aal2") {
        await auditAccessDenied(request, {
          reason: "MFA_REQUIRED",
          path: pathname,
          role,
          userId: user.id,
        });
        const mfaRequired = NextResponse.json(
          {
            error: "MFA_REQUIRED",
            message:
              "Debes completar el segundo factor (MFA) con tu cuenta de administración.",
          },
          { status: 403 }
        );
        copyAuthCookies(response, mfaRequired);
        return mfaRequired;
      }
    }

    const dynamic = role ? await fetchRolePermissionMap(role) : null;

    if (!canAccessApiRoute(role, pathname, dynamic)) {
      await auditAccessDenied(request, {
        reason: "API_FORBIDDEN",
        path: pathname,
        role,
        userId: user.id,
      });
      const forbidden = NextResponse.json(
        {
          error: "Forbidden",
          message:
            "Tu perfil no tiene permiso para esta operación. Contacta con Gerencia.",
        },
        { status: 403 }
      );
      copyAuthCookies(response, forbidden);
      return forbidden;
    }

    return response;
  }

  if (userError || !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "auth");
    url.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search ?? ""}`
    );
    const redirect = NextResponse.redirect(url);
    copyAuthCookies(response, redirect);
    return redirect;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? null;

  const dynamic = role ? await fetchRolePermissionMap(role) : null;

  if (
    !isHubMfaEnforcementDisabled() &&
    roleRequiresMfa(role) &&
    !isMfaSetupExemptPath(pathname)
  ) {
    const { data: sess } = await supabase.auth.getSession();
    const aal = getAalFromAccessToken(sess.session?.access_token);
    if (aal !== "aal2") {
      await auditAccessDenied(request, {
        reason: "PAGE_MFA_REQUIRED",
        path: pathname,
        role,
        userId: user.id,
      });
      const url = request.nextUrl.clone();
      url.pathname = "/login/mfa-setup";
      url.searchParams.set(
        "next",
        `${pathname}${request.nextUrl.search ?? ""}`
      );
      const redirect = NextResponse.redirect(url);
      copyAuthCookies(response, redirect);
      return redirect;
    }
  }

  if (
    (pathname === "/" || pathname === "") &&
    normalizeDbRole(role) === "almacen"
  ) {
    const url = new URL("/produccion/muelle", request.url);
    const redirect = NextResponse.redirect(url);
    copyAuthCookies(response, redirect);
    return redirect;
  }

  if (pathname.startsWith("/admin")) {
    const url = new URL("/settings", request.url);
    url.searchParams.set("tab", "ingest");
    const redirect = NextResponse.redirect(url);
    copyAuthCookies(response, redirect);
    return redirect;
  }

  if (!canAccessPagePath(role, pathname, dynamic)) {
    await auditAccessDenied(request, {
      reason: "PAGE_FORBIDDEN",
      path: pathname,
      role,
      userId: user.id,
    });
    const url = new URL("/", request.url);
    url.searchParams.set("permiso", "denegado");
    const redirect = NextResponse.redirect(url);
    copyAuthCookies(response, redirect);
    return redirect;
  }

  return response;
}
