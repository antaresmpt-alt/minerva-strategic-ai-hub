import type { PlanificacionTipoMaquina } from "@/lib/planificacion-ambito";

export type PipelineBadge =
  | "sin_itinerario"
  | "externo_activo"
  | "bloqueado"
  | "en_riesgo"
  | "cerrada";

export type PipelinePasoEstado =
  | "pendiente"
  | "disponible"
  | "en_marcha"
  | "pausado"
  | "finalizado";

export type PipelineRiesgo = "ok" | "warning" | "overdue";

export type OTRowBase = {
  otNumero: string;
  otId: string | null;
  cliente: string | null;
  trabajo: string | null;
  prioridad: number | null;
  fechaCompromiso: string | null;
  estadoOt: string | null;
  despachadoAt: string | null;
};

export type PipelineStepView = {
  pasoId: string;
  orden: number;
  estadoPaso: PipelinePasoEstado;
  procesoId: number | null;
  procesoNombre: string | null;
  seccionSlug: string | null;
  esExterno: boolean;
  maquinaId: string | null;
  maquinaNombre: string | null;
  tipoMaquina: PlanificacionTipoMaquina | null;
  fechaDisponible: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  resumenCorto: string | null;
  ejecucion: {
    estado:
      | "pendiente_inicio"
      | "en_curso"
      | "pausada"
      | "finalizada"
      | "cancelada";
    inicioRealAt: string | null;
    finRealAt: string | null;
    horasReales: number | null;
    maquinista: string | null;
    incidencia: string | null;
    accionCorrectiva: string | null;
    observaciones: string | null;
  } | null;
  externo: {
    estado: string | null;
    proveedorNombre: string | null;
    fechaEnvio: string | null;
    fechaPrevista: string | null;
    observaciones: string | null;
  } | null;
};

export type PipelineRowView = OTRowBase & {
  pasoActual: PipelineStepView | null;
  siguientePaso: PipelineStepView | null;
  pasos: PipelineStepView[];
  riesgo: PipelineRiesgo;
  badges: PipelineBadge[];
};

const STEP_STATE_SET = new Set<PipelinePasoEstado>([
  "pendiente",
  "disponible",
  "en_marcha",
  "pausado",
  "finalizado",
]);

const ACTIVE_STEP_STATES = new Set<PipelinePasoEstado>(["en_marcha", "pausado"]);

export function normalizePasoEstado(value: string | null | undefined): PipelinePasoEstado {
  const v = String(value ?? "").trim().toLowerCase();
  if (STEP_STATE_SET.has(v as PipelinePasoEstado)) return v as PipelinePasoEstado;
  return "pendiente";
}

export function normalizeDateIso(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function getPasoActual(pasos: PipelineStepView[]): PipelineStepView | null {
  const ordered = [...pasos].sort((a, b) => a.orden - b.orden);
  const active = ordered.find((p) => ACTIVE_STEP_STATES.has(p.estadoPaso));
  if (active) return active;
  return ordered.find((p) => p.estadoPaso === "disponible") ?? null;
}

export function getSiguientePaso(
  pasos: PipelineStepView[],
  pasoActual?: PipelineStepView | null,
): PipelineStepView | null {
  const ordered = [...pasos].sort((a, b) => a.orden - b.orden);
  const current = pasoActual ?? getPasoActual(ordered);
  if (!current) {
    return (
      ordered.find((p) => p.estadoPaso === "disponible") ??
      ordered.find((p) => p.estadoPaso === "pendiente") ??
      null
    );
  }
  return (
    ordered.find((p) => p.orden > current.orden && p.estadoPaso === "pendiente") ?? null
  );
}

type BadgeInput = {
  pasos: PipelineStepView[];
  fechaCompromiso: string | null;
  riesgo: PipelineRiesgo;
};

export function computePipelineBadges(input: BadgeInput): PipelineBadge[] {
  const badges: PipelineBadge[] = [];
  const { pasos, riesgo } = input;
  if (pasos.length === 0) badges.push("sin_itinerario");

  const hasExternoActivo = pasos.some(
    (p) => p.esExterno && p.externo && String(p.externo.estado ?? "").trim().toLowerCase() !== "recibido",
  );
  if (hasExternoActivo) badges.push("externo_activo");

  const hasStepDisponibleNoMovimiento = pasos.some((p) => {
    if (p.estadoPaso !== "disponible") return false;
    const hasEjecucionActiva =
      p.ejecucion != null &&
      (p.ejecucion.estado === "en_curso" || p.ejecucion.estado === "pausada");
    const hasExternoMovimiento =
      p.externo != null && String(p.externo.estado ?? "").trim().toLowerCase() !== "recibido";
    return !hasEjecucionActiva && !hasExternoMovimiento;
  });
  if (hasStepDisponibleNoMovimiento) badges.push("bloqueado");

  const allFinalized = pasos.length > 0 && pasos.every((p) => p.estadoPaso === "finalizado");
  if (allFinalized) badges.push("cerrada");

  if (riesgo !== "ok") badges.push("en_riesgo");

  return badges;
}

type RiskInput = {
  fechaCompromiso: string | null;
  pasos: PipelineStepView[];
  warningDays?: number;
};

export function computePipelineRisk(input: RiskInput, now = new Date()): PipelineRiesgo {
  const fecha = normalizeDateIso(input.fechaCompromiso);
  const hasOpenSteps = input.pasos.some((p) => p.estadoPaso !== "finalizado");
  if (!fecha || !hasOpenSteps) return "ok";

  const commitment = new Date(fecha);
  const today = new Date(now.toISOString());
  if (commitment.getTime() < today.getTime()) return "overdue";

  const warningDays = Math.max(0, Math.trunc(input.warningDays ?? 2));
  const diffMs = commitment.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return diffDays <= warningDays ? "warning" : "ok";
}

