export type OptimusExtractionMode = "rules" | "ai";

export type OptimusRegexRules = {
  referenciaPatterns: string[];
  proveedorPatterns: string[];
  acabadoPatterns: string[];
  unidadesPatterns: string[];
  fechaEnvioPatterns: string[];
  fechaPrevistaPatterns: string[];
  proveedorAliases: Record<string, string>;
  acabadoAliases: Record<string, string>;
  autoMatchThreshold: number;
};

export const DEFAULT_OPTIMUS_REGEX_RULES: OptimusRegexRules = {
  referenciaPatterns: [
    "O\\/T\\s*:\\s*([0-9\\/\\s-]{5,})",
    "Refer[eè]ncia\\s*:\\s*([0-9\\/\\s-]{5,})",
    "NUESTRA\\s+OT\\s*([0-9]{5,7})",
    "Nuestra\\s+OT\\s*([0-9]{5,7})",
  ],
  proveedorPatterns: ["^\\s*([A-Z0-9 ,.'-]{3,})\\s*$"],
  acabadoPatterns: [
    "Plastificado\\s+[A-Za-záéíóúñü\\s]+",
    "Contracolad[oa]",
    "Forrar\\s+caja[^\\n]*",
  ],
  unidadesPatterns: ["([0-9]{1,3}(?:\\.[0-9]{3})+|[0-9]{2,})\\s*unidades?"],
  fechaEnvioPatterns: ["Data\\s*:\\s*([0-9]{1,2}[\\/\\-.][A-Za-z0-9]{2,4}[\\/\\-.][0-9]{2,4})"],
  fechaPrevistaPatterns: [
    "Data\\s+entrega[^\\n]*?([0-9]{1,2}[\\/\\-.][A-Za-z0-9]{2,4}[\\/\\-.][0-9]{2,4})",
  ],
  proveedorAliases: {
    "plastificados llobregat": "llobregat",
    "plastificados del llobregat": "llobregat",
    soldaplastic: "soldaplastic",
  },
  acabadoAliases: {
    "plastificado polipropileno brillo": "pp brillo",
    "plastificado polipropileno mate": "pp mate",
    contracolado: "contracolado",
    "forrar caja": "forrar caja",
  },
  autoMatchThreshold: 0.7,
};

export function clampAutoMatchThreshold(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_OPTIMUS_REGEX_RULES.autoMatchThreshold;
  return Math.max(0, Math.min(1, v));
}

export function safeParseOptimusRegexRules(raw: string | null | undefined): OptimusRegexRules {
  if (!raw || !raw.trim()) return { ...DEFAULT_OPTIMUS_REGEX_RULES };
  try {
    const j = JSON.parse(raw) as Partial<OptimusRegexRules>;
    return {
      referenciaPatterns: Array.isArray(j.referenciaPatterns)
        ? j.referenciaPatterns.filter((x): x is string => typeof x === "string")
        : [...DEFAULT_OPTIMUS_REGEX_RULES.referenciaPatterns],
      proveedorPatterns: Array.isArray(j.proveedorPatterns)
        ? j.proveedorPatterns.filter((x): x is string => typeof x === "string")
        : [...DEFAULT_OPTIMUS_REGEX_RULES.proveedorPatterns],
      acabadoPatterns: Array.isArray(j.acabadoPatterns)
        ? j.acabadoPatterns.filter((x): x is string => typeof x === "string")
        : [...DEFAULT_OPTIMUS_REGEX_RULES.acabadoPatterns],
      unidadesPatterns: Array.isArray(j.unidadesPatterns)
        ? j.unidadesPatterns.filter((x): x is string => typeof x === "string")
        : [...DEFAULT_OPTIMUS_REGEX_RULES.unidadesPatterns],
      fechaEnvioPatterns: Array.isArray(j.fechaEnvioPatterns)
        ? j.fechaEnvioPatterns.filter((x): x is string => typeof x === "string")
        : [...DEFAULT_OPTIMUS_REGEX_RULES.fechaEnvioPatterns],
      fechaPrevistaPatterns: Array.isArray(j.fechaPrevistaPatterns)
        ? j.fechaPrevistaPatterns.filter((x): x is string => typeof x === "string")
        : [...DEFAULT_OPTIMUS_REGEX_RULES.fechaPrevistaPatterns],
      proveedorAliases:
        j.proveedorAliases && typeof j.proveedorAliases === "object"
          ? (j.proveedorAliases as Record<string, string>)
          : { ...DEFAULT_OPTIMUS_REGEX_RULES.proveedorAliases },
      acabadoAliases:
        j.acabadoAliases && typeof j.acabadoAliases === "object"
          ? (j.acabadoAliases as Record<string, string>)
          : { ...DEFAULT_OPTIMUS_REGEX_RULES.acabadoAliases },
      autoMatchThreshold: clampAutoMatchThreshold(
        Number(j.autoMatchThreshold ?? DEFAULT_OPTIMUS_REGEX_RULES.autoMatchThreshold)
      ),
    };
  } catch {
    return { ...DEFAULT_OPTIMUS_REGEX_RULES };
  }
}

