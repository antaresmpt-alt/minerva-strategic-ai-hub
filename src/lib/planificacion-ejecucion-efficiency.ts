import type { MesaEjecucion, MesaEjecucionPausa } from "@/types/planificacion-mesa";

export type PausesByExecutionId = Record<string, MesaEjecucionPausa[]>;

export type EfficiencyStatus = "productiva" | "atencion" | "critica";

export interface PauseDetail {
  executionId: string;
  ot: string;
  inicio: string;
  fin: string | null;
  motivo: string;
  categoria: string;
  duracionMin: number;
  observaciones: string | null;
}

export interface EficienciaPorOt {
  executionId: string;
  ot: string;
  tiempoTotalMin: number;
  tiempoPausaMin: number;
  tiempoMarchaMin: number;
  eficienciaPct: number;
  causaPrincipal: {
    motivo: string;
    categoria: string;
    minutos: number;
  } | null;
}

export interface EjecucionEfficiencyReport {
  tiempoTotalMin: number;
  tiempoPausaMin: number;
  tiempoMarchaMin: number;
  eficienciaPct: number;
  causaPrincipal: {
    motivo: string;
    categoria: string;
    minutos: number;
  } | null;
  estadoMaquina: {
    key: EfficiencyStatus;
    label: string;
    color: [number, number, number];
    hex: string;
  };
  pauseDetails: PauseDetail[];
  topMotivosPausa: Array<{
    motivo: string;
    categoria: string;
    minutos: number;
  }>;
  distribucionCategorias: Array<{
    categoria: string;
    minutos: number;
  }>;
  eficienciaPorOt: EficienciaPorOt[];
  worstPerformingRows: EficienciaPorOt[];
}

