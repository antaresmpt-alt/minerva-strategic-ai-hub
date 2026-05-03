"use client";

import dynamic from "next/dynamic";

import type { SettingsTab } from "@/components/settings/settings-shell";

const SettingsShell = dynamic(
  () =>
    import("@/components/settings/settings-shell").then((m) => ({
      default: m.SettingsShell,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center bg-muted/40 px-4 text-sm text-muted-foreground">
        Cargando configuración…
      </div>
    ),
  },
);

export function SettingsRouteLazy({ defaultTab }: { defaultTab: SettingsTab }) {
  return <SettingsShell defaultTab={defaultTab} />;
}
