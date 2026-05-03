import { ProduccionOtsModulePage } from "@/components/produccion/ots/produccion-ots-module-page";
import { canAccessPlanificacionOtsTab } from "@/lib/permissions";
import {
  getCurrentProfileRole,
  getModuleAccessForCurrentUser,
} from "@/lib/supabase/server";

/** Ruta bajo `app/produccion/` para heredar `produccion/layout.tsx` (ProduccionShell). */
export default async function ProduccionOtsPage() {
  const role = await getCurrentProfileRole();
  const moduleAccess = await getModuleAccessForCurrentUser();
  const dynamic =
    moduleAccess && Object.keys(moduleAccess).length > 0
      ? new Map(Object.entries(moduleAccess))
      : null;
  const canAccessPlanificacion = canAccessPlanificacionOtsTab(role, dynamic);

  return (
    <ProduccionOtsModulePage canAccessPlanificacion={canAccessPlanificacion} />
  );
}
