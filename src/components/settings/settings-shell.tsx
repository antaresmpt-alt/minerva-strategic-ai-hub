"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { GlobalModelSelector } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabRouteLoading } from "@/components/ui/tab-route-loading";

const IngestKnowledgeTab = dynamic(
  () =>
    import("@/components/settings/ingest-knowledge-tab").then((m) => ({
      default: m.IngestKnowledgeTab,
    })),
  { loading: () => <TabRouteLoading label="Cargando ingestión…" /> },
);

const UsersManagementPanel = dynamic(
  () =>
    import("@/components/settings/users-management-panel").then((m) => ({
      default: m.UsersManagementPanel,
    })),
  { loading: () => <TabRouteLoading label="Cargando usuarios…" /> },
);

const VariablesSistemaTab = dynamic(
  () =>
    import("@/components/settings/variables-sistema-tab").then((m) => ({
      default: m.VariablesSistemaTab,
    })),
  { loading: () => <TabRouteLoading label="Cargando variables…" /> },
);

const PlanificacionIaSettingsTab = dynamic(
  () =>
    import("@/components/settings/planificacion-ia-settings-tab").then((m) => ({
      default: m.PlanificacionIaSettingsTab,
    })),
  { loading: () => <TabRouteLoading label="Cargando planificación IA…" /> },
);

const EmailPlantillasTab = dynamic(
  () =>
    import("@/components/settings/email-plantillas-tab").then((m) => ({
      default: m.EmailPlantillasTab,
    })),
  { loading: () => <TabRouteLoading label="Cargando plantillas…" /> },
);

const RecursosProduccionTab = dynamic(
  () =>
    import("@/components/settings/recursos-produccion-tab").then((m) => ({
      default: m.RecursosProduccionTab,
    })),
  { loading: () => <TabRouteLoading label="Cargando recursos…" /> },
);

const LogsTab = dynamic(
  () =>
    import("@/components/settings/logs-tab").then((m) => ({
      default: m.LogsTab,
    })),
  { loading: () => <TabRouteLoading label="Cargando logs…" /> },
);

type SettingsTab =
  | "ingest"
  | "users"
  | "variables"
  | "plan-ia"
  | "email"
  | "recursos"
  | "logs";

type SettingsShellProps = {
  defaultTab: SettingsTab;
};

export function SettingsShell({ defaultTab }: SettingsShellProps) {
  const [tab, setTab] = useState<SettingsTab>(defaultTab);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--minerva-navy)] underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al Hub
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Configuración
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingesta de conocimiento, usuarios, variables de sistema y plantillas
              y prompts de producción (admin / gerencia).
            </p>
          </div>
          <GlobalModelSelector layout="row" className="shrink-0" />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SettingsTab)}
          className="mt-8 w-full gap-4"
        >
          <TabsList variant="line" className="w-full justify-start gap-1">
            <TabsTrigger value="ingest">Ingesta de conocimiento</TabsTrigger>
            <TabsTrigger value="users">Gestión de usuarios</TabsTrigger>
            <TabsTrigger value="variables">Variables Sistema</TabsTrigger>
            <TabsTrigger value="plan-ia">Planificación IA</TabsTrigger>
            <TabsTrigger value="email">Plantillas y Prompt</TabsTrigger>
            <TabsTrigger value="recursos">Recursos Producción</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="ingest" className="mt-6 outline-none">
            {tab === "ingest" ? <IngestKnowledgeTab /> : null}
          </TabsContent>
          <TabsContent value="users" className="mt-6 outline-none">
            {tab === "users" ? <UsersManagementPanel /> : null}
          </TabsContent>
          <TabsContent value="variables" className="mt-6 outline-none">
            {tab === "variables" ? <VariablesSistemaTab /> : null}
          </TabsContent>
          <TabsContent value="plan-ia" className="mt-6 outline-none">
            {tab === "plan-ia" ? <PlanificacionIaSettingsTab /> : null}
          </TabsContent>
          <TabsContent value="email" className="mt-6 outline-none">
            {tab === "email" ? <EmailPlantillasTab /> : null}
          </TabsContent>
          <TabsContent value="recursos" className="mt-6 outline-none">
            {tab === "recursos" ? <RecursosProduccionTab /> : null}
          </TabsContent>
          <TabsContent value="logs" className="mt-6 outline-none">
            {tab === "logs" ? <LogsTab /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
