import { Suspense } from "react";

import { MfaSetupClient } from "./mfa-setup-client";

export const metadata = {
  title: "Configuración MFA | Minerva Strategic AI Hub",
  description:
    "Registro del segundo factor de autenticación para administración.",
};

function MfaFallback() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="hub-portal-bg" aria-hidden />
      <div className="hub-portal-overlay" aria-hidden />
      <p className="relative z-10 text-sm text-muted-foreground">Cargando…</p>
    </div>
  );
}

export default function MfaSetupPage() {
  return (
    <Suspense fallback={<MfaFallback />}>
      <MfaSetupClient />
    </Suspense>
  );
}
