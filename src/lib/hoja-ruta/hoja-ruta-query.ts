import type { SupabaseClient } from "@supabase/supabase-js";

import {
  inferPlanificacionTipoFromProceso,
  type PlanificacionTipoMaquina,
} from "@/lib/planificacion-ambito";

/**
 * Loader de la **Hoja de Ruta Virtual** de una OT.
 *
 * No existe una tabla única con todos los datos de una OT: la hoja se monta
 * juntando cabecera (`prod_ots_general`), ficha de despacho
 * (`produccion_ot_despachadas`), itinerario + datos por proceso
 * (`prod_ot_pasos` / `datos_proceso`), ejecución real
 * (`prod_mesa_ejecuciones`) y externos (`prod_seguimiento_externos`).
 */

const TABLE_OTS = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_PASOS = "prod_ot_pasos";
const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_PAUSAS = "prod_mesa_ejecuciones_pausas";
const TABLE_EXTERNOS = "prod_seguimiento_externos";

const EJECUCION_PICK_ORDER = new Map<string, number>([
  ["en_curso", 0],
  ["pausada", 1],
  ["pendiente_inicio", 2],
  ["finalizada", 3],
  ["cancelada", 4],
]);

export type HojaRutaPausa = {
  pausaId: string;
  pausedAt: string | null;
  resumedAt: string | null;
  minutosPausa: number | null;
  motivoLabel: string | null;
  motivoCategoria: string | null;
  motivoColor: string | null;
  observacionesPausa: string | null;
};

export type HojaRutaEjecucion = {
  estado: string;
  inicioRealAt: string | null;
  finRealAt: string | null;
  horasReales: number | null;
  numHojasProducidas: number | null;
  cantidadUnidades: number | null;
  maquinista: string | null;
  incidencia: string | null;
  accionCorrectiva: string | null;
  observaciones: string | null;
  numPausas: number;
  haEstadoPausada: boolean;
  pausas: HojaRutaPausa[];
};

export type HojaRutaExterno = {
  estado: string | null;
  proveedorNombre: string | null;
  acabadoNombre: string | null;
  fechaEnvio: string | null;
  fechaPrevista: string | null;
  fechaRecepcionMuelle: string | null;
  hojasEnviadas: number | null;
  hojasRecibidasMuelle: number | null;
  unidades: number | null;
  unidadesRecibidasMuelle: number | null;
  palets: number | null;
  paletsRecibidosMuelle: number | null;
  observaciones: string | null;
};

export type HojaRutaPaso = {
  pasoId: string;
  orden: number;
  estado: string;
  procesoId: number | null;
  procesoNombre: string | null;
  esExterno: boolean;
  maquinaNombre: string | null;
  tipoMaquina: PlanificacionTipoMaquina | null;
  fechaDisponible: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  datosProceso: Record<string, unknown> | null;
  ejecucion: HojaRutaEjecucion | null;
  externo: HojaRutaExterno | null;
};

export type HojaRutaDespacho = {
  material: string | null;
  gramaje: number | null;
  tamanoHoja: string | null;
  hojasBrutas: number | null;
  tintas: string | null;
  troquel: string | null;
  poses: number | null;
  acabadoPral: string | null;
};

export type HojaRutaData = {
  otNumero: string;
  otId: string | null;
  cliente: string | null;
  trabajo: string | null;
  cantidad: number | null;
  fechaEntrega: string | null;
  estadoOt: string | null;
  despacho: HojaRutaDespacho | null;
  pasos: HojaRutaPaso[];
};

type PasoRow = {
  id: string;
  ot_id: string | null;
  orden: number | null;
  estado: string | null;
  proceso_id: number | null;
  maquina_id: string | null;
  fecha_disponible: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  datos_proceso: Record<string, unknown> | null;
  prod_procesos_cat:
    | { nombre: string | null; seccion_slug: string | null; es_externo: boolean | null }
    | { nombre: string | null; seccion_slug: string | null; es_externo: boolean | null }[]
    | null;
  prod_maquinas:
    | { nombre: string | null; tipo_maquina: string | null }
    | { nombre: string | null; tipo_maquina: string | null }[]
    | null;
};

