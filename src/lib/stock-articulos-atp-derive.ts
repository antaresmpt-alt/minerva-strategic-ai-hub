/**
 * Helpers ATP stock artículos (Bloque 15).
 * Libre = físico − Σ(reservada − consumida) en reservas activa/parcial.
 */

import type { StockArticuloEstadoDerivado } from "@/types/prod-stock-articulos";

export function deriveStockArticuloComprometida(
  cantidadReservada: number,
  cantidadConsumida: number
): number {
  return Math.max(0, cantidadReservada - cantidadConsumida);
}

export function deriveStockArticuloLibre(
  cantidadFisica: number,
  comprometidaTotal: number
): number {
  return Math.max(0, cantidadFisica - comprometidaTotal);
}

export function deriveStockArticuloEstado(
  cantidadFisica: number,
  comprometidaTotal: number
): StockArticuloEstadoDerivado {
  if (cantidadFisica <= 0) return "agotado";
  if (comprometidaTotal <= 0) return "disponible";
  if (cantidadFisica - comprometidaTotal <= 0) return "reservado";
  return "parcial";
}

export function hojasAEstuches(
  hojas: number,
  poses: number | null | undefined
): number | null {
  if (poses == null || poses <= 0) return null;
  return Math.floor(hojas * poses);
}

export function normalizeClienteStock(
  cliente: string | null | undefined
): string | null {
  const t = String(cliente ?? "").trim().toLowerCase();
  return t || null;
}
