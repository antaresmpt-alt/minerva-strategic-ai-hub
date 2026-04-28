import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  EstadoEjecucionMesa,
  MesaEjecucion,
  MesaEjecucionPausa,
  MotivoPausaCategoria,
} from "@/types/planificacion-mesa";

const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_EJECUCIONES_PAUSAS = "prod_mesa_ejecuciones_pausas";
const TABLE_MAQUINAS = "prod_maquinas";

export type AnaliticaProceso = "impresion";
export type AnaliticaEstadoFilter = "finalizadas" | "activas" | "todas";

export type AnaliticaMaquina = {
  id: string;
  nombre: string;
};

export type AnaliticaPlantaEjecucion = MesaEjecucion & {
  cliente: string | null;
};

export type LoadAnaliticaPlantaFilters = {
  proceso: AnaliticaProceso;
  maquinaId: string | "all";
  estado: AnaliticaEstadoFilter;
  startIso: string;
  endIso: string;
};

export type AnaliticaPlantaData = {
  rows: AnaliticaPlantaEjecucion[];
  pausesByExecutionId: Record<string, MesaEjecucionPausa[]>;
  maquinas: AnaliticaMaquina[];
};

type SupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;

type MaquinaRow = {
  id: string;
  nombre: string;
};

type MesaTrabajoJoin = {
  cliente_snapshot: string | null;
};

