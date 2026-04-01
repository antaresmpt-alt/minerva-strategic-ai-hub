import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Acceso administración | Minerva Strategic AI Hub",
  description:
    "Inicio de sesión para el área interna de administración (Supabase Auth).",
};

function LoginFormFallback() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="hub-portal-bg" aria-hidden />
      <div className="hub-portal-overlay" aria-hidden />
      <div className="relative z-10 h-48 w-full max-w-md animate-pulse rounded-xl bg-muted/60 ring-1 ring-foreground/10" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
