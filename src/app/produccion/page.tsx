import { redirect } from "next/navigation";

import { normalizeDbRole } from "@/lib/permissions";
import { getCurrentProfileRole } from "@/lib/supabase/server";

/** Comercial (Bloque 14) → maestro; resto → OTs. */
export default async function ProduccionHomeRedirectPage() {
  const role = await getCurrentProfileRole();
  if (normalizeDbRole(role) === "comercial") {
    redirect("/produccion/articulos");
  }
  redirect("/produccion/ots");
}
