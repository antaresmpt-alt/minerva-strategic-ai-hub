"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const BRAND_WORDMARK_W = 205;
const BRAND_WORDMARK_H = 68;
const BRAND_FULL_W = 268;
const BRAND_FULL_H = 106;

const REASON_COPY: Record<string, { title: string; body: string }> = {
  auth: {
    title: "Sesión requerida",
    body: "Inicia sesión con una cuenta autorizada para acceder al área de administración.",
  },
  forbidden: {
    title: "Acceso restringido",
    body: "Tu cuenta no tiene rol de administrador. Si necesitas acceso, contacta con el equipo Minerva.",
  },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reasonInfo = reason ? REASON_COPY[reason] : null;

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setLoading(true);

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(error.message);
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    },
    [email, password, router]
  );

  async function handleSignOut() {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="hub-portal-bg" aria-hidden />
      <div className="hub-portal-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 flex flex-col items-center gap-4">
            <Image
              src="/images/brand-minerva-wordmark.png"
              alt="Minerva"
              width={BRAND_WORDMARK_W}
              height={BRAND_WORDMARK_H}
              priority
              unoptimized
              className="h-auto w-full max-w-[205px] object-contain object-center sm:hidden"
            />
            <Image
              src="/images/brand-minerva-full.png"
              alt="Minerva Global, Packaging and Print Creators"
              width={BRAND_FULL_W}
              height={BRAND_FULL_H}
              priority
              unoptimized
              className="hidden h-auto w-full max-w-[268px] object-contain object-center sm:block"
            />
            <p className="font-heading text-lg font-semibold tracking-tight text-[var(--minerva-navy)] sm:text-xl">
              Strategic AI Hub
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Área de administración interna
          </p>
        </div>

        <Card className="border-t-4 border-t-[var(--minerva-gold)] shadow-md ring-1 ring-foreground/10">
          <CardHeader className="border-b border-border/80 bg-muted/30">
            <CardTitle className="font-heading text-xl text-[var(--minerva-navy)]">
              Iniciar sesión
            </CardTitle>
            <CardDescription>
              Credenciales corporativas (Supabase Auth). Solo personal con rol
              admin puede entrar en las rutas /admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {reasonInfo && (
              <Alert className="mb-6 border-amber-200/90 bg-amber-50/95 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
                <AlertTitle>{reasonInfo.title}</AlertTitle>
                <AlertDescription>{reasonInfo.body}</AlertDescription>
              </Alert>
            )}

            {reason === "forbidden" && (
              <div className="mb-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[var(--minerva-navy)]/25 text-[var(--minerva-navy)] hover:bg-muted/80"
                  onClick={() => void handleSignOut()}
                >
                  Cerrar sesión e intentar con otra cuenta
                </Button>
              </div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 border-input bg-background px-3 py-2 shadow-xs ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px]"
                  placeholder="nombre@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 border-input bg-background px-3 py-2 shadow-xs ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px]"
                />
              </div>

              {formError && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-10 w-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              >
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
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
