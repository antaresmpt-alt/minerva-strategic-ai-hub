import { ArticulosMaestroPage } from "@/components/produccion/articulos/articulos-maestro-page";
import { getCurrentProfileRole } from "@/lib/supabase/server";

export default async function ProduccionArticulosPage() {
  const role = await getCurrentProfileRole();
  return <ArticulosMaestroPage userRole={role} />;
}