type EjecRow = {
  id: string;
  ot_paso_id: string | null;
  estado_ejecucion: string;
  inicio_real_at: string | null;
  fin_real_at: string | null;
  horas_reales: number | string | null;
  num_hojas_producidas: number | string | null;
  cantidad_unidades: number | string | null;
  maquinista: string | null;
  incidencia: string | null;
  accion_correctiva: string | null;
  observaciones: string | null;
  num_pausas: number | string | null;
  ha_estado_pausada: boolean | null;
  updated_at: string | null;
};

type ExtRow = {
  id: string;
  ot_paso_id: string | null;
  estado: string | null;
  fecha_envio: string | null;
  fecha_prevista: string | null;
  fecha_recepcion_muelle: string | null;
  hojas_enviadas: number | string | null;
  hojas_recibidas_muelle: number | string | null;
  unidades: number | string | null;
  unidades_recibidas_muelle: number | string | null;
  palets: number | string | null;
  palets_recibidos_muelle: number | string | null;
  observaciones: string | null;
  updated_at: string | null;
  prod_proveedores:
    | { nombre: string | null }
    | { nombre: string | null }[]
    | null;
  prod_cat_acabados:
    | { nombre: string | null }
    | { nombre: string | null }[]
    | null;
};

type PausaRow = {
  id: string;
  ejecucion_id: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  minutos_pausa: number | string | null;
  observaciones_pausa: string | null;
  sys_motivos_pausa:
    | { label: string | null; categoria: string | null; color_hex: string | null }
    | { label: string | null; categoria: string | null; color_hex: string | null }[]
    | null;
};

function pickJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function str(v: unknown): string | null {
  const out = String(v ?? "").trim();
  return out.length > 0 ? out : null;
}

function num(v: unknown): number | null {
  const value = Number(v);
  return Number.isFinite(value) ? value : null;
}

function dateIso(v: string | null | undefined): string | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Estado mostrado en cabecera: prioriza el avance real del itinerario sobre Optimus/maestro. */
export function resolveEstadoOtLabel(
  estadoDescMaestro: string | null,
  pasos: Pick<HojaRutaPaso, "estado">[],
): string | null {
  if (pasos.length === 0) return estadoDescMaestro;
  const estados = pasos.map((p) => String(p.estado ?? "").trim().toLowerCase());
  if (estados.every((e) => e === "finalizado")) return "Itinerario completo";
  if (estados.some((e) => e === "en_marcha" || e === "pausado")) return "En producción";
  if (estados.some((e) => e === "finalizado")) return "Entre fases";
  if (estados.some((e) => e === "disponible")) return "Pendiente de inicio";
  return estadoDescMaestro;
}

