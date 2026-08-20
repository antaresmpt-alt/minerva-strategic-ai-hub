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

// ── Bloque 9.8.1b — Constantes STOP ─────────────────────────────────────────
// Fuente única de verdad para los textos de estado STOP de material.
// Cambiar aquí propaga al RPC SQL (tiene las cadenas repetidas; actualizar a la
// vez), a la allowlist de nueva compra y a los badges de columna.

/** Reserva liberada por oficina; OT sin cartela asignada. Se puede comprar. */
export const STOP_MATERIAL_LIBERADO =
  "Sin material asignado (liberado)" as const;

/** Oficina ha decidido compra de corrección; aún sin cartela nueva. */
export const STOP_PENDIENTE_CORRECCION =
  "Pendiente compra de corrección" as const;

/** Todos los textos de estado STOP (para guards y badges). */
export const STOP_ESTADOS = [
  STOP_MATERIAL_LIBERADO,
  STOP_PENDIENTE_CORRECCION,
] as const;

export type StopEstadoMaterial = (typeof STOP_ESTADOS)[number];

/**
 * True si el texto corresponde a un estado STOP de material (9.8.x).
 * Usar para guards que necesitan detectar cualquier estado STOP.
 */
export function esEstadoMaterialStop(
  estado: string | null | undefined
): boolean {
  const t = (estado ?? "").trim();
  return (STOP_ESTADOS as readonly string[]).includes(t);
}

/**
 * True si el estado STOP bloquea la propagación de cambios de compra.
 * Ambos STOP bloquean: la OT solo sale del STOP vía asignación (9.8.4)
 * o consumo (9.8.3), nunca por Confirmado/Recibido de una OC.
 */
export function esEstadoMaterialStopBloqueado(
  estado: string | null | undefined
): boolean {
  return esEstadoMaterialStop(estado);
}

// ── Bloque 9.8.1b — Allowlist nueva compra ───────────────────────────────────
// Estados en los que OT SÍ puede arrancar un nuevo flujo de compra.
// Sustituye la heurística frágil includes("sin") de ots-despachadas-page.tsx.
// Normalizado a minúsculas sin acentos (ver normalizeEstadoMaterialParaMatch).

export const PERMITE_NUEVA_COMPRA_NORMALIZED = new Set([
  // vacío → primera vez
  "",
  // legado "sin orden compra"
  "sin orden compra",
  "sin orden",
  // compra cancelada → se puede recomprar
  "compra cancelada",
  // estados STOP 9.8 → oficina ha liberado, debe poder generar nueva compra
  "sin material asignado (liberado)",
  "pendiente compra de correccion", // sin tilde (normalizado NFD)
]);

// ─────────────────────────────────────────────────────────────────────────────

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
