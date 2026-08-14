import { redirect } from "next/navigation";

/** La portada del módulo no tenía uso operativo; el trabajo empieza en OTs (maestro). */
export default function ProduccionHomeRedirectPage() {
  redirect("/produccion/ots");
}
