import { HubPortal } from "@/components/portal/hub-portal";
import { getCurrentProfileRole } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{ acceso?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const role = await getCurrentProfileRole();
  const isAdmin = role === "admin";

  const sp = await searchParams;
  const raw = sp.acceso;
  const acceso =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const showAccessRestrictedNotice = acceso === "restringido";

  return (
    <HubPortal
      isAdmin={isAdmin}
      showAccessRestrictedNotice={showAccessRestrictedNotice}
    />
  );
}
