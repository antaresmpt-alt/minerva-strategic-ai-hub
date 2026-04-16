import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Muelle | Minerva Strategic AI Hub",
  description: "Recepción de material — Minerva Global.",
};

export default function MuellePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 px-2 py-10 text-center sm:py-16 md:py-24">
      <div className="w-full rounded-2xl border border-[#002147]/12 bg-white/90 px-6 py-10 shadow-sm backdrop-blur-sm sm:px-10 sm:py-14">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-[#002147] sm:text-2xl md:text-3xl">
          Muelle: Recepción de Material (Próximamente)
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Estamos preparando el panel de recepción en muelle. Mientras tanto,
          contacta con Producción o Gerencia si necesitas registrar entradas.
        </p>
      </div>
    </div>
  );
}
