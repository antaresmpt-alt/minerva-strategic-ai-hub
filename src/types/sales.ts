/** Fila normalizada del CSV de ventas / Oficina Técnica */
export interface SalesOrderRow {
  idPedido: number;
  estado: string;
  cliente: string;
  pedidoCliente: string;
  cantidadPedida: number;
  valorPotencial: number;
  titulo: string;
  fechaApertura: string;
  fechaEntrega: string;
  fsc: string;
  pruebaColor: string;
  pdfOk: string;
  muestraOk: string;
  comercial: string;
  tipoCliente: string;
  valorReal: number;
  costeEstimado: number;
  margenEuros: number;
  margenPorcentaje: number;
}

/** Vista de seguridad: manager ve todo; comercial solo su cartera */
export type SalesRoleView =
  | "manager"
  | "comercial-1"
  | "comercial-2"
  | "comercial-3"
  | "comercial-4"
  | "comercial-5"
  | "comercial-6";

export const SALES_ROLE_LABELS: Record<SalesRoleView, string> = {
  manager: "Vista Manager",
  "comercial-1": "Vista Comercial 1",
  "comercial-2": "Vista Comercial 2",
  "comercial-3": "Vista Comercial 3",
  "comercial-4": "Vista Comercial 4",
  "comercial-5": "Vista Comercial 5",
  "comercial-6": "Vista Comercial 6",
};

/** Estado de plazo de entrega (se calcula en el hook; ver `sales-delivery-timing`). */
export type DeliveryTimeStatus = "ok" | "risk" | "late" | "na";

/** Umbral Oficina Técnica: coste estimado > 75% del valor real */
export function isTechnicalMarginAlert(row: SalesOrderRow): boolean {
  if (row.valorReal <= 0) return false;
  return row.costeEstimado > 0.75 * row.valorReal;
}

export function comercialLabelFromRole(role: SalesRoleView): string | null {
  if (role === "manager") return null;
  const n = role.replace("comercial-", "");
  return `Comercial ${n}`;
}
