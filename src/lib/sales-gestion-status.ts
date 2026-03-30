import {
  computeDeliveryTimeStatus,
  isOrderActiveForDelivery,
  parseDeliveryDate,
} from "@/lib/sales-delivery-timing";
import type { SalesOrderRow } from "@/types/sales";

/** Categoría para KPIs, filtros y badges del tab Gestión de Pedidos. */
export type GestionCategoria = "retrasado" | "en_curso" | "no_empezado" | "cerrado";

export type GestionEstadoFilter = "todos" | "retrasado" | "en_curso" | "no_empezado";

/**
 * Heurística Legacy/Pro: estados típicos de pedido aún no iniciado en producción.
 */
export function isEstadoNoEmpezado(estado: string): boolean {
  const e = estado.trim().toLowerCase();
  if (!e) return true;
  const needles = [
    "pendiente",
    "no iniciado",
    "sin iniciar",
    "borrador",
    "planificado",
    "preventa",
    "presupuesto",
    "no empezado",
    "stand by",
    "stand-by",
  ];
  return needles.some((n) => e.includes(n));
}

/**
 * Prioridad: retraso de entrega (activo) → no empezado (ERP) → en curso → cerrado.
 */
export function getGestionCategoria(row: SalesOrderRow): GestionCategoria {
  const e = row.estado.trim().toLowerCase();
  if (e === "entregado" || e === "cancelado") return "cerrado";

  const active = isOrderActiveForDelivery(row.estado);
  const ts = computeDeliveryTimeStatus(row);

  if (active && ts === "late") return "retrasado";
  if (isEstadoNoEmpezado(row.estado)) return "no_empezado";
  if (active) return "en_curso";
  return "cerrado";
}

export function formatPedidoId(row: SalesOrderRow): string {
  const pc = row.pedidoCliente?.trim();
  if (pc) return pc;
  return String(row.idPedido ?? "");
}

/** Ordenación por fecha prevista (vacíos al final). */
export function compareFechaEntrega(a: SalesOrderRow, b: SalesOrderRow): number {
  const da = parseDeliveryDate(a.fechaEntrega);
  const db = parseDeliveryDate(b.fechaEntrega);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}