function diffMinutes(start: string | null, end: string | null, now: Date): number {
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : now.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function statusForEfficiency(pct: number): EjecucionEfficiencyReport["estadoMaquina"] {
  if (pct >= 85) {
    return { key: "productiva", label: "Productiva", color: [5, 150, 105], hex: "#059669" };
  }
  if (pct >= 70) {
    return { key: "atencion", label: "Atención", color: [217, 119, 6], hex: "#D97706" };
  }
  return { key: "critica", label: "Crítica", color: [220, 38, 38], hex: "#DC2626" };
}

function executionEnd(row: MesaEjecucion, now: Date): string | null {
  if (row.finRealAt) return row.finRealAt;
  if (row.estadoEjecucion === "en_curso" || row.estadoEjecucion === "pausada") {
    return now.toISOString();
  }
  return null;
}

export function buildEjecucionEfficiencyReport(
  rows: MesaEjecucion[],
  pausesByExecutionId: PausesByExecutionId = {},
  now: Date = new Date(),
): EjecucionEfficiencyReport {
  const rowById = new Map(rows.map((r) => [r.id, r] as const));
  const metricsByExecution = new Map<
    string,
    {
      executionId: string;
      ot: string;
      tiempoTotalMin: number;
      tiempoPausaMin: number;
      tiempoMarchaMin: number;
      eficienciaPct: number;
      causeMinutes: Map<string, { motivo: string; categoria: string; minutos: number }>;
    }
  >();
  const tiempoTotalMin = rows.reduce((acc, row) => {
    const end = executionEnd(row, now);
    const totalMin = end ? diffMinutes(row.inicioRealAt, end, now) : 0;
    metricsByExecution.set(row.id, {
      executionId: row.id,
      ot: row.ot,
      tiempoTotalMin: totalMin,
      tiempoPausaMin: 0,
      tiempoMarchaMin: totalMin,
      eficienciaPct: totalMin > 0 ? 100 : 0,
      causeMinutes: new Map(),
    });
    return acc + totalMin;
  }, 0);
  const pauseDetails: PauseDetail[] = [];
  const causeMinutes = new Map<string, { motivo: string; categoria: string; minutos: number }>();
  const categoryMinutes = new Map<string, number>();

  for (const row of rows) {
    const pauses = pausesByExecutionId[row.id] ?? [];
    const rowMetrics = metricsByExecution.get(row.id);
    for (const pause of pauses) {
      const duracionMin =
        typeof pause.minutosPausa === "number" && pause.minutosPausa >= 0 && pause.resumedAt
          ? pause.minutosPausa
          : diffMinutes(pause.pausedAt, pause.resumedAt, now);
      const detail: PauseDetail = {
        executionId: row.id,
        ot: row.ot,
        inicio: pause.pausedAt,
        fin: pause.resumedAt,
        motivo: pause.motivoLabel,
        categoria: pause.motivoCategoria,
        duracionMin,
        observaciones: pause.observacionesPausa,
      };
      pauseDetails.push(detail);
      const key = `${detail.categoria}::${detail.motivo}`;
      const prev = causeMinutes.get(key) ?? {
        motivo: detail.motivo,
        categoria: detail.categoria,
        minutos: 0,
      };
      prev.minutos += duracionMin;
      causeMinutes.set(key, prev);
      categoryMinutes.set(detail.categoria, (categoryMinutes.get(detail.categoria) ?? 0) + duracionMin);
      if (rowMetrics) {
        rowMetrics.tiempoPausaMin += duracionMin;
        const rowPrev = rowMetrics.causeMinutes.get(key) ?? {
          motivo: detail.motivo,
          categoria: detail.categoria,
          minutos: 0,
        };
        rowPrev.minutos += duracionMin;
        rowMetrics.causeMinutes.set(key, rowPrev);
      }
    }
  }

  const tiempoPausaMin = pauseDetails.reduce((acc, p) => acc + p.duracionMin, 0);
  const tiempoMarchaMin = Math.max(0, tiempoTotalMin - tiempoPausaMin);
  const eficienciaPct = tiempoTotalMin > 0 ? Math.round((tiempoMarchaMin / tiempoTotalMin) * 100) : 0;
  const causaPrincipal = Array.from(causeMinutes.values()).sort(
    (a, b) => b.minutos - a.minutos,
  )[0] ?? null;
  const topMotivosPausa = Array.from(causeMinutes.values()).sort(
    (a, b) => b.minutos - a.minutos,
  );
  const distribucionCategorias = Array.from(categoryMinutes.entries())
    .map(([categoria, minutos]) => ({ categoria, minutos }))
    .sort((a, b) => b.minutos - a.minutos);
  const eficienciaPorOt = Array.from(metricsByExecution.values()).map((m) => {
    const rowMarchaMin = Math.max(0, m.tiempoTotalMin - m.tiempoPausaMin);
    const rowEfficiency =
      m.tiempoTotalMin > 0 ? Math.round((rowMarchaMin / m.tiempoTotalMin) * 100) : 0;
    return {
      executionId: m.executionId,
      ot: m.ot,
      tiempoTotalMin: m.tiempoTotalMin,
      tiempoPausaMin: m.tiempoPausaMin,
      tiempoMarchaMin: rowMarchaMin,
      eficienciaPct: rowEfficiency,
      causaPrincipal: Array.from(m.causeMinutes.values()).sort(
        (a, b) => b.minutos - a.minutos,
      )[0] ?? null,
    };
  });
  const worstPerformingRows = [...eficienciaPorOt]
    .filter((r) => r.tiempoTotalMin > 0)
    .sort((a, b) => a.eficienciaPct - b.eficienciaPct)
    .slice(0, 5);

  pauseDetails.sort((a, b) => {
    const rowA = rowById.get(a.executionId);
    const rowB = rowById.get(b.executionId);
    const dateDiff = new Date(a.inicio).getTime() - new Date(b.inicio).getTime();
    if (dateDiff !== 0) return dateDiff;
    return String(rowA?.ot ?? "").localeCompare(String(rowB?.ot ?? ""));
  });

  return {
    tiempoTotalMin,
    tiempoPausaMin,
    tiempoMarchaMin,
    eficienciaPct,
    causaPrincipal,
    estadoMaquina: statusForEfficiency(eficienciaPct),
    pauseDetails,
    topMotivosPausa,
    distribucionCategorias,
    eficienciaPorOt,
    worstPerformingRows,
  };
}

export function formatMinutesDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h <= 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
