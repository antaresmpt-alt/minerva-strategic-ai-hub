import type { SupabaseClient } from "@supabase/supabase-js";

import {
  inferPlanificacionTipoFromProceso,
  type PlanificacionTipoMaquina,
} from "@/lib/planificacion-ambito";
import {
  computePipelineBadges,
  computePipelineRisk,
  getPasoActual,
  getSiguientePaso,
  normalizeDateIso,
  normalizePasoEstado,
  type PipelinePasoEstado,
  type PipelineRowView,
  type PipelineStepView,
} from "@/lib/pipeline/pipeline-data";

const TABLE_OTS = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_PASOS = "prod_ot_pasos";
const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_EXTERNOS = "prod_seguimiento_externos";
const TABLE_POOL = "prod_planificacion_pool";

const ACTIVE_EJECUCION_ORDER = new Map<string, number>([
  ["en_curso", 0],
  ["pausada", 1],
  ["pendiente_inicio", 2],
  ["finalizada", 3],
  ["cancelada", 4],
]);

type FetchPipelineFilters = {
  search?: string;
  onlyIncidencias?: boolean;
  externo?: boolean;
  estadoPasoActual?: PipelinePasoEstado | "all";
  limit?: number;
};

type OtRow = {
  id: string;
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  prioridad: number | null;
  fecha_entrega: string | null;
  estado_desc: string | null;
};

type DespRow = {
  ot_numero: string;
  despachado_at: string | null;
  material: string | null;
  gramaje: number | null;
  tamano_hoja: string | null;
  num_hojas_brutas: number | null;
  horas_entrada: number | null;
  horas_tiraje: number | null;
  tintas: string | null;
  troquel: string | null;
  poses: number | null;
  acabado_pral: string | null;
  horas_estimadas_troquelado: number | null;
  horas_estimadas_engomado: number | null;
};

type PasoRow = {
  id: string;
  ot_id: string;
  orden: number | null;
  estado: string | null;
  proceso_id: number | null;
  maquina_id: string | null;
  proveedor_nombre: string | null;
  notas_instrucciones: string | null;
  fecha_disponible: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  prod_procesos_cat:
    | {
        nombre: string | null;
        seccion_slug: string | null;
        es_externo: boolean | null;
      }
    | {
        nombre: string | null;
        seccion_slug: string | null;
        es_externo: boolean | null;
      }[]
    | null;
  prod_maquinas:
    | {
        nombre: string | null;
        tipo_maquina: string | null;
      }
    | {
        nombre: string | null;
        tipo_maquina: string | null;
      }[]
    | null;
};

type EjecRow = {
  id: string;
  ot_paso_id: string | null;
  estado_ejecucion:
    | "pendiente_inicio"
    | "en_curso"
    | "pausada"
    | "finalizada"
    | "cancelada";
  inicio_real_at: string | null;
  fin_real_at: string | null;
  horas_reales: number | null;
  horas_reales_troquelado: number | null;
  horas_reales_engomado: number | null;
  maquinista: string | null;
  incidencia: string | null;
  accion_correctiva: string | null;
  observaciones: string | null;
  updated_at: string | null;
};

type ExtRow = {
  id: string;
  ot_paso_id: string | null;
  estado: string | null;
  proveedor_id: string | null;
  fecha_envio: string | null;
  fecha_prevista: string | null;
  observaciones: string | null;
  updated_at: string | null;
  prod_proveedores:
    | {
        nombre: string | null;
      }
    | {
        nombre: string | null;
      }[]
    | null;
};

type PoolRow = {
  ot_numero: string;
  estado_pool: string | null;
};

function pickJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function str(v: unknown): string | null {
  const out = String(v ?? "").trim();
  return out.length > 0 ? out : null;
}

function n(v: unknown): number | null {
  const value = Number(v);
  return Number.isFinite(value) ? value : null;
}

function buildResumenCorto(step: PipelineStepView, desp: DespRow | null): string | null {
  if (step.esExterno) {
    const prov = step.externo?.proveedorNombre;
    const est = step.externo?.estado;
    if (prov && est) return `${prov} · ${est}`;
    if (prov) return prov;
    if (est) return est;
    return "Paso externo";
  }
  if (!desp) return null;

  const chunks: string[] = [];
  const tintas = str(desp.tintas);
  const mat = str(desp.material);
  const troquel = str(desp.troquel);
  const poses = n(desp.poses);
  if (tintas) chunks.push(`Tintas ${tintas}`);
  if (mat) chunks.push(mat);
  if (troquel) chunks.push(`Troquel ${troquel}${poses ? ` (${Math.trunc(poses)})` : ""}`);
  if (chunks.length === 0) return null;
  return chunks.join(" · ");
}

