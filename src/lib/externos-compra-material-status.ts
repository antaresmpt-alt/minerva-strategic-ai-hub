import type { SupabaseClient } from "@supabase/supabase-js";

import { formatFechaEsCorta } from "@/lib/produccion-date-format";

const TBL_COMPRA = "prod_compra_material";
const CHUNK = 120;

/** Semáforo columna M según `prod_compra_material` (Gestión de Externos). */
export type MaterialCompraSemaforo = "gris" | "azul" | "amarillo" | "verde";

export type OtCompraMaterialInfo = {
  semaforo: MaterialCompraSemaforo;
  tooltip: string;
};

const TOOLTIP_GRIS = "Sin pedido de material";

/** Trim + string. */
export function normOtKey(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).trim();
}

/**
 * Clave para cruce con `ot_numero`: solo dígitos (p. ej. `OT-34500` → `34500`).
 * Si no hay dígitos, se usa el texto recortado.
 */
export function canonicalOtKey(s: string | null | undefined): string {
  const t = normOtKey(s);
  if (!t) return "";
  const digits = t.replace(/\D/g, "");
  return digits.length > 0 ? digits : t;
}

/** `ot_numero` desde PostgREST → string estable para `canonicalOtKey`. */
function otNumeroToString(ot: string | number | null | undefined): string {
  if (ot == null) return "";
  if (typeof ot === "number" && Number.isFinite(ot)) {
    return String(Math.trunc(ot));
  }
  return String(ot).trim();
}

/**
 * Busca el estado aunque `getOtDisplay` sea `OT-34500` y el mapa use `34500`.
 */
