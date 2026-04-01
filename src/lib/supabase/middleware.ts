import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
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

  // Siempre permitir la página de login (sin sesión o con sesión caducada).
  if (isLoginPath(pathname)) {
    return response;
  }

  // API: sin sesión válida → 401 JSON (no redirigir HTML; no romper fetch).
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
    return response;
  }

  // Resto del sitio: sesión obligatoria (getUser valida con el servidor Auth).
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

  // /admin: solo rol admin en profiles
  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      const url = new URL("/", request.url);
      url.searchParams.set("acceso", "restringido");
      const redirect = NextResponse.redirect(url);
      copyAuthCookies(response, redirect);
      return redirect;
    }
  }

  return response;
}
