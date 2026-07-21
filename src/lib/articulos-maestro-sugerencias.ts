import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProdReferenciaRow } from "@/types/prod-referencias";
import type { DespachoItinerarioSlot } from "@/components/produccion/ots/despacho-itinerario-picker";

/** Campos del maestro que la Fase 2 puede rellenar desde el despacho. */
export type SugerenciasTecnicasMaestro = {
  material_habitual: string | null;
  gramaje_habitual: number | null;
  poses_habitual: number | null;
  troquel_habitual: string | null;
  tintas_habituales: string | null;
  acabado_habitual: string | null;
  tipo_engomado_habitual: string | null;
  caja_embalaje_habitual: string | null;
  unidades_por_embalaje_habitual: number | null;
  ruta_habitual: string | null;
};

export type DespachoSugerenciasSource = {
  material?: string | null;
  gramaje?: string | null;
  poses?: string | number | null;
  troquel?: string | null;
  tintas?: string | null;
  acabado_pral?: string | null;
  tipo_engomado?: string | null;
  codigo_caja_embalaje?: string | null;
  unidades_por_embalaje?: string | null;
  itinerarioSlots?: DespachoItinerarioSlot[];
};

const MAESTRO_SUGERENCIA_KEYS = [
  "material_habitual",
  "gramaje_habitual",
  "poses_habitual",
  "troquel_habitual",
  "tintas_habituales",
  "acabado_habitual",
  "tipo_engomado_habitual",
  "caja_embalaje_habitual",
  "unidades_por_embalaje_habitual",
  "ruta_habitual",
] as const satisfies readonly (keyof SugerenciasTecnicasMaestro)[];

export type MaestroSugerenciaKey = (typeof MAESTRO_SUGERENCIA_KEYS)[number];

export type SugerenciaFieldDiff = {
  key: MaestroSugerenciaKey;
  label: string;
  proposed: string;
  current: string | null;
  /** Maestro vacío → se puede rellenar sin confirmación. */
  isEmpty: boolean;
  /** Valor distinto al propuesto → requiere confirmación para sobrescribir. */
  conflicts: boolean;
};

const FIELD_LABELS: Record<MaestroSugerenciaKey, string> = {
  material_habitual: "Material",
  gramaje_habitual: "Gramaje",
  poses_habitual: "Poses",
  troquel_habitual: "Troquel",
  tintas_habituales: "Tintas",
  acabado_habitual: "Acabado",
  tipo_engomado_habitual: "Tipo engomado",
  caja_embalaje_habitual: "Caja embalaje",
  unidades_por_embalaje_habitual: "Uds/caja",
  ruta_habitual: "Ruta",
};

const NUMERIC_KEYS = new Set<MaestroSugerenciaKey>([
  "gramaje_habitual",
  "poses_habitual",
  "unidades_por_embalaje_habitual",
]);

