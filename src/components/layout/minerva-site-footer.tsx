const LEGAL_LINKS = [
  {
    href: "https://www.minervaglobal.es/legales/politica-de-calidad",
    label: "Política de calidad",
  },
  {
    href: "https://www.minervaglobal.es/legales/aviso-legal",
    label: "Aviso legal",
  },
  {
    href: "https://www.minervaglobal.es/legales/politica-de-privacidad",
    label: "Política de privacidad",
  },
  {
    href: "https://www.minervaglobal.es/legales/politica-de-cookies",
    label: "Política de cookies",
  },
  {
    href: "https://www.minervaglobal.es/legales/autodeclaracion-fsc",
    label: "Autodeclaración FSC®",
  },
] as const;

export function MinervaSiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#002147] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="max-w-lg space-y-3">
            <p className="font-heading text-[0.65rem] font-semibold tracking-[0.22em] text-white uppercase sm:text-[11px]">
              Minerva Packaging &amp; Print, S.A.
            </p>
            <address className="space-y-1 not-italic text-[13px] leading-relaxed text-white/75 sm:text-sm">
              <span className="block">Carrer Cabrera 13-15</span>
              <span className="block">
                08192 Sant Quirze del Vallès (Barcelona)
              </span>
              <span className="mt-3 block">
                <a
                  href="tel:+34937113061"
                  className="transition-colors hover:text-[#C69C2B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C69C2B]"
                >
                  T. 93 711 30 61
                </a>
              </span>
              <a
                href="mailto:minerva@minervaglobal.es"
                className="mt-0.5 inline-block transition-colors hover:text-[#C69C2B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C69C2B]"
              >
                minerva@minervaglobal.es
              </a>
            </address>
          </div>

          <nav
            aria-label="Enlaces legales"
            className="flex flex-col gap-x-6 gap-y-2 text-[11px] tracking-wide text-white/65 sm:flex-row sm:flex-wrap lg:max-w-md lg:justify-end"
          >
            {LEGAL_LINKS.map((item, i) => (
              <span key={item.href} className="inline-flex items-center gap-x-2">
                {i > 0 ? (
                  <span className="hidden text-white/25 sm:inline" aria-hidden>
                    |
                  </span>
                ) : null}
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 transition-colors hover:text-[#C69C2B] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C69C2B]"
                >
                  {item.label}
                </a>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
