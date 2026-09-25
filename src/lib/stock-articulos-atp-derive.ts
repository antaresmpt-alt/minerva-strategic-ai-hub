/**
 * Helpers ATP stock artículos (Bloque 15) — paridad con stock-atp-derive (B9).
 */

import type { StockArticuloEstadoDerivado } from "@/types/prod-stock-articulos";

export function deriveStockArticuloLibre(
  cantidadFisica: number,
  cantidadReservadaTotal: number
): number {
  return Math.max(0, cantidadFisica - cantidadReservadaTotal);
}

export function deriveStockArticuloEstado(
  cantidadFisica: number,
  cantidadReservadaTotal: number
): StockArticuloEstadoDerivado {
  if (cantidadFisica <= 0) return "agotado";
  if (cantidadReservadaTotal <= 0) return "disponible";
  if (cantidadFisica - cantidadReservadaTotal <= 0) return "reservado";
  return "parcial";
}

/** Convierte hojas → estuches si hay poses; si no, devuelve null. */
export function hojasAEstuches(
  hojas: number,
  poses: number | null | undefined
): number | null {
  if (poses == null || poses <= 0) return null;
  return Math.floor(hojas * poses);
}