type EjecucionRow = {
  id: string;
  mesa_trabajo_id: string | null;
  ot_numero: string;
  maquina_id: string;
  prod_maquinas?: { nombre: string | null } | null;
  prod_mesa_planificacion_trabajos?: MesaTrabajoJoin | MesaTrabajoJoin[] | null;
  fecha_planificada: string | null;
  turno: string | null;
  slot_orden: number | null;
  inicio_real_at: string;
  fin_real_at: string | null;
  estado_ejecucion: EstadoEjecucionMesa;
  ha_estado_pausada: boolean | null;
  num_pausas: number | string | null;
  minutos_pausada_acum: number | string | null;
  horas_planificadas_snapshot: number | string | null;
  horas_reales: number | string | null;
  incidencia: string | null;
  accion_correctiva: string | null;
  maquinista: string | null;
  densidades_json: Record<string, unknown> | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

type MotivoPausaJoin = {
  label: string | null;
  categoria: MotivoPausaCategoria | null;
  color_hex: string | null;
};

type PausaRow = {
  id: string;
  ejecucion_id: string;
  paused_at: string;
  resumed_at: string | null;
  motivo_id: string;
  observaciones_pausa: string | null;
  minutos_pausa: number | string | null;
  created_at: string | null;
  sys_motivos_pausa?: MotivoPausaJoin | MotivoPausaJoin[] | null;
};

function parseNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapPause(row: PausaRow): MesaEjecucionPausa {
  const motivo = pickJoin(row.sys_motivos_pausa);
  return {
    id: row.id,
    ejecucionId: row.ejecucion_id,
    pausedAt: row.paused_at,
    resumedAt: row.resumed_at,
    motivoId: row.motivo_id,
    motivoLabel: motivo?.label?.trim() || "Sin motivo",
    motivoCategoria: motivo?.categoria ?? "operativos",
    motivoColorHex: motivo?.color_hex ?? "#64748B",
    observacionesPausa: row.observaciones_pausa,
    minutosPausa: parseNum(row.minutos_pausa),
    createdAt: row.created_at ?? "",
  };
}

function mapExecution(
  row: EjecucionRow,
  pausesByExecutionId: Map<string, MesaEjecucionPausa[]>,
): AnaliticaPlantaEjecucion {
  const pauses = pausesByExecutionId.get(row.id) ?? [];
  const openPause = pauses.find((p) => p.resumedAt == null) ?? null;
  const mesa = pickJoin(row.prod_mesa_planificacion_trabajos);
  return {
    id: row.id,
    mesaTrabajoId: row.mesa_trabajo_id,
    ot: row.ot_numero,
    cliente: mesa?.cliente_snapshot?.trim() || null,
    maquinaId: row.maquina_id,
    maquinaNombre: row.prod_maquinas?.nombre ?? "—",
    fechaPlanificada: row.fecha_planificada,
    turno: row.turno === "manana" || row.turno === "tarde" ? row.turno : null,
    slotOrden: row.slot_orden,
    inicioRealAt: row.inicio_real_at,
    finRealAt: row.fin_real_at,
    estadoEjecucion: row.estado_ejecucion,
    pausaActivaDesde: openPause?.pausedAt ?? null,
    motivoPausaActiva: openPause?.motivoLabel ?? null,
    motivoPausaCategoriaActiva: openPause?.motivoCategoria ?? null,
    motivoPausaColorHexActiva: openPause?.motivoColorHex ?? null,
    haEstadoPausada: Boolean(row.ha_estado_pausada) || pauses.length > 0,
    numPausas: Math.max(0, Math.trunc(parseNum(row.num_pausas) ?? pauses.length)),
    minutosPausadaAcum: Number(parseNum(row.minutos_pausada_acum) ?? 0),
    horasPlanificadasSnapshot: parseNum(row.horas_planificadas_snapshot),
    horasReales: parseNum(row.horas_reales),
    incidencia: row.incidencia,
    accionCorrectiva: row.accion_correctiva,
    maquinista: row.maquinista,
    densidadesJson: row.densidades_json,
    observaciones: row.observaciones,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadAnaliticaPlantaData(
  supabase: SupabaseClient,
  filters: LoadAnaliticaPlantaFilters,
): Promise<AnaliticaPlantaData> {
  const [maquinasRes, ejecucionesRes] = await Promise.all([
    supabase
      .from(TABLE_MAQUINAS)
      .select("id, nombre")
      .eq("tipo_maquina", filters.proceso)
      .eq("activa", true)
      .order("orden_visual", { ascending: true })
      .order("nombre", { ascending: true }),
    (() => {
      let query = supabase
        .from(TABLE_EJECUCIONES)
        .select(
          "id, mesa_trabajo_id, ot_numero, maquina_id, fecha_planificada, turno, slot_orden, inicio_real_at, fin_real_at, estado_ejecucion, ha_estado_pausada, num_pausas, minutos_pausada_acum, horas_planificadas_snapshot, horas_reales, incidencia, accion_correctiva, maquinista, densidades_json, observaciones, created_at, updated_at, prod_maquinas(nombre), prod_mesa_planificacion_trabajos(cliente_snapshot)",
        )
        .gte("inicio_real_at", filters.startIso)
        .lte("inicio_real_at", filters.endIso)
        .order("inicio_real_at", { ascending: false });

      if (filters.maquinaId !== "all") {
        query = query.eq("maquina_id", filters.maquinaId);
      }
      if (filters.estado === "finalizadas") {
        query = query.eq("estado_ejecucion", "finalizada");
      } else if (filters.estado === "activas") {
        query = query.in("estado_ejecucion", ["en_curso", "pausada"]);
      }
      return query;
    })(),
  ]);

  if (maquinasRes.error) throw maquinasRes.error;
  if (ejecucionesRes.error) throw ejecucionesRes.error;

  const maquinas = ((maquinasRes.data ?? []) as MaquinaRow[]).map((m) => ({
    id: m.id,
    nombre: m.nombre,
  }));
  const ejecuciones = (ejecucionesRes.data ?? []) as unknown as EjecucionRow[];
  const executionIds = ejecuciones.map((e) => e.id);
  const pauseMap = new Map<string, MesaEjecucionPausa[]>();

  if (executionIds.length > 0) {
    const { data, error } = await supabase
      .from(TABLE_EJECUCIONES_PAUSAS)
      .select(
        "id, ejecucion_id, paused_at, resumed_at, motivo_id, observaciones_pausa, minutos_pausa, created_at, sys_motivos_pausa(label,categoria,color_hex)",
      )
      .in("ejecucion_id", executionIds)
      .order("paused_at", { ascending: false });
    if (error) throw error;
    for (const row of (data ?? []) as unknown as PausaRow[]) {
      const pause = mapPause(row);
      const list = pauseMap.get(pause.ejecucionId) ?? [];
      list.push(pause);
      pauseMap.set(pause.ejecucionId, list);
    }
  }

  const pausesByExecutionId = Object.fromEntries(
    Array.from(pauseMap.entries()).map(([id, pauses]) => [id, pauses] as const),
  );

  return {
    rows: ejecuciones.map((row) => mapExecution(row, pauseMap)),
    pausesByExecutionId,
    maquinas,
  };
}
