"use client";

import { Loader2 } from "lucide-react";

/** Placeholder mientras Turbopack carga un panel/tab pesado. */
export function TabRouteLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[10rem] items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
