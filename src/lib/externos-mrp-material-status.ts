import type { SupabaseClient } from "@supabase/supabase-js";

const TBL_RESERVAS = "almacen_reservas";
const CHUNK = 120;

export type MaterialMrpSemaforo = "verde" | "amarillo" | "gris";

export type OtMaterialMrpInfo = {
  semaforo: MaterialMrpSemaforo;
  tooltip: string;
};

const TOOLTIP: Record<MaterialMrpSemaforo, string> = {
  verde: "Material consumido (Trabajo impreso)",
  amarillo: "Material pendiente de impresión (o en tránsito)",
  gris: "Sin reserva en MRP",
};

/** Trim + string. */
export function normOtKey(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).trim();
}

/**
 * Clave para cruce con `ot_num`: solo dígitos (p. ej. `OT-34500` → `34500`).
 * Si no hay dígitos, se usa el texto recortado.
 */
export function canonicalOtKey(s: string | null | undefined): string {
  const t = normOtKey(s);
  if (!t) return "";
  const digits = t.replace(/\D/g, "");
  return digits.length > 0 ? digits : t;
}

/** `ot_num` desde PostgREST (número o texto) → string estable para `canonicalOtKey`. */
function otNumToString(ot: string | number | null | undefined): string {
  if (ot == null) return "";
  if (typeof ot === "number" && Number.isFinite(ot)) {
    return String(Math.trunc(ot));
  }
  return String(ot).trim();
}

/**
 * Busca el estado MRP aunque `getOtDisplay` sea `OT-34500` y el mapa use `34500`.
 */
export function lookupMrpStatus(
  map: Map<string, OtMaterialMrpInfo>,
  otDisplay: string
): OtMaterialMrpInfo | undefined {
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
 * Valores para `.in("ot_num", …)`: clave canónica (dígitos), número si aplica.
 */
function buildOtNumInValues(uniqueCanonicalKeys: string[]): (string | number)[] {
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

type ReservaEstadoRow = {
  ot_num: string | number | null;
  estado: string | null;
};

function semaforoFromEstados(rows: ReservaEstadoRow[]): MaterialMrpSemaforo {
  const active = rows.filter((r) => normOtKey(r.estado) !== "Cancelado");
  if (active.length === 0) {
    return "gris";
  }
  if (active.some((r) => normOtKey(r.estado) === "Pendiente")) {
    return "amarillo";
  }
  if (active.every((r) => normOtKey(r.estado) === "Consumido")) {
    return "verde";
  }
  return "amarillo";
}

function mapGrisForKeys(keys: string[]): Map<string, OtMaterialMrpInfo> {
  const out = new Map<string, OtMaterialMrpInfo>();
  for (const k of keys) {
    out.set(k, { semaforo: "gris", tooltip: TOOLTIP.gris });
  }
  return out;
}

/**
 * Estado del semáforo M por OT según `almacen_reservas` únicamente.
 */
export async function fetchMrpMaterialStatusByOt(
  supabase: SupabaseClient,
  otDisplayKeys: string[]
): Promise<Map<string, OtMaterialMrpInfo>> {
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

    const inValues = buildOtNumInValues(uniqueCanonical);
    if (inValues.length === 0) {
      return fallbackAllGris();
    }

    const allReservas: ReservaEstadoRow[] = [];
    for (const part of chunkArray(inValues, CHUNK)) {
      const { data, error } = await supabase
        .from(TBL_RESERVAS)
        .select("ot_num, estado")
        .in("ot_num", part);

      if (error) {
        return fallbackAllGris();
      }
      if (data?.length) {
        allReservas.push(...(data as ReservaEstadoRow[]));
      }
    }

    const byOt = new Map<string, ReservaEstadoRow[]>();
    for (const r of allReservas) {
      const key = canonicalOtKey(otNumToString(r.ot_num));
      if (!key) continue;
      if (!byOt.has(key)) byOt.set(key, []);
      byOt.get(key)!.push(r);
    }

    const out = fallbackAllGris();

    for (const otKey of uniqueCanonical) {
      const list = byOt.get(otKey) ?? [];
      const sem = semaforoFromEstados(list);
      out.set(otKey, { semaforo: sem, tooltip: TOOLTIP[sem] });
    }

    return out;
  } catch {
    return fallbackAllGris();
  }
}

export { TOOLTIP as MATERIAL_MRP_TOOLTIP_MESSAGES };
