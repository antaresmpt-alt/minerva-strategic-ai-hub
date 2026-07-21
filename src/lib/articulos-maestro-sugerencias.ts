import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProdReferenciaRow,
  DefaultsProcesoMaestro,
  DefaultsProcesoCtpMaestro,
  DefaultsProcesoGuillotinaMaestro,
  DefaultsProcesoExternoMaestro,
} from "@/types/prod-referencias";
import type { DespachoItinerarioSlot } from "@/components/produccion/ots/despacho-itinerario-picker";
import {
  emptyDespachoWizardExternoDatos,
  PROCESO_CTP_ID,
  PROCESO_GUILLOTINA_ID,
  type DespachoFormState,
  type DespachoWizardProcesoDatos,
} from "@/lib/despacho-wizard-shared";
import {
  CTP_REQUISITO_DEFS,
  type DespachoWizardCtpDatos,
} from "@/lib/ctp-despacho";

export type {
  DefaultsProcesoMaestro,
  DefaultsProcesoCtpMaestro,
  DefaultsProcesoGuillotinaMaestro,
  DefaultsProcesoExternoMaestro,
};

// ─── Columnas escalares (Ola 0 + Ola 1) ──────────────────────────────────────

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
  defaultsProcesoUpdated: boolean;
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
  "defaults_proceso",
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
  mode: UpsertSugerenciasMode,
  proposedDefaults?: DefaultsProcesoMaestro | null
): Promise<UpsertSugerenciasResult> {
  const { data, error } = await supabase
    .from("prod_referencias")
    .select(SELECT_SUGERENCIAS_COLS)
    .eq("id", referenciaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Referencia no encontrada en el maestro.");

  const row = data as unknown as Pick<ProdReferenciaRow, MaestroSugerenciaKey | "id" | "defaults_proceso">;
  const diffs = diffSugerenciasVsMaestro(proposed, row);
  const patch: Record<string, unknown> = {};
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

  // Merge defaults_proceso
  let defaultsProcesoUpdated = false;
  if (proposedDefaults && hasAnyDefaultsProceso(proposedDefaults)) {
    const merged = mergeDefaultsProceso(
      row.defaults_proceso ?? null,
      proposedDefaults,
      mode
    );
    patch.defaults_proceso = merged;
    defaultsProcesoUpdated = true;
  }

  if (updatedKeys.length === 0 && !defaultsProcesoUpdated) {
    return { updatedKeys, skippedKeys, defaultsProcesoUpdated: false };
  }

  const { error: updErr } = await supabase
    .from("prod_referencias")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", referenciaId);
  if (updErr) throw updErr;

  return { updatedKeys, skippedKeys, defaultsProcesoUpdated };
}

// ─── Ola 2: defaults_proceso JSONB ────────────────────────────────────────────

/**
 * Extrae los campos estables por artículo de procesoDatos del wizard.
 * Prohibido: hojas_iniciales, hojas_finales, hojas_brutas, hojas_netas, horas_*.
 */
export function buildDefaultsProcesoFromWizard(
  procesoDatos: DespachoWizardProcesoDatos,
  itinerarioSlots: DespachoItinerarioSlot[]
): DefaultsProcesoMaestro {
  const result: DefaultsProcesoMaestro = {};

  // CTP: todos los flags son estables por artículo
  const ctpActive = buildCtpDefaultsFromWizard(procesoDatos.ctp);
  if (ctpActive && Object.keys(ctpActive).length > 0) {
    result.ctp = ctpActive;
  }

  // Guillotina: solo patron_corte y tamano_final (NO hojas_iniciales/finales)
  const { patron_corte, tamano_final } = procesoDatos.guillotina;
  if (patron_corte?.trim() || tamano_final?.trim()) {
    result.guillotina = {
      patron_corte: patron_corte?.trim() || null,
      tamano_final: tamano_final?.trim() || null,
    };
  }

  // Externos: solo acabado fields (NO hojas_brutas/netas)
  const externoIds = Object.keys(procesoDatos.externos);
  if (externoIds.length > 0) {
    const extResult: Record<string, DefaultsProcesoExternoMaestro> = {};
    for (const id of externoIds) {
      const ext = procesoDatos.externos[id];
      if (!ext) continue;
      const { acabado_detalle, acabado_cara, acabado_dorso } = ext;
      if (acabado_detalle?.trim() || acabado_cara?.trim() || acabado_dorso?.trim()) {
        extResult[id] = {
          acabado_detalle: acabado_detalle?.trim() || null,
          acabado_cara: acabado_cara?.trim() || null,
          acabado_dorso: acabado_dorso?.trim() || null,
        };
      }
    }
    if (Object.keys(extResult).length > 0) {
      result.externos = extResult;
    }
  }

  // Validar con el itinerario: solo incluir procesos que están en la ruta
  const procesoIdsEnRuta = new Set(itinerarioSlots.map((s) => s.procesoId));
  return filterDefaultsByItinerario(result, procesoIdsEnRuta);
}

function buildCtpDefaultsFromWizard(
  ctp: DespachoWizardCtpDatos
): DefaultsProcesoCtpMaestro {
  const active: DefaultsProcesoCtpMaestro = {};
  for (const def of CTP_REQUISITO_DEFS) {
    if (ctp[def.hechoKey]) {
      (active as Record<string, boolean>)[def.hechoKey] = true;
    }
  }
  return active;
}

function filterDefaultsByItinerario(
  defaults: DefaultsProcesoMaestro,
  procesoIds: Set<number>
): DefaultsProcesoMaestro {
  const filtered: DefaultsProcesoMaestro = {};
  if (defaults.ctp && procesoIds.has(PROCESO_CTP_ID)) {
    filtered.ctp = defaults.ctp;
  }
  if (defaults.guillotina && procesoIds.has(PROCESO_GUILLOTINA_ID)) {
    filtered.guillotina = defaults.guillotina;
  }
  if (defaults.externos) {
    const extFiltered: Record<string, DefaultsProcesoExternoMaestro> = {};
    for (const [id, val] of Object.entries(defaults.externos)) {
      if (procesoIds.has(Number(id))) {
        extFiltered[id] = val;
      }
    }
    if (Object.keys(extFiltered).length > 0) {
      filtered.externos = extFiltered;
    }
  }
  return filtered;
}

export function hasAnyDefaultsProceso(d: DefaultsProcesoMaestro): boolean {
  if (d.ctp && Object.values(d.ctp).some(Boolean)) return true;
  if (d.guillotina && (d.guillotina.patron_corte || d.guillotina.tamano_final)) return true;
  if (d.externos && Object.keys(d.externos).length > 0) return true;
  return false;
}

/** Resumen legible de defaults_proceso para el bloque UI. */
export function formatDefaultsProcesoResumen(d: DefaultsProcesoMaestro): string {
  const parts: string[] = [];

  if (d.ctp) {
    const active = CTP_REQUISITO_DEFS
      .filter((def) => (d.ctp as Record<string, boolean>)[def.hechoKey])
      .map((def) => def.label);
    if (active.length > 0) parts.push(`CTP: ${active.join(", ")}`);
  }

  if (d.guillotina) {
    const g: string[] = [];
    if (d.guillotina.patron_corte) g.push(d.guillotina.patron_corte);
    if (d.guillotina.tamano_final) g.push(d.guillotina.tamano_final);
    if (g.length > 0) parts.push(`Guillotina: ${g.join(" / ")}`);
  }

  if (d.externos) {
    for (const [, ext] of Object.entries(d.externos)) {
      const ac: string[] = [];
      if (ext.acabado_detalle) ac.push(ext.acabado_detalle);
      if (ext.acabado_cara) ac.push(`cara: ${ext.acabado_cara}`);
      if (ext.acabado_dorso) ac.push(`dorso: ${ext.acabado_dorso}`);
      if (ac.length > 0) parts.push(`Externo: ${ac.join(" · ")}`);
    }
  }

  return parts.join(" · ");
}

/**
 * Merge de defaults_proceso del maestro con los propuestos.
 * - `vacios`: solo actualiza subclaves vacías o nulas.
 * - `sobreescribir`: pisa todo lo propuesto.
 */
function mergeDefaultsProceso(
  current: DefaultsProcesoMaestro | null,
  proposed: DefaultsProcesoMaestro,
  mode: UpsertSugerenciasMode
): DefaultsProcesoMaestro {
  const base: DefaultsProcesoMaestro = current ? structuredClone(current) : {};

  // CTP: merge flag a flag
  if (proposed.ctp && Object.keys(proposed.ctp).length > 0) {
    if (!base.ctp || mode === "sobreescribir") {
      base.ctp = { ...base.ctp, ...proposed.ctp };
    } else {
      const merged: DefaultsProcesoCtpMaestro = { ...base.ctp };
      for (const [k, v] of Object.entries(proposed.ctp)) {
        if (!(k in merged) || merged[k as keyof DefaultsProcesoCtpMaestro] == null) {
          (merged as Record<string, boolean>)[k] = v as boolean;
        }
      }
      base.ctp = merged;
    }
  }

  // Guillotina
  if (proposed.guillotina) {
    if (!base.guillotina || mode === "sobreescribir") {
      base.guillotina = { ...base.guillotina, ...proposed.guillotina };
    } else {
      const mg: DefaultsProcesoGuillotinaMaestro = { ...base.guillotina };
      if (!mg.patron_corte && proposed.guillotina.patron_corte)
        mg.patron_corte = proposed.guillotina.patron_corte;
      if (!mg.tamano_final && proposed.guillotina.tamano_final)
        mg.tamano_final = proposed.guillotina.tamano_final;
      base.guillotina = mg;
    }
  }

  // Externos
  if (proposed.externos) {
    if (!base.externos) base.externos = {};
    for (const [id, ext] of Object.entries(proposed.externos)) {
      if (!base.externos[id] || mode === "sobreescribir") {
        base.externos[id] = { ...base.externos[id], ...ext };
      } else {
        const me: DefaultsProcesoExternoMaestro = { ...base.externos[id] };
        if (!me.acabado_detalle && ext.acabado_detalle) me.acabado_detalle = ext.acabado_detalle;
        if (!me.acabado_cara && ext.acabado_cara) me.acabado_cara = ext.acabado_cara;
        if (!me.acabado_dorso && ext.acabado_dorso) me.acabado_dorso = ext.acabado_dorso;
        base.externos[id] = me;
      }
    }
  }

  return base;
}

// ─── Ola 3: prefill explícito desde maestro (botón "Usar maestro") ───────────
//
// Dirección inversa a la Fase 2: maestro → wizard. Solo rellena campos VACÍOS
// del formulario/procesoDatos actuales (nunca sobrescribe algo ya tecleado).
// El prefill AUTOMÁTICO al elegir referencia sigue siendo "último despacho"
// (handleReferenciaPicked) — esto es solo el botón explícito "Usar maestro".

/** Columnas *_habitual del maestro → campo del formulario de despacho.
 *  `ruta_habitual` queda fuera: aplicarla al itinerario es la Fase 6 (pendiente). */
const FORM_FIELD_FROM_MAESTRO: Partial<Record<MaestroSugerenciaKey, keyof DespachoFormState>> = {
  material_habitual: "material",
  gramaje_habitual: "gramaje",
  poses_habitual: "poses",
  troquel_habitual: "troquel",
  tintas_habituales: "tintas",
  acabado_habitual: "acabado_pral",
  tipo_engomado_habitual: "tipo_engomado",
  caja_embalaje_habitual: "codigo_caja_embalaje",
  unidades_por_embalaje_habitual: "unidades_por_embalaje",
};

export type MaestroPrefillFormPatch = Partial<
  Pick<DespachoFormState, "material" | "gramaje" | "poses" | "troquel" | "tintas" | "acabado_pral" | "tipo_engomado" | "codigo_caja_embalaje" | "unidades_por_embalaje">
>;

/** Construye el patch de campos planos del formulario desde el maestro — solo vacíos. */
export function buildFormPatchFromMaestro(
  maestro: Pick<ProdReferenciaRow, MaestroSugerenciaKey>,
  currentForm: DespachoFormState
): { patch: MaestroPrefillFormPatch; filledLabels: string[]; skippedLabels: string[] } {
  const patch: Record<string, string> = {};
  const filledLabels: string[] = [];
  const skippedLabels: string[] = [];

  for (const key of MAESTRO_SUGERENCIA_KEYS) {
    const formField = FORM_FIELD_FROM_MAESTRO[key];
    if (!formField) continue;
    const maestroVal = currentMaestroValue(maestro, key);
    if (!maestroVal) continue;
    const currentVal = String(currentForm[formField] ?? "").trim();
    if (currentVal) {
      skippedLabels.push(FIELD_LABELS[key]);
      continue;
    }
    patch[formField] = maestroVal;
    filledLabels.push(FIELD_LABELS[key]);
  }

  return { patch: patch as MaestroPrefillFormPatch, filledLabels, skippedLabels };
}

/** Construye el patch de `procesoDatos` (CTP, guillotina, externos) desde `defaults_proceso` — solo vacíos. */
export function buildProcesoDatosPatchFromMaestro(
  defaults: DefaultsProcesoMaestro | null | undefined,
  currentProcesoDatos: DespachoWizardProcesoDatos,
  procesoIdsEnRuta: Set<number>
): { patch: Partial<DespachoWizardProcesoDatos>; filledLabels: string[] } {
  const filledLabels: string[] = [];
  if (!defaults) return { patch: {}, filledLabels };

  const patch: Partial<DespachoWizardProcesoDatos> = {};

  if (defaults.ctp && procesoIdsEnRuta.has(PROCESO_CTP_ID)) {
    const nextCtp = { ...currentProcesoDatos.ctp };
    let changed = false;
    for (const def of CTP_REQUISITO_DEFS) {
      const wants = Boolean((defaults.ctp as Record<string, boolean>)[def.hechoKey]);
      if (wants && !nextCtp[def.hechoKey]) {
        nextCtp[def.hechoKey] = true;
        changed = true;
      }
    }
    if (changed) {
      patch.ctp = nextCtp;
      filledLabels.push("CTP");
    }
  }

  if (defaults.guillotina && procesoIdsEnRuta.has(PROCESO_GUILLOTINA_ID)) {
    const g = currentProcesoDatos.guillotina;
    const nextG = { ...g };
    let changed = false;
    if (!g.patron_corte?.trim() && defaults.guillotina.patron_corte) {
      nextG.patron_corte = defaults.guillotina.patron_corte;
      changed = true;
    }
    if (!g.tamano_final?.trim() && defaults.guillotina.tamano_final) {
      nextG.tamano_final = defaults.guillotina.tamano_final;
      changed = true;
    }
    if (changed) {
      patch.guillotina = nextG;
      filledLabels.push("Guillotina");
    }
  }

  if (defaults.externos) {
    const nextExternos = { ...currentProcesoDatos.externos };
    let changed = false;
    for (const [id, ext] of Object.entries(defaults.externos)) {
      if (!procesoIdsEnRuta.has(Number(id))) continue;
      const current = nextExternos[id] ?? emptyDespachoWizardExternoDatos();
      const hasCurrent = Boolean(
        current.acabado_detalle?.trim() || current.acabado_cara?.trim() || current.acabado_dorso?.trim()
      );
      if (hasCurrent) continue;
      nextExternos[id] = {
        ...current,
        acabado_detalle: ext.acabado_detalle || current.acabado_detalle,
        acabado_cara: ext.acabado_cara || current.acabado_cara,
        acabado_dorso: ext.acabado_dorso || current.acabado_dorso,
      };
      changed = true;
    }
    if (changed) {
      patch.externos = nextExternos;
      filledLabels.push("Acabado externo");
    }
  }

  return { patch, filledLabels };
}

/** Resumen legible tras aplicar "Usar maestro" (ej: "Material, Poses, CTP, Guillotina"). */
export function formatMaestroPrefillResumen(filledLabels: string[]): string {
  if (filledLabels.length === 0) return "";
  return filledLabels.join(", ");
}
