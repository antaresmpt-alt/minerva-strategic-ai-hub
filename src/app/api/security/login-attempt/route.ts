import { NextResponse } from "next/server";

import { clientIpFromRequest, rateLimitAllow } from "@/lib/edge-rate-limit";
import { recordSecurityAudit } from "@/lib/security-audit";

type LoginAttemptBody = {
  email?: string;
  ok?: boolean;
  reason?: string;
};

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  if (!rateLimitAllow(`security:login-attempt:ip:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: true });
  }

  let body: LoginAttemptBody;
  try {
    body = (await request.json()) as LoginAttemptBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "unknown";
  const ok = body.ok === true;
  const reason = body.reason?.trim() || (ok ? "success" : "error");

  if (!rateLimitAllow(`security:login-attempt:email:${email}:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too Many Requests", message: "Demasiados intentos de login." },
      { status: 429 }
    );
  }

  await recordSecurityAudit({
    accion: ok ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
    tabla_afectada: "auth",
    detalle: `email=${email}; ip=${ip}; reason=${reason}`,
    actor_id: null,
    actor_email: email === "unknown" ? null : email,
  });

  return NextResponse.json({ ok: true });
}
