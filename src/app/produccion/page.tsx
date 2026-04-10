import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function ProduccionHomePage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center text-center">
      <div className="relative mb-6 w-52 sm:w-60">
        <Image
          src="/images/module-produccion.png"
          alt="Módulo Producción — Minerva Global"
          width={320}
          height={380}
          className="h-auto w-full object-contain drop-shadow-md"
          priority
        />
      </div>
      <p className="mb-2 font-heading text-sm font-semibold tracking-wide text-[#C69C2B] uppercase">
        Minerva Global
      </p>
      <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
        Módulo de Producción
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        Centro de órdenes de trabajo, fichas técnicas y gestión de almacén.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/produccion/ots"
          className={cn(
            buttonVariants({ size: "default" }),
            "rounded-xl bg-[#C69C2B] px-6 font-semibold text-[#002147] hover:bg-[#b38a26]"
          )}
        >
          Ir a OTs (maestro)
        </Link>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "rounded-xl border-[#002147]/25"
          )}
        >
          Volver al portal
        </Link>
      </div>
      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Sparkles className="size-3.5 shrink-0 text-[#C69C2B]" aria-hidden />
        Funciones asistidas por IA en preparación
      </p>
    </div>
  );
}