/** Carga la hoja de ruta completa de una OT por su número de pedido. */
export async function fetchHojaRutaOt(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<HojaRutaData | null> {
  const ot = String(otNumero ?? "").trim();
  if (!ot) return null;

  const { data: otData, error: otErr } = await supabase
    .from(TABLE_OTS)
    .select("id, num_pedido, cliente, titulo, cantidad, fecha_entrega, estado_desc")
    .eq("num_pedido", ot)
    .maybeSingle();
  if (otErr) throw otErr;

  const otRow = (otData ?? null) as Record<string, unknown> | null;
  const otId = str(otRow?.id);

  const { data: despData, error: despErr } = await supabase
    .from(TABLE_DESPACHADAS)
    .select("ot_numero, material, gramaje, tamano_hoja, num_hojas_brutas, tintas, troquel, poses, acabado_pral")
    .eq("ot_numero", ot)
    .order("despachado_at", { ascending: false })
    .limit(1);
  if (despErr) throw despErr;
  const despRow = ((despData ?? [])[0] ?? null) as Record<string, unknown> | null;

  const despacho: HojaRutaDespacho | null = despRow
    ? {
        material: str(despRow.material),
        gramaje: num(despRow.gramaje),
        tamanoHoja: str(despRow.tamano_hoja),
        hojasBrutas: num(despRow.num_hojas_brutas),
        tintas: str(despRow.tintas),
        troquel: str(despRow.troquel),
        poses: num(despRow.poses),
        acabadoPral: str(despRow.acabado_pral),
      }
    : null;

  let pasos: HojaRutaPaso[] = [];
  if (otId) {
    const { data: pasosData, error: pasosErr } = await supabase
      .from(TABLE_PASOS)
      .select(
        "id, ot_id, orden, estado, proceso_id, maquina_id, fecha_disponible, fecha_inicio, fecha_fin, datos_proceso, prod_procesos_cat(nombre, seccion_slug, es_externo), prod_maquinas(nombre, tipo_maquina)",
      )
      .eq("ot_id", otId)
      .order("orden", { ascending: true });
    if (pasosErr) throw pasosErr;

    const pasoRows = (pasosData ?? []) as PasoRow[];
    const pasoIds = pasoRows.map((p) => str(p.id)).filter(Boolean) as string[];

    const ejecByPaso = new Map<string, EjecRow>();
    if (pasoIds.length > 0) {
      const { data: ejecData, error: ejecErr } = await supabase
        .from(TABLE_EJECUCIONES)
        .select(
          "id, ot_paso_id, estado_ejecucion, inicio_real_at, fin_real_at, horas_reales, num_hojas_producidas, cantidad_unidades, maquinista, incidencia, accion_correctiva, observaciones, num_pausas, ha_estado_pausada, updated_at",
        )
        .in("ot_paso_id", pasoIds)
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
        const prevRank = EJECUCION_PICK_ORDER.get(prev.estado_ejecucion) ?? 99;
        const nextRank = EJECUCION_PICK_ORDER.get(row.estado_ejecucion) ?? 99;
        if (nextRank < prevRank) ejecByPaso.set(pasoId, row);
      }
    }

    const pausasByEjecId = new Map<string, HojaRutaPausa[]>();
    const ejecIds = Array.from(ejecByPaso.values()).map((e) => str(e.id)).filter(Boolean) as string[];
    if (ejecIds.length > 0) {
      const { data: pausasData, error: pausasErr } = await supabase
        .from(TABLE_PAUSAS)
        .select(
          "id, ejecucion_id, paused_at, resumed_at, minutos_pausa, observaciones_pausa, sys_motivos_pausa(label, categoria, color_hex)",
        )
        .in("ejecucion_id", ejecIds)
        .order("paused_at", { ascending: false });
      if (pausasErr) throw pausasErr;
      for (const row of (pausasData ?? []) as PausaRow[]) {
        const ejecId = str(row.ejecucion_id);
        if (!ejecId) continue;
        const motivo = pickJoin(row.sys_motivos_pausa);
        const pausa: HojaRutaPausa = {
          pausaId: str(row.id) ?? "",
          pausedAt: dateIso(row.paused_at),
          resumedAt: dateIso(row.resumed_at),
          minutosPausa: num(row.minutos_pausa),
          motivoLabel: str(motivo?.label),
          motivoCategoria: str(motivo?.categoria),
          motivoColor: str(motivo?.color_hex),
          observacionesPausa: str(row.observaciones_pausa),
        };
        const list = pausasByEjecId.get(ejecId) ?? [];
        list.push(pausa);
        pausasByEjecId.set(ejecId, list);
      }
    }

    const extByPaso = new Map<string, ExtRow>();
    if (pasoIds.length > 0) {
      const { data: extData, error: extErr } = await supabase
        .from(TABLE_EXTERNOS)
        .select(
          "id, ot_paso_id, estado, fecha_envio, fecha_prevista, fecha_recepcion_muelle, hojas_enviadas, hojas_recibidas_muelle, unidades, unidades_recibidas_muelle, palets, palets_recibidos_muelle, observaciones, updated_at, prod_proveedores(nombre), prod_cat_acabados(nombre)",
        )
        .in("ot_paso_id", pasoIds)
        .order("updated_at", { ascending: false });
      if (extErr) throw extErr;
      for (const row of (extData ?? []) as ExtRow[]) {
        const pasoId = str(row.ot_paso_id);
        if (!pasoId || extByPaso.has(pasoId)) continue;
        extByPaso.set(pasoId, row);
      }
    }

    pasos = pasoRows.map((p) => {
      const pasoId = str(p.id) ?? "";
      const cat = pickJoin(p.prod_procesos_cat);
      const maq = pickJoin(p.prod_maquinas);
      const seccionSlug = str(cat?.seccion_slug);
      const procesoNombre = str(cat?.nombre);
      const rawTipo = str(maq?.tipo_maquina);
      const tipoMaquina: PlanificacionTipoMaquina | null =
        rawTipo === "impresion" ||
        rawTipo === "digital" ||
        rawTipo === "troquelado" ||
        rawTipo === "engomado"
          ? (rawTipo as PlanificacionTipoMaquina)
          : inferPlanificacionTipoFromProceso(seccionSlug, procesoNombre);

      const ejec = pasoId ? ejecByPaso.get(pasoId) : undefined;
      const ext = pasoId ? extByPaso.get(pasoId) : undefined;

      return {
        pasoId,
        orden: Math.max(0, Math.trunc(num(p.orden) ?? 0)),
        estado: str(p.estado) ?? "pendiente",
        procesoId: num(p.proceso_id),
        procesoNombre,
        esExterno: Boolean(cat?.es_externo),
        maquinaNombre: str(maq?.nombre),
        tipoMaquina,
        fechaDisponible: dateIso(p.fecha_disponible),
        fechaInicio: dateIso(p.fecha_inicio),
        fechaFin: dateIso(p.fecha_fin),
        datosProceso:
          p.datos_proceso && typeof p.datos_proceso === "object" ? p.datos_proceso : null,
        ejecucion: ejec
          ? {
              estado: str(ejec.estado_ejecucion) ?? "—",
              inicioRealAt: dateIso(ejec.inicio_real_at),
              finRealAt: dateIso(ejec.fin_real_at),
              horasReales: num(ejec.horas_reales),
              numHojasProducidas: num(ejec.num_hojas_producidas),
              cantidadUnidades: num(ejec.cantidad_unidades),
              maquinista: str(ejec.maquinista),
              incidencia: str(ejec.incidencia),
              accionCorrectiva: str(ejec.accion_correctiva),
              observaciones: str(ejec.observaciones),
              numPausas: Math.max(0, Math.trunc(num(ejec.num_pausas) ?? 0)),
              haEstadoPausada: Boolean(ejec.ha_estado_pausada),
              pausas: pausasByEjecId.get(str(ejec.id) ?? "") ?? [],
            }
          : null,
        externo: ext
          ? {
              estado: str(ext.estado),
              proveedorNombre: str(pickJoin(ext.prod_proveedores)?.nombre),
              acabadoNombre: str(pickJoin(ext.prod_cat_acabados)?.nombre),
              fechaEnvio: dateIso(ext.fecha_envio),
              fechaPrevista: dateIso(ext.fecha_prevista),
              fechaRecepcionMuelle: dateIso(ext.fecha_recepcion_muelle),
              hojasEnviadas: num(ext.hojas_enviadas),
              hojasRecibidasMuelle: num(ext.hojas_recibidas_muelle),
              unidades: num(ext.unidades),
              unidadesRecibidasMuelle: num(ext.unidades_recibidas_muelle),
              palets: num(ext.palets),
              paletsRecibidosMuelle: num(ext.palets_recibidos_muelle),
              observaciones: str(ext.observaciones),
            }
          : null,
      };
    });
  }

  return {
    otNumero: ot,
    otId,
    cliente: str(otRow?.cliente),
    trabajo: str(otRow?.titulo),
    cantidad: num(otRow?.cantidad),
    fechaEntrega: dateIso(str(otRow?.fecha_entrega)),
    estadoOt: resolveEstadoOtLabel(str(otRow?.estado_desc), pasos),
    despacho,
    pasos,
  };
}
