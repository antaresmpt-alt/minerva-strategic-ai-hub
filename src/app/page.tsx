import { HubPortal } from "@/components/portal/hub-portal";
import {
  getCurrentProfileRole,
  getModuleAccessForCurrentUser,
} from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{
    acceso?: string | string[];
    permiso?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const role = await getCurrentProfileRole();
  const moduleAccess = await getModuleAccessForCurrentUser();

  const sp = await searchParams;
  const rawAcceso = sp.acceso;
  const acceso =
    typeof rawAcceso === "string"
      ? rawAcceso
      : Array.isArray(rawAcceso)
        ? rawAcceso[0]
        : undefined;
  const rawPermiso = sp.permiso;
  const permiso =
    typeof rawPermiso === "string"
      ? rawPermiso
      : Array.isArray(rawPermiso)
        ? rawPermiso[0]
        : undefined;

  const showAccessRestrictedNotice = acceso === "restringido";
  const showModuleDeniedNotice = permiso === "denegado";

  return (
    <HubPortal
      role={role}
      moduleAccess={moduleAccess}
      showAccessRestrictedNotice={showAccessRestrictedNotice}
      showModuleDeniedNotice={showModuleDeniedNotice}
    />
  );
}
