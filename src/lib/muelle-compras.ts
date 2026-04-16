import { normalizeCompraEstado } from "@/lib/compras-material-estados";

/** Estados que deben aparecer en la pestaña Muelle (filtro tolerante a variantes). */
export function isCompraVisibleEnMuelle(estado: string | null | undefined): boolean {
  const n = normalizeCompraEstado(estado);
  return (
    n === "generada" ||
    n === "confirmado" ||
    n === "confirmada" ||
    n === "recibido parcial"
  );
}
