import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 90;

const TARGET_URL = "https://www.minervaglobal.es/";

/**
 * Proxy hacia PageSpeed Insights v5. La clave solo existe en el servidor
 * (habilita PageSpeed Insights API en Google Cloud y crea una API key).
 */
export async function GET(req: NextRequest) {
  const strategy = req.nextUrl.searchParams.get("strategy") ?? "mobile";
  if (strategy !== "mobile" && strategy !== "desktop") {
    return Response.json({ error: "Parámetro strategy inválido." }, { status: 400 });
  }

  const key =
    process.env.GOOGLE_PAGESPEED_API_KEY ??
    process.env.PAGESPEED_INSIGHTS_API_KEY;
  if (!key) {
    return Response.json(
      {
        error:
          "Falta GOOGLE_PAGESPEED_API_KEY (o PAGESPEED_INSIGHTS_API_KEY) en el servidor.",
      },
      { status: 500 }
    );
  }

  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
  );
  endpoint.searchParams.set("url", TARGET_URL);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", key);
  for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
    endpoint.searchParams.append("category", cat);
  }

  const upstream = await fetch(endpoint.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return Response.json(
      {
        error: `PageSpeed API respondió ${upstream.status}`,
        detail: text.slice(0, 400),
      },
      { status: 502 }
    );
  }

  try {
    const data = JSON.parse(text) as unknown;
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Respuesta de PageSpeed no es JSON válido." },
      { status: 502 }
    );
  }
}
