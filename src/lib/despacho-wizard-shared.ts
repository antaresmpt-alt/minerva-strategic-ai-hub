/** Tipos y helpers compartidos del wizard de despacho OT. */

export const TABLE_OT_DESPACHADAS = "produccion_ot_despachadas";
export const TABLE_OT_PASOS = "prod_ot_pasos";
export const TABLE_OTS = "prod_ots_general";
export const TABLE_COMPRA = "prod_compra_material";

export type DespachoSeleccion = { id: string; num_pedido: string };

export type DespachoMeta = {
  cliente: string;
  trabajo: string;
  cantidad: string;
  pedido_cliente: string;
  fecha_entrega: string;
};

export type DespachoCatalogItem = {
  id: string;
  tipo: "material" | "acabado_pral" | "tipo_engomado";
  label: string;
};

export type ReferenciaHistorialRow = {
  ot_numero: string;
  despachado_at: string | null;
  material: string | null;
  gramaje: number | null;
  tamano_hoja: string | null;
  troquel: string | null;
  poses: number | null;
  acabado_pral: string | null;
};

export type DespachoFormState = {
  tintas: string;
  material: string;
  tamano_hoja: string;
  gramaje: string;
  num_hojas_brutas: string;
  num_hojas_netas: string;
  horas_entrada: string;
  horas_tiraje: string;
  horas_estimadas_troquelado: string;
  horas_estimadas_engomado: string;
  tipo_engomado: string;
  troquel: string;
  poses: string;
  acabado_pral: string;
  notas: string;
  referencia_id: string | null;
  referencia_codigo: string;
  ot_anterior_numero: string;
  ot_anterior_id: string | null;
};

export type DespachoWizardTab =
  | "cabecera"
  | "material"
  | "itinerario"
  | "produccion"
  | "resumen";

export const DESPACHO_WIZARD_TABS: {
  id: DespachoWizardTab;
  label: string;
}[] = [
  { id: "cabecera", label: "Cabecera" },
  { id: "material", label: "Material" },
  { id: "itinerario", label: "Itinerario" },
  { id: "produccion", label: "Producción" },
  { id: "resumen", label: "Resumen" },
];

export function emptyDespachoMeta(): DespachoMeta {
  return {
    cliente: "",
    trabajo: "",
    cantidad: "",
    pedido_cliente: "",
    fecha_entrega: "",
  };
}

export function emptyDespachoForm(): DespachoFormState {
  return {
    tintas: "",
    material: "",
    tamano_hoja: "",
    gramaje: "",
    num_hojas_brutas: "",
    num_hojas_netas: "",
    horas_entrada: "",
    horas_tiraje: "",
    horas_estimadas_troquelado: "",
    horas_estimadas_engomado: "",
    tipo_engomado: "",
    troquel: "",
    poses: "",
    acabado_pral: "",
    notas: "",
    referencia_id: null,
    referencia_codigo: "",
    ot_anterior_numero: "",
    ot_anterior_id: null,
  };
}

export const DESPACHO_CLONE_FIELDS = [
  "tintas",
  "material",
  "tamano_hoja",
  "gramaje",
  "troquel",
  "poses",
  "acabado_pral",
  "tipo_engomado",
  "notas",
] as const;

export const DESPACHO_CLONE_SELECT =
  "tintas, material, tamano_hoja, gramaje, troquel, poses, acabado_pral, tipo_engomado, notas, despachado_at";

export function applyClonePrefill(
  form: DespachoFormState,
  source: Record<string, unknown>
): { next: DespachoFormState; filled: number } {
  const next = { ...form };
  let filled = 0;
  for (const field of DESPACHO_CLONE_FIELDS) {
    const current = String(next[field] ?? "").trim();
    if (current) continue;
    const raw = source[field];
    if (raw == null) continue;
    const valueStr = String(raw).trim();
    if (!valueStr) continue;
    next[field] = valueStr;
    filled += 1;
  }
  return { next, filled };
}

export function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function numberOrZeroForDespacho(s: string): number {
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function integerOrZeroForDespacho(s: string): number {
  return Math.trunc(numberOrZeroForDespacho(s));
}

export function formatFechaEntregaCorta(
  value: string | null | undefined
): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseReferenciaClienteFromTitulo(
  titulo: string | null | undefined
): string {
  const match = String(titulo ?? "")
    .trim()
    .match(/^([A-Z]{1,6}\d{1,8})\s*[-–—]\s+/i);
  return match?.[1]?.trim().toUpperCase() ?? "";
}

export function parseDescripcionReferenciaFromTitulo(
  titulo: string | null | undefined
): string {
  return String(titulo ?? "")
    .trim()
    .replace(/^[A-Z]{1,6}\d{1,8}\s*[-–—]\s+/i, "")
    .trim();
}

/** IDs de procesos externos en prod_procesos_cat. */
export const PROCESO_EXTERNO_IDS = new Set([
  3, 4, 5, 6, 7, 8, 9, 11, 13, 14, 21,
]);

export const PROCESO_CTP_ID = 16;
export const PROCESO_GUILLOTINA_ID = 17;
export const PROCESO_OFFSET_ID = 1;
export const PROCESO_DIGITAL_ID = 2;
export const PROCESO_TROQUEL_ID = 10;
export const PROCESO_ENGOMADO_ID = 12;
export const PROCESO_MANIPULADOS_ID = 15;
export const PROCESO_DESBROCE_ID = 22;
