import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchPipelineRows } from "@/lib/pipeline/pipeline-query";
import {
  getPasoActual,
  type PipelinePasoEstado,
  type PipelineRowView,
} from "@/lib/pipeline/pipeline-data";

export type ExternoPrevisionRow = {
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  cantidad: number | null;
  fechaEntrega: string | null;
  pasoActualNombre: string | null;
  pasoActualEstado: PipelinePasoEstado | null;
  proximoExternoNombre: string | null;
  /** Pasos de itinerario hasta el próximo externo pendiente (≥ 1 en previsión). */
  pasosHastaExterno: number;
};

function isOtTerminada(row: PipelineRowView): boolean {
  if (row.badges.includes("cerrada")) return true;
  const s = String(row.estadoOt ?? "").trim().toLowerCase();
  return (
    s.includes("terminad") ||
    s.includes("cancelad") ||
    s.includes("cerrad") ||
    s.includes("producid") ||
    s.includes("anulad")
  );
}

export function shouldExcludeFromExternoPrevision(
  row: PipelineRowView,
  queueOtNumeros: ReadonlySet<string>,
): boolean {
  if (queueOtNumeros.has(row.otNumero)) return true;
  if (row.badges.includes("externo_activo")) return true;
  if (isOtTerminada(row)) return true;
  if (row.pasos.length === 0) return true;
  return false;
}

export function buildExternoPrevisionRow(
  row: PipelineRowView,
): ExternoPrevisionRow | null {
  const ordered = [...row.pasos].sort((a, b) => a.orden - b.orden);
  const proximoExterno = ordered.find(
    (p) => p.esExterno && p.estadoPaso !== "finalizado",
  );
  if (!proximoExterno) return null;

  const pasoActual = getPasoActual(row.pasos);
  const anchor =
    pasoActual ??
    ordered.find((p) => p.estadoPaso === "disponible") ??
    ordered.find((p) => p.estadoPaso !== "finalizado") ??
    null;
  if (!anchor) return null;

  const anchorIdx = ordered.findIndex((p) => p.pasoId === anchor.pasoId);
  const externoIdx = ordered.findIndex(
    (p) => p.pasoId === proximoExterno.pasoId,
  );
  if (anchorIdx < 0 || externoIdx < 0) return null;

  const pasosHastaExterno = externoIdx - anchorIdx;
  if (pasosHastaExterno < 1) return null;

  const fechaEntrega = row.fechaCompromiso
    ? row.fechaCompromiso.slice(0, 10)
    : null;

  return {
    otNumero: row.otNumero,
    cliente: row.cliente,
    trabajo: row.trabajo,
    cantidad: row.analytics.cantidadPedida,
    fechaEntrega,
    pasoActualNombre: anchor.procesoNombre,
    pasoActualEstado: anchor.estadoPaso,
    proximoExternoNombre: proximoExterno.procesoNombre,
    pasosHastaExterno,
  };
}

export function buildExternosPrevisionRows(
  pipelineRows: readonly PipelineRowView[],
  queueOtNumeros: ReadonlySet<string>,
): ExternoPrevisionRow[] {
  const out: ExternoPrevisionRow[] = [];

  for (const row of pipelineRows) {
    if (shouldExcludeFromExternoPrevision(row, queueOtNumeros)) continue;
    const built = buildExternoPrevisionRow(row);
    if (built) out.push(built);
  }

  out.sort((a, b) => {
    if (a.pasosHastaExterno !== b.pasosHastaExterno) {
      return a.pasosHastaExterno - b.pasosHastaExterno;
    }
    const fa = a.fechaEntrega ?? "9999-99-99";
    const fb = b.fechaEntrega ?? "9999-99-99";
    if (fa !== fb) return fa.localeCompare(fb);
    return a.otNumero.localeCompare(b.otNumero);
  });

  return out;
}

export async function fetchExternosPrevision(
  supabase: SupabaseClient,
  queueOtNumeros: Iterable<string> = [],
): Promise<ExternoPrevisionRow[]> {
  const queueSet = new Set(
    [...queueOtNumeros].map((ot) => String(ot ?? "").trim()).filter(Boolean),
  );
  const pipelineRows = await fetchPipelineRows(supabase, {
    limit: 2000,
    otTipoFiltro: "todas_planas",
  });
  return buildExternosPrevisionRows(pipelineRows, queueSet);
}

export function summarizeExternosPrevision(
  rows: readonly ExternoPrevisionRow[],
): { total: number; a1: number; a2Plus: number } {
  let a1 = 0;
  let a2Plus = 0;
  for (const r of rows) {
    if (r.pasosHastaExterno === 1) a1 += 1;
    else a2Plus += 1;
  }
  return { total: rows.length, a1, a2Plus };
}
