import type { Metadata } from "next";
import dynamic from "next/dynamic";

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
        : tabStr === "plan-ia"
          ? "plan-ia"
        : tabStr === "email"
          ? "email"
          : tabStr === "recursos"
            ? "recursos"
          : tabStr === "logs"
            ? "logs"
          : "ingest";

  return <SettingsShell defaultTab={defaultTab} />;
}
