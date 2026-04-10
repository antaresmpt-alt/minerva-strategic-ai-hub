import { redirect } from "next/navigation";

/** La vista de órdenes esquela se retiró; el listado operativo está en OTs (maestro). */
export default function ProduccionOrdenesRedirectPage() {
  redirect("/produccion/ots");
}
