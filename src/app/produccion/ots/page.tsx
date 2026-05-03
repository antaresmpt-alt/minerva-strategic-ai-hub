import dynamic from "next/dynamic";
import { canAccessPlanificacionOtsTab } from "@/lib/permissions";
import {
  getCurrentProfileRole,
  getModuleAccessForCurrentUser,
} from "@/lib/supabase/server";

const ProduccionOtsModulePage = dynamic(
  () =>
    import("@/components/produccion/ots/produccion-ots-module-page").then(
      (m) => ({ default: m.ProduccionOtsModulePage }),
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando OTs…
      </div>
    ),
  },
);

/** Ruta bajo `app/produccion/` para heredar `produccion/layout.tsx` (ProduccionShell). */
export default async function ProduccionOtsPage() {
  const role = await getCurrentProfileRole();
  const moduleAccess = await getModuleAccessForCurrentUser();
  const dynamicMap =
    moduleAccess && Object.keys(moduleAccess).length > 0
      ? new Map(Object.entries(moduleAccess))
      : null;
  const canAccessPlanificacion = canAccessPlanificacionOtsTab(role, dynamicMap);

  return (
    <ProduccionOtsModulePage canAccessPlanificacion={canAccessPlanificacion} />
  );
}
