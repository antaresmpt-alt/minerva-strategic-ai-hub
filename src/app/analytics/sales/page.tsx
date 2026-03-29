import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function SalesIntelligencePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/5">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Sales &amp; Tech Intelligence
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Este dashboard está en preparación. Aquí conectarás ventas, márgenes y
          control de Oficina Técnica.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "no-underline"
          )}
        >
          Volver al Hub
        </Link>
        <Link
          href="/sem"
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "no-underline"
          )}
        >
          Ir a SEM
        </Link>
      </div>
    </div>
  );
}
