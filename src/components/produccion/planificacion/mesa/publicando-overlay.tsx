"use client";

import { Loader2 } from "lucide-react";

interface PublicandoOverlayProps {
  open: boolean;
  message?: string;
}

export function PublicandoOverlay({
  open,
  message = "Publicando Plan de Producción...",
}: PublicandoOverlayProps) {
  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-lg">
        <Loader2 className="size-8 animate-spin text-[#002147]" />
        <p className="text-sm font-semibold text-[#002147]">{message}</p>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full w-1/3 animate-pulse rounded-full bg-[#C69C2B]" />
        </div>
      </div>
    </div>
  );
}
