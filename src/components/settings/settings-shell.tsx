"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IngestKnowledgeTab } from "@/components/settings/ingest-knowledge-tab";
import { UsersManagementPanel } from "@/components/settings/users-management-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SettingsShellProps = {
  defaultTab: "ingest" | "users";
};

export function SettingsShell({ defaultTab }: SettingsShellProps) {
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
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Configuración
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingesta de conocimiento y gestión de usuarios (admin / gerencia).
        </p>

        <Tabs defaultValue={defaultTab} className="mt-8 w-full gap-4">
          <TabsList variant="line" className="w-full justify-start gap-1">
            <TabsTrigger value="ingest">Ingesta de conocimiento</TabsTrigger>
            <TabsTrigger value="users">Gestión de usuarios</TabsTrigger>
          </TabsList>
          <TabsContent value="ingest" className="mt-6 outline-none">
            <IngestKnowledgeTab />
          </TabsContent>
          <TabsContent value="users" className="mt-6 outline-none">
            <UsersManagementPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
