import type { Metadata } from "next";

import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = {
  title: "Configuración | Minerva Strategic AI Hub",
  description: "Ingesta RAG, gestión de usuarios y variables de sistema.",
};

type SettingsPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const sp = await searchParams;
  const raw = sp.tab;
  const tabStr =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const defaultTab =
    tabStr === "users"
      ? "users"
      : tabStr === "variables"
        ? "variables"
        : tabStr === "email"
          ? "email"
          : tabStr === "recursos"
            ? "recursos"
          : tabStr === "logs"
            ? "logs"
          : "ingest";

  return <SettingsShell defaultTab={defaultTab} />;
}
