import type { Metadata } from "next";

import { ProduccionShell } from "@/components/produccion/produccion-shell";
import { canAccessHubModule } from "@/lib/permissions";
import {
  getCurrentProfileRole,
  getModuleAccessForCurrentUser,
} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Producción | Minerva Strategic AI Hub",
  description:
    "Órdenes de trabajo, fichas técnicas y almacén — Minerva Global.",
};

export default async function ProduccionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentProfileRole();
  const moduleAccess = await getModuleAccessForCurrentUser();
  const dynamic =
    moduleAccess && Object.keys(moduleAccess).length > 0
      ? new Map(Object.entries(moduleAccess))
      : null;
  const hasProduccionModule = canAccessHubModule(
    role,
    "produccion",
    dynamic
  );

  return (
    <ProduccionShell hasProduccionModule={hasProduccionModule}>
      {children}
    </ProduccionShell>
  );
}