export function lookupCompraMaterialStatus(
  map: Map<string, OtCompraMaterialInfo>,
  otDisplay: string
): OtCompraMaterialInfo | undefined {
  const c = canonicalOtKey(otDisplay);
  if (c && map.has(c)) return map.get(c);
  const t = normOtKey(otDisplay);
  if (t && map.has(t)) return map.get(t);
  return undefined;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Valores para `.in("ot_numero", …)`: clave canónica (dígitos), número si aplica.
 */
function buildOtNumeroInValues(uniqueCanonicalKeys: string[]): (string | number)[] {
  const seen = new Set<string>();
  const out: (string | number)[] = [];
  const push = (v: string | number) => {
    const dedupKey =
      typeof v === "number" ? `n:${v}` : `s:${normOtKey(String(v))}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    out.push(v);
  };
  for (const raw of uniqueCanonicalKeys) {
    const t = normOtKey(raw);
    if (!t) continue;
    push(t);
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isFinite(n)) push(n);
    }
  }
  return out;
}

type CompraEstadoRow = {
  ot_numero: string | number | null;
  estado: string | null;
  fecha_prevista_recepcion: string | null;
  proveedor_id: string | null;
};

function normEstado(estado: string | null | undefined): string {
  return (estado ?? "").trim().toLowerCase();
}

function proveedorNombre(
  proveedorId: string | null | undefined,
  proveedorNombreById: Map<string, string> | undefined
): string {
  if (!proveedorId || !proveedorNombreById) return "—";
  const n = proveedorNombreById.get(proveedorId);
  return n != null && n.trim() !== "" ? n.trim() : "—";
}

/** Prioridad al fusionar varias filas por OT: la fase más avanzada gana. */
function rankEstado(estado: string | null): number {
  const n = normEstado(estado);
  if (n === "recepcionada" || n === "recibido") return 5;
  if (n === "recibido parcial") return 4;
  if (n === "confirmada" || n === "confirmado") return 3;
  if (n === "generada") return 2;
  if (n === "pendiente") return 1;
  if (n === "cancelado") return 0;
  return 0;
}

function infoFromRow(
  row: CompraEstadoRow,
  proveedorNombreById: Map<string, string> | undefined
): OtCompraMaterialInfo {
  const raw = (row.estado ?? "").trim();
  const n = normEstado(row.estado);

  if (!raw) {
    return { semaforo: "gris", tooltip: TOOLTIP_GRIS };
  }
  if (n === "pendiente") {
    return { semaforo: "gris", tooltip: TOOLTIP_GRIS };
  }
  if (n === "generada") {
    const nombre = proveedorNombre(row.proveedor_id, proveedorNombreById);
    return {
      semaforo: "azul",
      tooltip: `Pedido a ${nombre}`,
    };
  }
  if (n === "confirmada" || n === "confirmado") {
    const fp = formatFechaEsCorta(row.fecha_prevista_recepcion);
    return {
      semaforo: "amarillo",
      tooltip: `Confirmado para el ${fp}`,
    };
  }
  if (n === "recibido parcial") {
    return {
      semaforo: "amarillo",
      tooltip: "Recepción parcial de material",
    };
  }
  if (n === "recepcionada" || n === "recibido") {
    return {
      semaforo: "verde",
      tooltip: "Material en planta",
    };
  }
  if (n === "cancelado") {
    return {
      semaforo: "gris",
      tooltip: "Compra cancelada",
    };
  }
  return { semaforo: "gris", tooltip: TOOLTIP_GRIS };
}

function bestInfoFromRows(
  rows: CompraEstadoRow[],
  proveedorNombreById: Map<string, string> | undefined
): OtCompraMaterialInfo {
  if (rows.length === 0) {
    return { semaforo: "gris", tooltip: TOOLTIP_GRIS };
  }
  let best = rows[0];
  let bestRank = rankEstado(best.estado);
  for (let i = 1; i < rows.length; i++) {
    const r = rankEstado(rows[i].estado);
    if (r > bestRank) {
      bestRank = r;
      best = rows[i];
    }
  }
  return infoFromRow(best, proveedorNombreById);
}

function mapGrisForKeys(keys: string[]): Map<string, OtCompraMaterialInfo> {
  const out = new Map<string, OtCompraMaterialInfo>();
  for (const k of keys) {
    out.set(k, { semaforo: "gris", tooltip: TOOLTIP_GRIS });
  }
  return out;
}

/**
 * Estado del semáforo M por OT según `prod_compra_material` (ot_numero).
 * `proveedorNombreById` se usa para el tooltip «Pedido a …» (misma carga que proveedores en Gestión de Externos).
 */
export async function fetchCompraMaterialStatusByOt(
  supabase: SupabaseClient,
  otDisplayKeys: string[],
  proveedorNombreById?: Map<string, string>
): Promise<Map<string, OtCompraMaterialInfo>> {
  const uniqueCanonical = [
    ...new Set(
      otDisplayKeys
        .map((s) => canonicalOtKey(s))
        .filter((s) => s.length > 0)
    ),
  ];

  const fallbackAllGris = () => mapGrisForKeys(uniqueCanonical);

  try {
    if (uniqueCanonical.length === 0) {
      return new Map();
    }

    const inValues = buildOtNumeroInValues(uniqueCanonical);
    if (inValues.length === 0) {
      return fallbackAllGris();
    }

    const allCompras: CompraEstadoRow[] = [];
    for (const part of chunkArray(inValues, CHUNK)) {
      const { data, error } = await supabase
        .from(TBL_COMPRA)
        .select("ot_numero, estado, fecha_prevista_recepcion, proveedor_id")
        .in("ot_numero", part);

      if (error) {
        return fallbackAllGris();
      }
      if (data?.length) {
        allCompras.push(...(data as CompraEstadoRow[]));
      }
    }

    const byOt = new Map<string, CompraEstadoRow[]>();
    for (const r of allCompras) {
      const key = canonicalOtKey(otNumeroToString(r.ot_numero));
      if (!key) continue;
      if (!byOt.has(key)) byOt.set(key, []);
      byOt.get(key)!.push(r);
    }

    const out = fallbackAllGris();

    for (const otKey of uniqueCanonical) {
      const list = byOt.get(otKey) ?? [];
      out.set(otKey, bestInfoFromRows(list, proveedorNombreById));
    }

    return out;
  } catch {
    return fallbackAllGris();
  }
}

/** Fallback de tooltip cuando aún no hay fila resuelta (p. ej. loading). */
export const MATERIAL_COMPRA_TOOLTIP_FALLBACK = {
  gris: TOOLTIP_GRIS,
} as const;

/** Clase Tailwind para el punto (columna M e impresión). */
export function compraSemaforoToBgClass(
  sem: MaterialCompraSemaforo | undefined
): string {
  switch (sem) {
    case "verde":
      return "bg-emerald-500";
    case "amarillo":
      return "bg-amber-400";
    case "azul":
      return "bg-blue-500";
    default:
      return "bg-slate-300";
  }
}
