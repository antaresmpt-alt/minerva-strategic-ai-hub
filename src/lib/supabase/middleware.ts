import { createServerClient } from "@supabase/ssr";
import { canAccessApiRoute, canAccessPagePath } from "@/lib/permissions";
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

/** Evita redirecciones abiertas: solo rutas relativas internas. */
function safeNextPathnameFromSearch(next: string | null): string {
  if (!next || next === "") return "/";
  const path = next.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path.includes("://")) return "/";
  return path || "/";
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

  if (isLoginPath(pathname)) {
    if (!userError && user) {
      const nextPath = safeNextPathnameFromSearch(
        request.nextUrl.searchParams.get("next")
      );
      const url = new URL(nextPath, request.url);
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role ?? null;

    const dynamic = role ? await fetchRolePermissionMap(role) : null;

    if (!canAccessApiRoute(role, pathname, dynamic)) {
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

  if (pathname.startsWith("/admin")) {
    const url = new URL("/settings", request.url);
    url.searchParams.set("tab", "ingest");
    const redirect = NextResponse.redirect(url);
    copyAuthCookies(response, redirect);
    return redirect;
  }

  if (!canAccessPagePath(role, pathname, dynamic)) {
    const url = new URL("/", request.url);
    url.searchParams.set("permiso", "denegado");
    const redirect = NextResponse.redirect(url);
    copyAuthCookies(response, redirect);
    return redirect;
  }

  return response;
}
