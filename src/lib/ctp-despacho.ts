/**
 * CTP / preimpresión: requisitos marcados en despacho vs confirmación en ejecución.
 */

import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";

/** Campos de trabajo CTP: despacho marca `requiere_*`, ejecución confirma sin prefijo. */
export const CTP_REQUISITO_DEFS = [
  {
    requiereKey: "requiere_prueba_digital",
    hechoKey: "prueba_digital",
    label: "Prueba digital",
  },
  {
    requiereKey: "requiere_prueba_gmg",
    hechoKey: "prueba_gmg",
    label: "Prueba GMG",
  },
  {
    requiereKey: "requiere_pdf_x_ok",
    hechoKey: "pdf_x_ok",
    label: "PDF X OK",
  },
  {
    requiereKey: "requiere_maqueta",
    hechoKey: "maqueta",
    label: "Maqueta",
  },
  {
    requiereKey: "requiere_gestion_troquel",
    hechoKey: "gestion_troquel",
    label: "Gestión troquel",
  },
  {
    requiereKey: "requiere_preparacion_montaje",
    hechoKey: "preparacion_montaje",
    label: "Preparación montaje",
  },
  {
    requiereKey: "requiere_retoque_diseno",
    hechoKey: "retoque_diseno",
    label: "Retoque diseño",
  },
  {
    requiereKey: "requiere_gestion_relieves_stamping",
    hechoKey: "gestion_relieves_stamping",
    label: "Relieves / stamping",
  },
  {
    requiereKey: "requiere_gestion_fsc",
    hechoKey: "gestion_fsc",
    label: "Gestión FSC",
  },
] as const;

export type CtpRequisitoHechoKey = (typeof CTP_REQUISITO_DEFS)[number]["hechoKey"];

export type DespachoWizardCtpDatos = Record<CtpRequisitoHechoKey, boolean>;

export function emptyDespachoWizardCtpDatos(): DespachoWizardCtpDatos {
  return {
    prueba_digital: false,
    prueba_gmg: false,
    pdf_x_ok: false,
    maqueta: false,
    gestion_troquel: false,
    preparacion_montaje: false,
    retoque_diseno: false,
    gestion_relieves_stamping: false,
    gestion_fsc: false,
  };
}

export const CTP_EJECUCION_ONLY_FIELD_IDS = [
  "planchas_hechas",
  "num_planchas",
  "horas_proceso",
] as const;

function isTruthyFlag(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

export function buildCtpRequisitosSeedFromWizard(
  ctp: DespachoWizardCtpDatos,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const def of CTP_REQUISITO_DEFS) {
    if (ctp[def.hechoKey]) {
      payload[def.requiereKey] = true;
    }
  }
  return payload;
}

export function parseCtpWizardFromDatosProceso(
  datos: Record<string, unknown> | null | undefined,
): DespachoWizardCtpDatos {
  const next = emptyDespachoWizardCtpDatos();
  if (!datos) return next;
  for (const def of CTP_REQUISITO_DEFS) {
    if (isTruthyFlag(datos[def.requiereKey])) {
      next[def.hechoKey] = true;
    }
  }
  return next;
}

export type CtpRequisitoEstado = {
  hechoKey: CtpRequisitoHechoKey;
  requiereKey: string;
  label: string;
  requerido: boolean;
  hecho: boolean;
};

export function listCtpRequisitosEstado(
  datos: DatosProcesoGenerico | Record<string, unknown> | null | undefined,
): CtpRequisitoEstado[] {
  const d = datos ?? {};
  return CTP_REQUISITO_DEFS.map((def) => ({
    hechoKey: def.hechoKey,
    requiereKey: def.requiereKey,
    label: def.label,
    requerido: isTruthyFlag(d[def.requiereKey]),
    hecho: isTruthyFlag(d[def.hechoKey]),
  }));
}

export function ctpRequisitosRequeridos(
  datos: DatosProcesoGenerico | Record<string, unknown> | null | undefined,
): CtpRequisitoEstado[] {
  return listCtpRequisitosEstado(datos).filter((r) => r.requerido);
}

export function ctpRequisitosPendientes(
  datos: DatosProcesoGenerico | Record<string, unknown> | null | undefined,
): CtpRequisitoEstado[] {
  return ctpRequisitosRequeridos(datos).filter((r) => !r.hecho);
}

export function formatCtpRequisitosResumen(
  ctp: DespachoWizardCtpDatos | DatosProcesoGenerico,
): string {
  const labels = CTP_REQUISITO_DEFS.filter((def) => {
    const fromWizard = isTruthyFlag((ctp as DespachoWizardCtpDatos)[def.hechoKey]);
    const fromDatos = isTruthyFlag((ctp as Record<string, unknown>)[def.requiereKey]);
    return fromWizard || fromDatos;
  }).map((def) => def.label);
  return labels.length > 0 ? labels.join(", ") : "";
}

/** Al re-despachar: aplica semilla sin borrar datos de ejecución ya capturados. */
export function mergeDatosProcesoSeed(
  existing: Record<string, unknown> | null | undefined,
  seed: Record<string, unknown> | null,
  procesoId: number,
): Record<string, unknown> | null {
  const base =
    existing && typeof existing === "object" ? { ...existing } : {};
  if (procesoId === 16) {
    const next = { ...base };
    for (const def of CTP_REQUISITO_DEFS) {
      if (seed?.[def.requiereKey] === true) {
        next[def.requiereKey] = true;
      } else {
        delete next[def.requiereKey];
      }
    }
    return Object.keys(next).length > 0 ? next : null;
  }
  if (!seed || Object.keys(seed).length === 0) {
    return Object.keys(base).length > 0 ? base : null;
  }
  return { ...base, ...seed };
}
