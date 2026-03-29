"use client";

import Image from "next/image";

export function SemContactFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-[#002147]/15 bg-[#002147]/[0.03] px-4 py-8 md:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-24 shrink-0">
            <Image
              src="/minerva-logo.svg"
              alt=""
              fill
              className="object-contain object-left"
            />
          </div>
          <span className="font-medium text-[#002147]">
            Datos de contacto (referencia minervaglobal.es)
          </span>
        </div>
        <address className="not-italic leading-relaxed">
          MINERVA PACKAGING & PRINT, S.A. — Carrer Cabrera 13-15, 08192 Sant
          Quirze del Vallès (Barcelona) — T.{" "}
          <a className="text-[#002147] underline" href="tel:+34937113061">
            93 711 30 61
          </a>{" "}
          —{" "}
          <a
            className="text-[#002147] underline"
            href="mailto:minerva@minervaglobal.es"
          >
            minerva@minervaglobal.es
          </a>{" "}
          — Lun–Jue 8:00–16:00, Vie 8:00–14:00 —{" "}
          <a
            className="text-[#C69C2B] hover:underline"
            href="https://www.minervaglobal.es"
            target="_blank"
            rel="noopener noreferrer"
          >
            minervaglobal.es
          </a>
        </address>
      </div>
    </footer>
  );
}
