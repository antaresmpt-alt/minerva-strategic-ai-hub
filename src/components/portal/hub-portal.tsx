import Image from "next/image";

import { MinervaSiteFooter } from "@/components/layout/minerva-site-footer";
import { ModuleCard } from "@/components/portal/module-card";

const MODULE_IMG = {
  sales: {
    src: "/images/module-sales.png",
    alt: "Sales Intelligence — icono del módulo",
  },
  sem: {
    src: "/images/module-sem.png",
    alt: "SEM — icono del módulo",
  },
  seo: {
    src: "/images/module-seo.png",
    alt: "SEO — icono del módulo",
  },
} as const;

function ModuleMark({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={152}
      height={176}
      className="h-auto max-h-[7.25rem] w-full object-contain"
    />
  );
}

/** PNG corporativos (~268×106 / 205×68): no ampliar mucho más del tamaño nativo para evitar pixelado. */
const BRAND_WORDMARK_W = 205;
const BRAND_WORDMARK_H = 68;
const BRAND_FULL_W = 268;
const BRAND_FULL_H = 106;

export function HubPortal() {
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

        <section className="mb-10 text-center sm:mb-12">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Bienvenido al Hub de Inteligencia de Minerva Global
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Selecciona el módulo para comenzar tus análisis
          </p>
        </section>

        <div className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
          <ModuleCard
            title="Minerva Sales & Tech Intelligence"
            description="Dashboard avanzado de ventas, márgenes reales y control operativo de la Oficina Técnica (pharma/cosmética)."
            iconFrame="module"
            icon={
              <ModuleMark
                src={MODULE_IMG.sales.src}
                alt={MODULE_IMG.sales.alt}
              />
            }
            actionLabel="Acceder a Ventas"
            href="/analytics/sales"
          />
          <ModuleCard
            title="SEM (Search Engine Marketing)"
            description="Herramientas de análisis SEM, PMAX, propuestas Meta Ads y generación ejecutiva con IA."
            iconFrame="module"
            icon={
              <ModuleMark src={MODULE_IMG.sem.src} alt={MODULE_IMG.sem.alt} />
            }
            actionLabel="Acceder a SEM"
            href="/sem"
          />
          <ModuleCard
            title="SEO (Search Engine Optimization)"
            description="Módulo en desarrollo para análisis orgánico y visibilidad web."
            iconFrame="module"
            icon={
              <ModuleMark src={MODULE_IMG.seo.src} alt={MODULE_IMG.seo.alt} />
            }
            actionLabel="Próximamente"
            disabled
          />
        </div>
      </div>

      <div className="relative z-10 mt-auto w-full shrink-0">
        <MinervaSiteFooter />
      </div>
    </div>
  );
}
