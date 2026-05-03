import dynamic from "next/dynamic";
import {
  getCurrentProfileRole,
  getModuleAccessForCurrentUser,
} from "@/lib/supabase/server";

const HubPortal = dynamic(
  () =>
    import("@/components/portal/hub-portal").then((m) => ({
      default: m.HubPortal,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando portal…
      </div>
    ),
  },
);

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
