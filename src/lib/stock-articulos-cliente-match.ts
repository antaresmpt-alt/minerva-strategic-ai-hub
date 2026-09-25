/**
 * Comparación laxa de cliente OT vs lote (aviso UI, no bloquea).
 * 15.2 puede endurecer esto en DB cuando Optimus ↔ maestro esté validado.
 */

function normCliente(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** true = mostrar aviso amarillo (ambos tienen cliente y no encajan). */
export function clientesOtLoteDifieren(
  loteCliente: string | null | undefined,
  otCliente: string | null | undefined
): boolean {
  const a = normCliente(loteCliente);
  const b = normCliente(otCliente);
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.includes(b) || b.includes(a)) return false;
  return true;
}
