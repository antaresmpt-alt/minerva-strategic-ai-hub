/** Id Stock ≥ este valor = cartela de prueba (sandbox), fuera de Optimus y producción. */
export const SANDBOX_ID_STOCK_MIN = 99000;

export function isSandboxIdStock(idStock: number): boolean {
  return idStock >= SANDBOX_ID_STOCK_MIN;
}
