"use client";

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

/** Proveedores de UI compartidos (p. ej. Radix Tooltip requiere este ámbito en toda la app). */
export function AppProviders({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;
}
