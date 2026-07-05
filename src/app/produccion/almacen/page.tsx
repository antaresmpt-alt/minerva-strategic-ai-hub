import { redirect } from "next/navigation";

// El módulo "Almacén MRP" (provisional, no usado) se retiró en el Bloque 9.2.
// El stock real vive en Cartelas + Stock (por palet). Ver migración
// 20260705120000 para las tablas legacy huérfanas (no borradas).
export default function ProduccionAlmacenRedirectPage() {
  redirect("/produccion/almacen/stock");
}
