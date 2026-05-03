import Image from "next/image";
import dynamic from "next/dynamic";

import { MinervaSiteFooter } from "@/components/layout/minerva-site-footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TabRouteLoading } from "@/components/ui/tab-route-loading";

const HubModulesGrid = dynamic(
  () =>
    import("@/components/portal/hub-modules-grid").then((m) => ({
      default: m.HubModulesGrid,
    })),
  {
    loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center py-8">
        <TabRouteLoading label="Cargando módulos del Hub…" />
      </div>
    ),
  },
);

/** PNG corporativos (~268×106 / 205×68): no ampliar mucho más del tamaño nativo para evitar pixelado. */
const BRAND_WORDMARK_W = 205;
const BRAND_WORDMARK_H = 68;
const BRAND_FULL_W = 268;
const BRAND_FULL_H = 106;

export type HubPortalProps = {
  role: string | null;
  moduleAccess: Record<string, boolean> | null;
  showAccessRestrictedNotice?: boolean;
  showModuleDeniedNotice?: boolean;
};

export function HubPortal({
  role,
  moduleAccess,
  showAccessRestrictedNotice,
  showModuleDeniedNotice,
}: HubPortalProps) {
  return (
    <div className="hub-portal-root relative flex min-h-dvh flex-col">
      <div className="hub-portal-bg" aria-hidden />
      <div className="hub-portal-overlay" aria-hidden />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-10 flex flex-col items-center text-center sm:mb-12">
          <div className="mb-5 flex w-full flex-col items-center gap-4">
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
        </header>

        {showAccessRestrictedNotice && (
          <div className="mb-8 w-full max-w-2xl self-center">
            <Alert
              role="alert"
              className="border-amber-200/90 bg-amber-50/95 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50"
            >
              <AlertTitle>Acceso restringido</AlertTitle>
              <AlertDescription>
                El área solicitada no está disponible para tu perfil. Si
                necesitas documentación vectorizada o permisos adicionales,
                contacta con gerencia o administración.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {showModuleDeniedNotice && (
          <div className="mb-8 w-full max-w-2xl self-center">
            <Alert
              role="alert"
              className="border-slate-300/90 bg-slate-50/95 text-slate-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100"
            >
              <AlertTitle>Sin permiso para ese módulo</AlertTitle>
              <AlertDescription>
                No puedes acceder a esa sección con tu rol actual. Vuelve al Hub
                y elige un módulo permitido, o contacta con Gerencia.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <section className="mb-10 text-center sm:mb-12">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Bienvenido al Hub de Inteligencia de Minerva Global
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Selecciona el módulo para comenzar tus análisis
          </p>
        </section>

        <HubModulesGrid role={role} moduleAccess={moduleAccess} />
      </div>

      <div className="relative z-10 mt-auto w-full shrink-0">
        <MinervaSiteFooter />
      </div>
    </div>
  );
}
