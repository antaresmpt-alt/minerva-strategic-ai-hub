import { NextResponse } from "next/server";

import { clientIpFromRequest, rateLimitAllow } from "@/lib/edge-rate-limit";
import { recordSecurityAudit } from "@/lib/security-audit";

type AccessDeniedBody = {
  reason?: string;
  path?: string;
  role?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  if (!rateLimitAllow(`security:access-denied:ip:${ip}`, 200, 60_000)) {
    return NextResponse.json({ ok: true });
  }

  let body: AccessDeniedBody;
  try {
    body = (await request.json()) as AccessDeniedBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  await recordSecurityAudit({
    accion: "ACCESS_DENIED",
    tabla_afectada: "routing",
    registro_id: body.userId ?? null,
    detalle: `reason=${body.reason ?? "unknown"}; path=${body.path ?? "unknown"}; role=${body.role ?? "null"}; ip=${ip}`,
    actor_id: body.userId ?? null,
    actor_email: null,
  });

  return NextResponse.json({ ok: true });
}
