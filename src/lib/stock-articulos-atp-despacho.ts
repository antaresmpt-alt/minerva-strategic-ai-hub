/**
 * Bloque 15.2 — ATP de producto al despachar una OT.
 * Lógica pura: qué lotes sirven, cuánto cubren y cómo repartir la reserva.
 * Con Optimus en paralelo, Minerva NO crea OTs: el reparto «mezclar» se
 * materializa creando en Optimus OT entrega + OT fabricación.
 */

import { clientesOtLoteDifieren } from "@/lib/stock-articulos-cliente-match";
import type { StockArticuloAtpRow } from "@/types/prod-stock-articulos";

/** Marca en notas de reserva (15.4) hasta tener campo persistente en DB. */
export const OT_ENTREGA_TAG = "[OT_ENTREGA]";

export type AtpDespachoLote = Pick<
  StockArticuloAtpRow,
  | "id"
  | "referencia_codigo"
  | "referencia_cliente"
  | "cliente"
  | "unidad"
  | "poses"
  | "estado_proceso"
  | "cantidad_fisica"
  | "cantidad_libre"
  | "ubicacion_fisica"
  | "ot_origen"
  | "created_at"
>;

export type AtpDespachoCobertura =
  | "sin_stock"
  | "sin_cantidad"
  | "total"
  | "parcial";

export type AtpDespachoResumen = {
  cantidadPedida: number | null;
  /**
   * Terminado en uds, libre > 0, de esta referencia (ya filtrada aguas arriba).
   * Incluye cliente distinto: se ofrece y se avisa. Orden de consumo.
   */
  ptUsables: AtpDespachoLote[];
  librePtUsable: number;
  /** WIP (impreso/troquelado/hojas…): solo informativo. Incluye cliente distinto. */
  wipUsables: AtpDespachoLote[];
  /**
   * Misma referencia, texto de cliente distinto al de la OT (o OT sin cliente).
   * Se ofrece igual; la UI avisa y puede copiar el nombre de la OT.
   */
  clienteDistinto: AtpDespachoLote[];
  /**
   * Reservado. En esta referencia no se esconde stock por el texto del cliente.
   * Queda vacío: un lote de otro cliente en otra referencia no llega a esta función.
   */
  otrosClientes: AtpDespachoLote[];
  cobertura: AtpDespachoCobertura;
  /** min(libre usable, pedida). */
  usarDeStock: number;
  /** pedida − usarDeStock. */
  faltan: number;
};

/**
 * Lote sin cliente = cualquiera. Lote con cliente = la OT encaja (laxo).
 * No decide si el lote se esconde: en la misma referencia el stock se ofrece
 * igual y `clienteDistinto` marca el aviso.
 */
export function loteClienteCompatible(
  loteCliente: string | null | undefined,
  otCliente: string | null | undefined
): boolean {
  if (!(loteCliente ?? "").trim()) return true;
  if (!(otCliente ?? "").trim()) return false;
  return !clientesOtLoteDifieren(loteCliente, otCliente);
}

function esPtUds(l: AtpDespachoLote): boolean {
  return l.estado_proceso === "terminado" && l.unidad === "uds";
}

export function resumenAtpDespacho(
  lotes: readonly AtpDespachoLote[],
  otCliente: string | null | undefined,
  cantidadPedida: number | null
): AtpDespachoResumen {
  const conLibre = lotes.filter((l) => l.cantidad_libre > 0);
  const clienteDistinto = conLibre.filter(
    (l) => !loteClienteCompatible(l.cliente, otCliente)
  );

  // Mismo cliente (o genérico) antes que un texto distinto; dentro, FIFO.
  const rankCliente = (l: AtpDespachoLote) => {
    if (!loteClienteCompatible(l.cliente, otCliente)) return 2;
    return (l.cliente ?? "").trim() ? 0 : 1;
  };
  const ptUsables = conLibre.filter(esPtUds).sort((a, b) => {
    const ra = rankCliente(a);
    const rb = rankCliente(b);
    if (ra !== rb) return ra - rb;
    return a.created_at.localeCompare(b.created_at);
  });
  const wipUsables = conLibre.filter((l) => !esPtUds(l));
  const librePtUsable = ptUsables.reduce((s, l) => s + l.cantidad_libre, 0);

  const pedida =
    cantidadPedida != null && Number.isFinite(cantidadPedida) && cantidadPedida > 0
      ? Math.trunc(cantidadPedida)
      : null;

  let cobertura: AtpDespachoCobertura;
  if (librePtUsable <= 0) cobertura = "sin_stock";
  else if (pedida == null) cobertura = "sin_cantidad";
  else if (librePtUsable >= pedida) cobertura = "total";
  else cobertura = "parcial";

  const usarDeStock =
    pedida == null ? 0 : Math.min(librePtUsable, pedida);
  const faltan = pedida == null ? 0 : pedida - usarDeStock;

  return {
    cantidadPedida: pedida,
    ptUsables,
    librePtUsable,
    wipUsables,
    clienteDistinto,
    otrosClientes: [],
    cobertura,
    usarDeStock,
    faltan,
  };
}

export type PlanReservaLinea = { stockId: string; cantidad: number };

/** Reparte `cantidad` entre lotes en el orden dado (sin pasar del libre). */
export function planReservaLotes(
  lotes: readonly Pick<AtpDespachoLote, "id" | "cantidad_libre">[],
  cantidad: number
): PlanReservaLinea[] {
  const plan: PlanReservaLinea[] = [];
  let resto = Math.max(0, Math.trunc(cantidad));
  for (const l of lotes) {
    if (resto <= 0) break;
    const tomar = Math.min(l.cantidad_libre, resto);
    if (tomar <= 0) continue;
    plan.push({ stockId: l.id, cantidad: tomar });
    resto -= tomar;
  }
  return plan;
}

/** Notas de reserva con el tag de entrega una sola vez. */
export function buildReservaNotas(
  esEntrega: boolean,
  notas: string | null | undefined
): string {
  const limpio = (notas ?? "")
    .split(OT_ENTREGA_TAG)
    .join(" ")
    .replace(/^[\s\-·]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!esEntrega) return (notas ?? "").trim();
  return limpio ? `${OT_ENTREGA_TAG} ${limpio}` : OT_ENTREGA_TAG;
}

/** Texto para crear en Optimus el reparto entrega + fabricación. */
export function textoRepartoOptimus(args: {
  otNumero: string;
  cliente: string | null | undefined;
  referencia: string;
  pedidoCliente?: string | null;
  usarDeStock: number;
  faltan: number;
}): string {
  const n = (v: number) => v.toLocaleString("es-ES");
  const cab = [
    `OT ${args.otNumero}`,
    args.cliente?.trim() || null,
    args.referencia,
    args.pedidoCliente?.trim() ? `pedido ${args.pedidoCliente.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return [
    cab,
    `1) OT ENTREGA de ${n(args.usarDeStock)} uds (sale de stock Minerva, no fabrica).`,
    `2) OT FABRICACIÓN de ${n(args.faltan)} uds (despacho normal).`,
    "Al importar la OT de entrega: reservarla en Stock artículos (OT entrega).",
  ].join("\n");
}
