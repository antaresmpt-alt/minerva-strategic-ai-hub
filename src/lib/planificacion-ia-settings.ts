import {
  DEFAULT_PLANIFICACION_IA_SETTINGS,
} from "@/lib/planificacion-mesa";
import type { PlanificacionIaSettings } from "@/types/planificacion-mesa";

export const PLANIFICACION_IA_PARAM_KEYS = {
  pesoTintas: "planificacion_ia_peso_tintas",
  pesoCmyk: "planificacion_ia_peso_cmyk",
  pesoBarniz: "planificacion_ia_peso_barniz",
  pesoPapel: "planificacion_ia_peso_papel",
  pesoFechaEntrega: "planificacion_ia_peso_fecha_entrega",
  pesoBalanceCarga: "planificacion_ia_peso_balance_carga",
  promptBase: "planificacion_ia_prompt_base",
} as const;

export const PLANIFICACION_IA_NUMERIC_KEYS = [
  PLANIFICACION_IA_PARAM_KEYS.pesoTintas,
  PLANIFICACION_IA_PARAM_KEYS.pesoCmyk,
  PLANIFICACION_IA_PARAM_KEYS.pesoBarniz,
  PLANIFICACION_IA_PARAM_KEYS.pesoPapel,
  PLANIFICACION_IA_PARAM_KEYS.pesoFechaEntrega,
  PLANIFICACION_IA_PARAM_KEYS.pesoBalanceCarga,
] as const;

export type PlanificacionIaNumericKey =
  (typeof PLANIFICACION_IA_NUMERIC_KEYS)[number];

export function clampWeight(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function mapRowsToIaSettings(
  rows: Array<{ clave: string; valor_num: number | string | null; valor_text?: string | null }>,
): PlanificacionIaSettings {
  const next: PlanificacionIaSettings = { ...DEFAULT_PLANIFICACION_IA_SETTINGS };
  for (const row of rows) {
    const n = clampWeight(row.valor_num);
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.pesoTintas) next.pesoTintas = n;
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.pesoCmyk) next.pesoCmyk = n;
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.pesoBarniz) next.pesoBarniz = n;
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.pesoPapel) next.pesoPapel = n;
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.pesoFechaEntrega) next.pesoFechaEntrega = n;
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.pesoBalanceCarga) next.pesoBalanceCarga = n;
    if (row.clave === PLANIFICACION_IA_PARAM_KEYS.promptBase && row.valor_text?.trim()) {
      next.promptBase = row.valor_text.trim();
    }
  }
  return next;
}