function computeEtaPrevista(
  despachadoAt: string | null,
  horasPlanificadasTotal: number | null,
  horasRealesTotal: number | null,
  now = new Date(),
): string | null {
  if (horasPlanificadasTotal == null || horasPlanificadasTotal <= 0) return null;
  if (horasRealesTotal != null && horasRealesTotal >= horasPlanificadasTotal) {
    return now.toISOString();
  }
  const despachoIso = normalizeDateIso(despachadoAt);
  if (!despachoIso || horasRealesTotal == null || horasRealesTotal <= 0) return null;
  const startMs = new Date(despachoIso).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(startMs) || nowMs <= startMs) return null;
  const progress = Math.min(0.99, Math.max(0.01, horasRealesTotal / horasPlanificadasTotal));
  const elapsedMs = nowMs - startMs;
  const totalMs = elapsedMs / progress;
  return new Date(startMs + totalMs).toISOString();
}

function mapSlaStatus(riesgo: PipelineRowView["riesgo"]): PipelineRowView["analytics"]["slaStatus"] {
  if (riesgo === "overdue") return "late";
  if (riesgo === "warning") return "at_risk";
  return "on_track";
}

export async function fetchPipelineRows(
  supabase: SupabaseClient,
  filters: FetchPipelineFilters = {},
): Promise<PipelineRowView[]> {
  const limit = Math.max(1, Math.min(2000, Math.trunc(filters.limit ?? 500)));
  const search = String(filters.search ?? "").trim().toLowerCase();

  const { data: despData, error: despErr } = await supabase
    .from(TABLE_DESPACHADAS)
    .select(
      "ot_numero, despachado_at, material, gramaje, tamano_hoja, num_hojas_brutas, horas_entrada, horas_tiraje, tintas, troquel, poses, acabado_pral, horas_estimadas_troquelado, horas_estimadas_engomado",
    )
    .order("despachado_at", { ascending: false })
    .limit(limit);
  if (despErr) throw despErr;

  const despRows = (despData ?? []) as DespRow[];
  const otNumeros = [...new Set(despRows.map((r) => str(r.ot_numero)).filter(Boolean))] as string[];
  if (otNumeros.length === 0) return [];

  const { data: otData, error: otErr } = await supabase
    .from(TABLE_OTS)
    .select("id, num_pedido, cliente, titulo, prioridad, fecha_entrega, estado_desc")
    .in("num_pedido", otNumeros);
  if (otErr) throw otErr;
  const ots = (otData ?? []) as OtRow[];

  const otByNum = new Map<string, OtRow>();
  const otIds: string[] = [];
  for (const ot of ots) {
    const num = str(ot.num_pedido);
    const id = str(ot.id);
    if (!num || !id) continue;
    otByNum.set(num, ot);
    otIds.push(id);
  }

  const despByOt = new Map<string, DespRow>();
  for (const row of despRows) {
    const ot = str(row.ot_numero);
    if (!ot || despByOt.has(ot)) continue;
    despByOt.set(ot, row);
  }

  const uniqueOtIds = [...new Set(otIds)];
  const pasosByOtId = new Map<string, PasoRow[]>();
  const allPasoIds: string[] = [];
  if (uniqueOtIds.length > 0) {
    const { data: pasosData, error: pasosErr } = await supabase
      .from(TABLE_PASOS)
      .select(
        "id, ot_id, orden, estado, proceso_id, maquina_id, proveedor_nombre, notas_instrucciones, fecha_disponible, fecha_inicio, fecha_fin, prod_procesos_cat(nombre, seccion_slug, es_externo), prod_maquinas(nombre, tipo_maquina)",
      )
      .in("ot_id", uniqueOtIds)
      .order("orden", { ascending: true });
    if (pasosErr) throw pasosErr;
    for (const paso of (pasosData ?? []) as PasoRow[]) {
      const otId = str(paso.ot_id);
      const pasoId = str(paso.id);
      if (!otId || !pasoId) continue;
      const list = pasosByOtId.get(otId) ?? [];
      list.push(paso);
      pasosByOtId.set(otId, list);
      allPasoIds.push(pasoId);
    }
  }

  const uniquePasoIds = [...new Set(allPasoIds)];
  const ejecByPaso = new Map<string, EjecRow>();
  if (uniquePasoIds.length > 0) {
    const { data: ejecData, error: ejecErr } = await supabase
      .from(TABLE_EJECUCIONES)
      .select(
        "id, ot_paso_id, estado_ejecucion, inicio_real_at, fin_real_at, horas_reales, horas_reales_troquelado, horas_reales_engomado, maquinista, incidencia, accion_correctiva, observaciones, updated_at",
      )
      .in("ot_paso_id", uniquePasoIds)
      .order("updated_at", { ascending: false });
    if (ejecErr) throw ejecErr;

    for (const row of (ejecData ?? []) as EjecRow[]) {
      const pasoId = str(row.ot_paso_id);
      if (!pasoId) continue;
      const prev = ejecByPaso.get(pasoId);
      if (!prev) {
        ejecByPaso.set(pasoId, row);
        continue;
      }
      const prevRank = ACTIVE_EJECUCION_ORDER.get(prev.estado_ejecucion) ?? 99;
      const nextRank = ACTIVE_EJECUCION_ORDER.get(row.estado_ejecucion) ?? 99;
      if (nextRank < prevRank) ejecByPaso.set(pasoId, row);
    }
  }

  const extByPaso = new Map<string, ExtRow>();
  if (uniquePasoIds.length > 0) {
    const { data: extData, error: extErr } = await supabase
      .from(TABLE_EXTERNOS)
      .select(
        "id, ot_paso_id, estado, proveedor_id, fecha_envio, fecha_prevista, observaciones, updated_at, prod_proveedores(nombre)",
      )
      .in("ot_paso_id", uniquePasoIds)
      .order("updated_at", { ascending: false });
    if (extErr) throw extErr;
    for (const row of (extData ?? []) as ExtRow[]) {
      const pasoId = str(row.ot_paso_id);
      if (!pasoId) continue;
      const prev = extByPaso.get(pasoId);
      const estado = str(row.estado)?.toLowerCase() ?? "";
      if (!prev) {
        extByPaso.set(pasoId, row);
        continue;
      }
      const prevEstado = str(prev.estado)?.toLowerCase() ?? "";
      if (prevEstado === "recibido" && estado !== "recibido") {
        extByPaso.set(pasoId, row);
      }
    }
  }

  const poolByOt = new Map<string, PoolRow>();
  const { data: poolData } = await supabase
    .from(TABLE_POOL)
    .select("ot_numero, estado_pool")
    .in("ot_numero", otNumeros);
  for (const row of (poolData ?? []) as PoolRow[]) {
    const ot = str(row.ot_numero);
    if (ot && !poolByOt.has(ot)) poolByOt.set(ot, row);
  }

  const out: PipelineRowView[] = [];
  for (const otNumero of otNumeros) {
    const ot = otByNum.get(otNumero);
    const desp = despByOt.get(otNumero) ?? null;
    const otId = str(ot?.id) ?? null;
    const pasoRows = otId ? pasosByOtId.get(otId) ?? [] : [];

    const pasos: PipelineStepView[] = pasoRows.map((p) => {
      const pasoId = str(p.id) ?? "";
      const cat = pickJoin(p.prod_procesos_cat);
      const maq = pickJoin(p.prod_maquinas);
      const ejec = pasoId ? ejecByPaso.get(pasoId) : undefined;
      const ext = pasoId ? extByPaso.get(pasoId) : undefined;
      const seccionSlug = str(cat?.seccion_slug);
      const procesoNombre = str(cat?.nombre);
      const tipoMaquina = (() => {
        const raw = str(maq?.tipo_maquina);
        if (
          raw === "impresion" ||
          raw === "digital" ||
          raw === "troquelado" ||
          raw === "engomado"
        ) {
          return raw as PlanificacionTipoMaquina;
        }
        return inferPlanificacionTipoFromProceso(seccionSlug, procesoNombre);
      })();

      const step: PipelineStepView = {
        pasoId,
        orden: Math.max(0, Math.trunc(n(p.orden) ?? 0)),
        estadoPaso: normalizePasoEstado(p.estado),
        procesoId: n(p.proceso_id),
        procesoNombre,
        seccionSlug,
        esExterno: Boolean(cat?.es_externo),
        maquinaId: str(p.maquina_id),
        maquinaNombre: str(maq?.nombre),
        tipoMaquina,
        fechaDisponible: normalizeDateIso(p.fecha_disponible),
        fechaInicio: normalizeDateIso(p.fecha_inicio),
        fechaFin: normalizeDateIso(p.fecha_fin),
        resumenCorto: null,
        ejecucion: ejec
          ? {
              estado: ejec.estado_ejecucion,
              inicioRealAt: normalizeDateIso(ejec.inicio_real_at),
              finRealAt: normalizeDateIso(ejec.fin_real_at),
              horasReales: n(ejec.horas_reales),
              maquinista: str(ejec.maquinista),
              incidencia: str(ejec.incidencia),
              accionCorrectiva: str(ejec.accion_correctiva),
              observaciones: str(ejec.observaciones),
            }
          : null,
        externo: ext
          ? {
              estado: str(ext.estado),
              proveedorNombre: str(pickJoin(ext.prod_proveedores)?.nombre),
              fechaEnvio: normalizeDateIso(ext.fecha_envio),
              fechaPrevista: normalizeDateIso(ext.fecha_prevista),
              observaciones: str(ext.observaciones),
            }
          : null,
      };
      step.resumenCorto = buildResumenCorto(step, desp);
      return step;
    });

    const pasoActual = getPasoActual(pasos);
    const siguientePaso = getSiguientePaso(pasos, pasoActual);
    const riesgo = computePipelineRisk({
      fechaCompromiso: ot?.fecha_entrega ?? null,
      pasos,
    });

    const horasPlanificadasTotal = (() => {
      if (!desp) return null;
      const total =
        (n(desp.horas_entrada) ?? 0) +
        (n(desp.horas_tiraje) ?? 0) +
        (n(desp.horas_estimadas_troquelado) ?? 0) +
        (n(desp.horas_estimadas_engomado) ?? 0);
      return total > 0 ? total : null;
    })();
    const horasRealesTotal = (() => {
      let total = 0;
      let has = false;
      for (const p of pasoRows) {
        const pasoId = str(p.id);
        if (!pasoId) continue;
        const ejec = ejecByPaso.get(pasoId);
        if (!ejec) continue;
        const seccion = str(pickJoin(p.prod_procesos_cat)?.seccion_slug)?.toLowerCase();
        const v =
          seccion === "troquelado"
            ? n(ejec.horas_reales_troquelado)
            : seccion === "engomado"
              ? n(ejec.horas_reales_engomado)
              : n(ejec.horas_reales);
        if (v != null && v > 0) {
          total += v;
          has = true;
        }
      }
      return has ? total : null;
    })();
    const desviacionHoras =
      horasPlanificadasTotal != null && horasRealesTotal != null
        ? horasRealesTotal - horasPlanificadasTotal
        : null;
    const etaPrevista =
      computeEtaPrevista(
        desp?.despachado_at ?? null,
        horasPlanificadasTotal,
        horasRealesTotal,
      ) ?? normalizeDateIso(ot?.fecha_entrega ?? null);

    const row: PipelineRowView = {
      otNumero,
      otId,
      cliente: str(ot?.cliente),
      trabajo: str(ot?.titulo),
      prioridad: n(ot?.prioridad),
      fechaCompromiso: normalizeDateIso(ot?.fecha_entrega ?? null),
      estadoOt: str(ot?.estado_desc),
      despachadoAt: normalizeDateIso(desp?.despachado_at ?? null),
      pasoActual,
      siguientePaso,
      pasos,
      riesgo,
      badges: [],
      analytics: {
        horasPlanificadasTotal,
        horasRealesTotal,
        desviacionHoras,
        etaPrevista,
        slaStatus: mapSlaStatus(riesgo),
      },
    };

    row.badges = computePipelineBadges({
      pasos: row.pasos,
      fechaCompromiso: row.fechaCompromiso,
      riesgo: row.riesgo,
    });

    const poolEstado = str(poolByOt.get(otNumero)?.estado_pool)?.toLowerCase();
    if (poolEstado === "cerrada" && !row.badges.includes("cerrada")) {
      row.badges.push("cerrada");
    }

    if (search) {
      const hayMatch = [row.otNumero, row.cliente, row.trabajo]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(search));
      if (!hayMatch) continue;
    }

    if (filters.onlyIncidencias) {
      const hasIssue =
        row.badges.includes("bloqueado") ||
        row.badges.includes("en_riesgo") ||
        row.badges.includes("sin_itinerario");
      if (!hasIssue) continue;
    }

    if (typeof filters.externo === "boolean") {
      const hasExterno = row.pasos.some((p) => p.esExterno);
      if (hasExterno !== filters.externo) continue;
    }

    if (filters.estadoPasoActual && filters.estadoPasoActual !== "all") {
      if (row.pasoActual?.estadoPaso !== filters.estadoPasoActual) continue;
    }

    out.push(row);
  }

  return out;
}

export type { FetchPipelineFilters };

