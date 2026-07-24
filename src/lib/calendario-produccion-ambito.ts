/**
 * Ámbito del Calendario Producción (mapa mental por sección).
 * Escritura: admin/gerencia = todos; produccion → solo impresion; roles de sección → el suyo.
 */

import { normalizeDbRole } from "@/lib/permissions";

export const CALENDARIO_AMBITOS = [
  "impresion",
  "digital",
  "troquelado",
  "engomado",
] as const;

export type CalendarioAmbito = (typeof CALENDARIO_AMBITOS)[number];

export function isCalendarioAmbito(v: unknown): v is CalendarioAmbito {
  return typeof v === "string" && (CALENDARIO_AMBITOS as readonly string[]).includes(v);
}

export function parseCalendarioAmbito(
  raw: string | null | undefined,
): CalendarioAmbito | null {
  const t = String(raw ?? "").trim().toLowerCase();
  return isCalendarioAmbito(t) ? t : null;
}

export const CALENDARIO_AMBITO_LABEL: Record<CalendarioAmbito, string> = {
  impresion: "Impresión",
  digital: "Impresión digital",
  troquelado: "Troquelado",
  engomado: "Engomado",
};

/** Letra corta en pastilla. */
export const CALENDARIO_AMBITO_LETRA: Record<CalendarioAmbito, string> = {
  impresion: "I",
  digital: "D",
  troquelado: "T",
  engomado: "E",
};

/** Tinte de pastilla por ámbito (independiente del color de progreso HR). */
export const CALENDARIO_AMBITO_PILL: Record<
  CalendarioAmbito,
  { letraBadge: string; borderTint: string }
> = {
  impresion: {
    letraBadge: "bg-sky-600 text-white",
    borderTint: "ring-1 ring-sky-400/50",
  },
  digital: {
    letraBadge: "bg-violet-700 text-white",
    borderTint: "ring-1 ring-violet-400/40",
  },
  troquelado: {
    letraBadge: "bg-amber-700 text-white",
    borderTint: "ring-1 ring-amber-400/40",
  },
  engomado: {
    letraBadge: "bg-teal-700 text-white",
    borderTint: "ring-1 ring-teal-400/40",
  },
};

/**
 * Ámbito por defecto al abrir el calendario según rol.
 * produccion → impresion (Carlos). admin/gerencia → impresion.
 */
export function defaultCalendarioAmbitoFromRole(
  role: string | null | undefined,
): CalendarioAmbito {
  const r = normalizeDbRole(role ?? null);
  if (r === "digital") return "digital";
  if (r === "troquelado") return "troquelado";
  if (r === "engomado") return "engomado";
  if (r === "impresion") return "impresion";
  // produccion, produccion_ejecucion, admin, gerencia, resto → impresión
  return "impresion";
}

/** ¿Puede crear/mover/borrar pastillas de este ámbito? */
export function canEditCalendarioAmbito(
  role: string | null | undefined,
  ambito: CalendarioAmbito,
): boolean {
  const r = normalizeDbRole(role ?? null);
  if (!r) return false;
  if (r === "admin" || r === "gerencia") return true;
  if (
    r === "produccion" ||
    r === "produccion_ejecucion" ||
    r === "impresion" ||
    r === "almacen" ||
    r === "logistica"
  ) {
    return ambito === "impresion";
  }
  if (r === "digital") return ambito === "digital";
  if (r === "troquelado") return ambito === "troquelado";
  if (r === "engomado") return ambito === "engomado";
  return false;
}

/** ¿Puede ver el calendario (cualquier ámbito)? */
export function canReadCalendarioProduccion(
  role: string | null | undefined,
): boolean {
  const r = normalizeDbRole(role ?? null);
  if (!r) return false;
  return (
    r === "admin" ||
    r === "gerencia" ||
    r === "produccion" ||
    r === "produccion_ejecucion" ||
    r === "impresion" ||
    r === "digital" ||
    r === "troquelado" ||
    r === "engomado" ||
    r === "almacen" ||
    r === "logistica"
  );
}

export function labelCalendarioAmbito(ambito: CalendarioAmbito): string {
  return CALENDARIO_AMBITO_LABEL[ambito];
}

/** Set de ámbitos visibles en la rejilla (checks). */
export type CalendarioAmbitoVisibility = Record<CalendarioAmbito, boolean>;

export function defaultCalendarioAmbitoVisibility(
  preferido: CalendarioAmbito,
): CalendarioAmbitoVisibility {
  return {
    impresion: preferido === "impresion",
    digital: preferido === "digital",
    troquelado: preferido === "troquelado",
    engomado: preferido === "engomado",
  };
}

/** Visibilidad amplia al abrir (todos ON) — útil para gerencia. */
export function allCalendarioAmbitoVisibilityOn(): CalendarioAmbitoVisibility {
  return {
    impresion: true,
    digital: true,
    troquelado: true,
    engomado: true,
  };
}

export function parseCalendarioAmbitoVisibility(
  raw: string | null | undefined,
): CalendarioAmbitoVisibility | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
    const out = allCalendarioAmbitoVisibilityOn();
    for (const a of CALENDARIO_AMBITOS) {
      if (typeof parsed[a] === "boolean") out[a] = parsed[a]!;
    }
    if (!CALENDARIO_AMBITOS.some((a) => out[a])) {
      return null;
    }
    return out;
  } catch {
    return null;
  }
}

export function serializeCalendarioAmbitoVisibility(
  v: CalendarioAmbitoVisibility,
): string {
  return JSON.stringify(v);
}
