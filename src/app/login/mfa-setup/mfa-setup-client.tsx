"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Phase =
  | "loading"
  | "enroll"
  | "verify_enrollment"
  | "verify_login"
  | "error";

function safeNextPath(next: string | null): string {
  if (!next || next === "") return "/";
  const path = next.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path.includes("://")) return "/";
  return path || "/";
}

function totpQrDataUrl(qr_code: string): string {
  if (qr_code.startsWith("data:")) return qr_code;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qr_code)}`;
}

export function MfaSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");

  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretHint, setSecretHint] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const dest = safeNextPath(nextRaw);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        router.replace(
          `/login?reason=auth&next=${encodeURIComponent(`/login/mfa-setup?next=${encodeURIComponent(dest)}`)}`
        );
        return;
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error || !data) {
        setPhase("error");
        setMessage(error?.message ?? "No se pudieron cargar los factores MFA.");
        return;
      }

      const verified = data.totp[0];
      if (verified) {
        setFactorId(verified.id);
        setPhase("verify_login");
        return;
      }

      const pending = data.all.find(
        (f) => f.factor_type === "totp" && f.status === "unverified"
      );
      if (pending) {
        setFactorId(pending.id);
        setPhase("verify_enrollment");
        return;
      }

      setPhase("enroll");
      setFactorId(null);
      setQrDataUrl(null);
      setSecretHint(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, dest]);

  const startEnroll = async () => {
    setBusy(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Minerva Hub",
      issuer: "Minerva Hub",
    });
    setBusy(false);
    if (error || !data) {
      setMessage(error?.message ?? "No se pudo iniciar el registro MFA.");
      return;
    }
    setFactorId(data.id);
    setQrDataUrl(totpQrDataUrl(data.totp.qr_code));
    setSecretHint(data.totp.secret);
    setPhase("verify_enrollment");
  };

  const submitVerify = async () => {
    if (!factorId || code.trim().length < 6) return;
    setBusy(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim().replace(/\s/g, ""),
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCode("");
    window.location.assign(dest);
  };

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="hub-portal-bg" aria-hidden />
      <div className="hub-portal-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <Card className="border-t-4 border-t-[var(--minerva-gold)] shadow-md ring-1 ring-foreground/10">
          <CardHeader className="border-b border-border/80 bg-muted/30">
            <CardTitle className="font-heading text-xl text-[var(--minerva-navy)]">
              Segundo factor (MFA)
            </CardTitle>
            <CardDescription>
              Obligatorio para cuentas de administración y gerencia. Usa una app
              de autenticación (Google Authenticator, Microsoft Authenticator,
              etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {phase === "loading" && (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            )}

            {phase === "error" && message && (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            )}

            {phase === "enroll" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Aún no tienes un factor TOTP verificado. Genera un código QR
                  y escanéalo con tu app.
                </p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void startEnroll()}
                >
                  {busy ? "Preparando…" : "Generar código QR"}
                </Button>
                {message && (
                  <p className="text-sm text-destructive" role="alert">
                    {message}
                  </p>
                )}
              </>
            )}

            {(phase === "verify_enrollment" || phase === "verify_login") &&
              qrDataUrl && (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL SVG del proveedor MFA */}
                  <img
                    src={qrDataUrl}
                    alt="Código QR para configurar el autenticador"
                    width={200}
                    height={200}
                    className="rounded-lg border border-border bg-white p-2"
                  />
                </div>
              )}

            {phase === "verify_enrollment" && secretHint && (
              <p className="break-all text-xs text-muted-foreground">
                Si no puedes escanear el QR, introduce manualmente el secreto:{" "}
                <span className="font-mono text-foreground">{secretHint}</span>
              </p>
            )}

            {(phase === "verify_enrollment" || phase === "verify_login") && (
              <>
                <p className="text-sm text-muted-foreground">
                  {phase === "verify_enrollment"
                    ? "Introduce el código de 6 dígitos que muestra tu app para confirmar el alta."
                    : "Introduce el código de tu app para completar el inicio de sesión."}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="mfa-code">Código TOTP</Label>
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={busy}
                    className="h-10 tracking-widest"
                    placeholder="000000"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy || code.trim().length < 6}
                  onClick={() => void submitVerify()}
                >
                  {busy ? "Verificando…" : "Verificar y continuar"}
                </Button>
                {message && (
                  <p className="text-sm text-destructive" role="alert">
                    {message}
                  </p>
                )}
              </>
            )}

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Link
                href="/"
                className="font-medium text-[var(--minerva-navy)] underline-offset-4 hover:underline"
              >
                Volver al Strategic AI Hub
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
