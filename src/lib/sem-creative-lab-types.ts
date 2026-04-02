/** Valor por defecto si Claude no puede determinar un campo (nunca vacío). */
export const SEM_CREATIVE_LAB_FALLBACK = "standard pharmaceutical packaging";

export const FORMAT_ESTUCHE = "Estuche de cartón rectangular" as const;
export const FORMAT_FARMACIA = "Caja de farmacia" as const;

export type PackagingFormatAllowed =
  | typeof FORMAT_ESTUCHE
  | typeof FORMAT_FARMACIA;

export type PackagingAnalysis = {
  product_name: string;
  /** Colores dominantes (lista). */
  main_colors: string[];
  /** Descripción técnica de tonos / degradados. */
  exact_colors: string;
  /** Elementos visuales (lista). */
  key_elements: string[];
  /** Solo uno de los dos valores permitidos (nunca botella). */
  format: PackagingFormatAllowed;
  /** Caras del troquel (frontal / lateral / etc.). */
  die_cut_faces: string;
};

function isStringArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim().length > 0)
  );
}

export function isPackagingAnalysis(v: unknown): v is PackagingAnalysis {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.product_name !== "string") return false;
  if (!isStringArray(o.main_colors)) return false;
  if (!isStringArray(o.key_elements)) return false;
  if (typeof o.exact_colors !== "string") return false;
  if (typeof o.format !== "string") return false;
  if (o.format !== FORMAT_ESTUCHE && o.format !== FORMAT_FARMACIA) return false;
  if (typeof o.die_cut_faces !== "string") return false;
  return true;
}

function coerceStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    const arr = v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    if (arr.length) return arr;
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [SEM_CREATIVE_LAB_FALLBACK];
}

function normalizeFormat(raw: string): PackagingFormatAllowed {
  const t = raw.trim();
  if (t === FORMAT_ESTUCHE || t === FORMAT_FARMACIA) return t;
  const lower = t.toLowerCase();
  if (lower.includes("botella") || lower.includes("bottle")) return FORMAT_ESTUCHE;
  if (lower.includes("farmacia") || lower.includes("pharmacy"))
    return FORMAT_FARMACIA;
  if (
    lower.includes("estuche") ||
    lower.includes("cartón") ||
    lower.includes("carton") ||
    lower.includes("caja")
  )
    return FORMAT_ESTUCHE;
  if (t.length === 0 || t === SEM_CREATIVE_LAB_FALLBACK) return FORMAT_ESTUCHE;
  return FORMAT_ESTUCHE;
}

function nonemptyString(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

/**
 * Convierte la respuesta del modelo en un objeto siempre completo (sin undefined),
 * con listas y strings rellenados según el esquema del laboratorio.
 */
export function normalizeSemCreativeLabAnalysis(raw: unknown): PackagingAnalysis {
  const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const product_name = nonemptyString(o.product_name, SEM_CREATIVE_LAB_FALLBACK);
  let main_colors = coerceStringArray(o.main_colors);
  const exact_colors = nonemptyString(o.exact_colors, SEM_CREATIVE_LAB_FALLBACK);
  let key_elements = coerceStringArray(o.key_elements);
  const format = normalizeFormat(
    typeof o.format === "string" ? o.format : SEM_CREATIVE_LAB_FALLBACK
  );
  const die_cut_faces = nonemptyString(o.die_cut_faces, SEM_CREATIVE_LAB_FALLBACK);

  main_colors = main_colors.map((s) => s || SEM_CREATIVE_LAB_FALLBACK);
  key_elements = key_elements.map((s) => s || SEM_CREATIVE_LAB_FALLBACK);

  return {
    product_name,
    main_colors,
    exact_colors,
    key_elements,
    format,
    die_cut_faces,
  };
}