function cleanStr(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function parsePositiveInt(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

function parsePositiveNum(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Serializa itinerario del wizard a texto para ruta_habitual (ej: "CTP+Impresión Offset+Troquelado"). */
export function serializeRutaHabitual(slots: DespachoItinerarioSlot[]): string | null {
  if (!slots || slots.length === 0) return null;
  return slots.map((s) => s.nombre).join("+") || null;
}

function formatProposed(key: MaestroSugerenciaKey, value: string | number | null): string {
  if (value == null) return "";
  return String(value).trim();
}

function currentMaestroValue(
  row: Pick<ProdReferenciaRow, MaestroSugerenciaKey>,
  key: MaestroSugerenciaKey
): string | null {
  const v = row[key];
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  const s = String(v).trim();
  return s || null;
}

/** Mapea campos del formulario de despacho → columnas habituales del maestro. */
export function buildSugerenciasFromDespacho(
  source: DespachoSugerenciasSource
): SugerenciasTecnicasMaestro {
  return {
    material_habitual: cleanStr(source.material),
    gramaje_habitual: parsePositiveNum(source.gramaje ?? null),
    poses_habitual: parsePositiveInt(source.poses),
    troquel_habitual: cleanStr(source.troquel),
    tintas_habituales: cleanStr(source.tintas),
    acabado_habitual: cleanStr(source.acabado_pral),
    tipo_engomado_habitual: cleanStr(source.tipo_engomado),
    caja_embalaje_habitual: cleanStr(source.codigo_caja_embalaje),
    unidades_por_embalaje_habitual: parsePositiveInt(source.unidades_por_embalaje),
    ruta_habitual: source.itinerarioSlots
      ? serializeRutaHabitual(source.itinerarioSlots)
      : null,
  };
}

/** Resumen legible para el bloque UI (p. ej. "Zenith 300g · 4 poses · TAG00205"). */
export function formatSugerenciasResumen(
  sugerencias: SugerenciasTecnicasMaestro
): string {
  const parts: string[] = [];
  if (sugerencias.material_habitual) {
    let mat = sugerencias.material_habitual;
    if (sugerencias.gramaje_habitual != null) mat += ` ${sugerencias.gramaje_habitual}g`;
    parts.push(mat);
  }
  if (sugerencias.poses_habitual != null)
    parts.push(`${sugerencias.poses_habitual} poses`);
  if (sugerencias.troquel_habitual) parts.push(sugerencias.troquel_habitual);
  if (sugerencias.tintas_habituales) parts.push(sugerencias.tintas_habituales);
  if (sugerencias.acabado_habitual) parts.push(sugerencias.acabado_habitual);
  if (sugerencias.tipo_engomado_habitual)
    parts.push(sugerencias.tipo_engomado_habitual);
  if (sugerencias.caja_embalaje_habitual) {
    let emb = sugerencias.caja_embalaje_habitual;
    if (sugerencias.unidades_por_embalaje_habitual != null)
      emb += ` · ${sugerencias.unidades_por_embalaje_habitual} uds`;
    parts.push(emb);
  }
  if (sugerencias.ruta_habitual) parts.push(`Ruta: ${sugerencias.ruta_habitual}`);
  return parts.join(" · ");
}

export function hasAnySugerencia(sugerencias: SugerenciasTecnicasMaestro): boolean {
  return MAESTRO_SUGERENCIA_KEYS.some((k) => {
    const v = sugerencias[k];
    return v != null && String(v).trim() !== "";
  });
}

/** Compara propuesta vs fila actual del maestro. */
export function diffSugerenciasVsMaestro(
  proposed: SugerenciasTecnicasMaestro,
  current: Pick<ProdReferenciaRow, MaestroSugerenciaKey>
): SugerenciaFieldDiff[] {
  const out: SugerenciaFieldDiff[] = [];
  for (const key of MAESTRO_SUGERENCIA_KEYS) {
    const propRaw = proposed[key];
    const propStr = formatProposed(key, propRaw);
    if (!propStr) continue;
    const cur = currentMaestroValue(current, key);
    const isEmpty = cur == null;
    const conflicts = !isEmpty && cur !== propStr;
    out.push({
      key,
      label: FIELD_LABELS[key],
      proposed: propStr,
      current: cur,
      isEmpty,
      conflicts,
    });
  }
  return out;
}

export type UpsertSugerenciasMode = "vacios" | "sobreescribir";

export type UpsertSugerenciasResult = {
  updatedKeys: MaestroSugerenciaKey[];
  skippedKeys: MaestroSugerenciaKey[];
};

const SELECT_SUGERENCIAS_COLS = [
  "id",
  "material_habitual",
  "gramaje_habitual",
  "poses_habitual",
  "troquel_habitual",
  "tintas_habituales",
  "acabado_habitual",
  "tipo_engomado_habitual",
  "caja_embalaje_habitual",
  "unidades_por_embalaje_habitual",
  "ruta_habitual",
].join(", ");

/**
 * Escribe sugerencias técnicas en `prod_referencias`.
 * - `vacios`: solo columnas vacías en el maestro.
 * - `sobreescribir`: pisa también las que ya tienen valor distinto.
 */
export async function upsertSugerenciasTecnicas(
  supabase: SupabaseClient,
  referenciaId: string,
  proposed: SugerenciasTecnicasMaestro,
  mode: UpsertSugerenciasMode
): Promise<UpsertSugerenciasResult> {
  const { data, error } = await supabase
    .from("prod_referencias")
    .select(SELECT_SUGERENCIAS_COLS)
    .eq("id", referenciaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Referencia no encontrada en el maestro.");

  const row = data as unknown as Pick<ProdReferenciaRow, MaestroSugerenciaKey | "id">;
  const diffs = diffSugerenciasVsMaestro(proposed, row);
  const patch: Record<string, string | number | null> = {};
  const updatedKeys: MaestroSugerenciaKey[] = [];
  const skippedKeys: MaestroSugerenciaKey[] = [];

  for (const d of diffs) {
    if (d.isEmpty || (mode === "sobreescribir" && d.conflicts)) {
      if (NUMERIC_KEYS.has(d.key)) {
        patch[d.key] = Number(d.proposed);
      } else {
        patch[d.key] = d.proposed;
      }
      updatedKeys.push(d.key);
    } else if (d.conflicts && mode === "vacios") {
      skippedKeys.push(d.key);
    }
  }

  if (updatedKeys.length === 0) {
    return { updatedKeys, skippedKeys };
  }

  const { error: updErr } = await supabase
    .from("prod_referencias")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", referenciaId);
  if (updErr) throw updErr;

  return { updatedKeys, skippedKeys };
}
