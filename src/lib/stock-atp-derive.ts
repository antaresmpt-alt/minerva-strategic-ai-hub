import type { StockEstadoDerivado } from "@/types/prod-stock";

/** Suma reservas duras (cantidad_reservada NOT NULL) — misma regla que `stock_palets_atp`. */
export function sumReservaDuraTotal(
  reservas: readonly { cantidad_reservada: number | null }[],
): number {
  let total = 0;
  for (const r of reservas) {
    if (r.cantidad_reservada != null && r.cantidad_reservada > 0) {
      total += r.cantidad_reservada;
    }
  }
  return total;
}

/**
 * Estado ATP calculado (paridad con vista `stock_palets_atp.estado_derivado`).
 * No usar `prod_stock_palets.estado` en UI — es legacy.
 */
export function deriveEstadoDerivado(
  cantidadFisica: number,
  reservadaTotal: number,
): StockEstadoDerivado {
  if (cantidadFisica <= 0) return "agotado";
  if (reservadaTotal <= 0) return "disponible";
  if (cantidadFisica - reservadaTotal <= 0) return "reservado";
  return "parcial";
}

/** Etiqueta UI Cartelas (legacy usaba `consumido` en lugar de `agotado`). */
export function estadoDerivadoLabelCartelas(estado: StockEstadoDerivado): string {
  return estado === "agotado" ? "consumido" : estado;
}
