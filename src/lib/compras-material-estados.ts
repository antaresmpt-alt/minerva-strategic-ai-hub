/** Valores persistidos en `prod_compra_material.estado` (UI matriz / selects). */
export const COMPRAS_MATERIAL_ESTADOS = [
  "Pendiente",
  "Generada",
  "Confirmado",
  "Recibido Parcial",
  "Recibido",
  "Cancelado",
] as const;

export type ComprasMaterialEstado = (typeof COMPRAS_MATERIAL_ESTADOS)[number];

export function normalizeCompraEstado(estado: string | null | undefined): string {
  return (estado ?? "").trim().toLowerCase();
}

/** Sincroniza texto en `produccion_ot_despachadas.estado_material` cuando aplica. */
export function estadoMaterialDesdeEstadoCompra(
  estadoCompra: string
): string | null {
  const n = normalizeCompraEstado(estadoCompra);
  if (n === "pendiente") return "Pendiente de pedir";
  if (n === "generada") return "Orden compra generada";
  if (n === "confirmado") return "Compra confirmada";
  if (n === "recibido parcial") return "Material parcialmente recibido";
  if (n === "recibido") return "Material recibido";
  if (n === "cancelado") return "Compra cancelada";
  return null;
}
