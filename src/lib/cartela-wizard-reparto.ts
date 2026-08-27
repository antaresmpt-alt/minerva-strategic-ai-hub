/**
 * Reparte hojas de albarán entre N palets físicos (resto en los primeros).
 * Ej. 16000 / 8 → ocho de 2000; 10 / 3 → 4, 3, 3.
 */
export function repartirHojasEntrePalets(total: number, n: number): number[] {
  const count = Math.max(0, Math.trunc(n));
  if (count <= 0) return [];
  const t = Math.max(0, Math.trunc(total));
  if (t <= 0) return Array.from({ length: count }, () => 0);
  const base = Math.floor(t / count);
  const rem = t % count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Best practice ATP al cartelar desde OC:
 * - 1 OT en el palet → reserva dura = todas las hojas (estado «reservado»).
 * - multi-OT o stock libre → sin default (blanda / vacío; el usuario reparte).
 *
 * La blanda (cantidad_reservada NULL) deja el badge «disponible» aunque la OT
 * esté enlazada; engaña en planta. La dura hace que ATP y badge digan la verdad.
 */
export function defaultReservasDurasUnaOt(
  ots: string[],
  cantidadHojas: number,
  stockLibre = false,
): Record<string, string> {
  if (stockLibre) return {};
  if (ots.length !== 1) return {};
  const ot = ots[0]?.trim();
  if (!ot) return {};
  const h = Math.max(0, Math.trunc(cantidadHojas));
  if (h <= 0) return {};
  return { [ot]: String(h) };
}

/**
 * Al cambiar «Cantidad hojas»: si hay 1 OT y la reserva dura estaba vacía
 * («todas») o coincidía con la cantidad anterior, la alinea a la nueva.
 * No pisa un valor manual distinto (reserva parcial).
 */
export function syncReservaDuraConCantidad(args: {
  ots: string[];
  reservas: Record<string, string>;
  cantidadAnterior: number;
  cantidadNueva: number;
  stockLibre?: boolean;
}): Record<string, string> {
  const {
    ots,
    reservas,
    cantidadAnterior,
    cantidadNueva,
    stockLibre = false,
  } = args;
  if (stockLibre || ots.length !== 1) return { ...reservas };
  const ot = ots[0]?.trim();
  if (!ot) return { ...reservas };

  const raw = (reservas[ot] ?? "").trim();
  const vaciaOBlanda =
    raw === "" || /^(todas?|all|\*)$/i.test(raw);
  const previa = Math.max(0, Math.trunc(cantidadAnterior));
  const coincidiaConAnterior =
    raw !== "" && Number.parseInt(raw, 10) === previa;

  if (!vaciaOBlanda && !coincidiaConAnterior) return { ...reservas };

  const nueva = Math.max(0, Math.trunc(cantidadNueva));
  if (nueva <= 0) {
    const next = { ...reservas };
    delete next[ot];
    return next;
  }
  return { ...reservas, [ot]: String(nueva) };
}
