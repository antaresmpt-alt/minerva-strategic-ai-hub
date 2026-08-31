/**
 * Pool entrada etiquetas digital (Bloque 5 v1).
 * Bandeja: OTs etiqueta en maestro no presentes en hoja de ruta ni en la cola.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizaOtNumero } from "@/lib/etiquetas-hoja-ruta-duplicados";
import { PROCESOS_ETIQUETA_DIGITAL_IDS } from "@/lib/hoja-ruta-campos-config";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import {
  buildOptimusImportAllowedKeysFromChecks,
  createDefaultOptimusImportEstadoChecks,
  normalizeOptimusEstadoLabelKey,
} from "@/lib/prod-ots-optimus-import";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type { ProdEtiquetasPoolPlanRow } from "@/types/prod-etiquetas-pool-plan";

const TABLE_MAESTRO = "prod_ots_general";
const TABLE_PASOS = "prod_ot_pasos";
const TABLE_HR = "prod_etiquetas_hoja_ruta";
const TABLE_POOL = "prod_etiquetas_pool_plan";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

const PROCESO_KONICA = 18;
const PROCESO_TROQ_ETIQUETA = 19;
const PROCESO_NUM_ETIQUETA = 20;
/** Impresión digital plana (Xerox Paula/Patricia) — no pool Hugo. */
const PROCESO_IMPRESION_DIGITAL_PLANO = 2;

/** Máximo de OTs etiqueta recientes a evaluar en maestro (sin itinerario). */
const MAESTRO_ETIQUETA_SCAN_LIMIT = 800;

/** OTs anteriores a esta fecha se excluyen de la bandeja (pre-import Hugo dic 2025). */
export const POOL_BANDEJA_FECHA_MINIMA = "2025-12-15";

const POOL_BANDEJA_ESTADOS_OPTIMUS_PERMITIDOS =
  buildOptimusImportAllowedKeysFromChecks(createDefaultOptimusImportEstadoChecks());

export type EtiquetasMaquinaFlags = {
  konica: boolean;
  troqueladora: boolean;
  numeradora: boolean;
};

export type EtiquetasPoolCandidata = {
  otGeneralId: string;
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  cantidad: number | null;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  despachada: boolean;
  despachadoAt: string | null;
  materialDespacho: string | null;
  /** Pasos previstos en itinerario (I/T/N) — no confundir con ejecución en HR. */
  itinerario: EtiquetasMaquinaFlags;
};

export type EtiquetasPoolPlanItem = EtiquetasPoolCandidata & {
  id: string;
  orden: number;
};

export type EtiquetasPoolEnCursoItem = {
  hrId: string;
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  fechaEntrega: string | null;
  itinerario: EtiquetasMaquinaFlags;
  hecho: EtiquetasMaquinaFlags;
};

export type EtiquetasPoolOtDetalle = {
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  cantidad: number | null;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  estadoDesc: string | null;
  tipoPedido: string | null;
  familia: string | null;
  vendedor: string | null;
  pedidoCliente: string | null;
  despachada: boolean;
  materialDespacho: string | null;
  itinerario: EtiquetasMaquinaFlags;
};

export function maquinaFlagsFromProcesoIds(
  procesoIds: Iterable<number>,
): EtiquetasMaquinaFlags {
  const set = new Set(procesoIds);
  return {
    konica: set.has(PROCESO_KONICA),
    troqueladora: set.has(PROCESO_TROQ_ETIQUETA),
    numeradora: set.has(PROCESO_NUM_ETIQUETA),
  };
}

/** Etiqueta corta I/T/N para badges de itinerario. */
export function labelItinerarioEtiquetas(flags: EtiquetasMaquinaFlags): string {
  const parts: string[] = [];
  if (flags.konica) parts.push("I");
  if (flags.troqueladora) parts.push("T");
  if (flags.numeradora) parts.push("N");
  return parts.length > 0 ? parts.join("·") : "—";
}

export function isOtMaestroAbierta(estadoDesc: string | null | undefined): boolean {
  const s = String(estadoDesc ?? "").trim().toLowerCase();
  if (!s) return true;
  if (
    s.includes("cerrad") ||
    s.includes("producid") ||
    s.includes("anulad") ||
    s.includes("cancelad")
  ) {
    return false;
  }
  return true;
}

/** Estados Optimus activos para bandeja (En producción, No empezado, Actualmente activo). */
export function isOtEstadoOptimusElegibleBandeja(
  estadoDesc: string | null | undefined,
): boolean {
  const s = String(estadoDesc ?? "").trim();
  if (!s) return true;

  const key = normalizeOptimusEstadoLabelKey(s);
  if (key === normalizeOptimusEstadoLabelKey("Terminado")) return false;
  if (key === normalizeOptimusEstadoLabelKey("Suspendido")) return false;
  if (key === normalizeOptimusEstadoLabelKey("Cancelado")) return false;
  if (POOL_BANDEJA_ESTADOS_OPTIMUS_PERMITIDOS.has(key)) return true;

  return isOtMaestroAbierta(s);
}

export function isOtFechaMinimaBandeja(row: {
  fecha_entrega?: string | null;
  fecha_apertura?: string | null;
}): boolean {
  const ymd =
    fechaMaestroToYmd(row.fecha_entrega) ?? fechaMaestroToYmd(row.fecha_apertura);
  if (!ymd) return false;
  return ymd >= POOL_BANDEJA_FECHA_MINIMA;
}

/**
 * Bandeja pool: al menos un paso de etiquetas Hugo en itinerario Hub
 * (Impresión Konica 18, Troq etiqueta 19, Num etiqueta 20).
 */
export function tieneItinerarioEtiquetasHugo(
  itinerario: EtiquetasMaquinaFlags,
): boolean {
  return itinerario.konica || itinerario.troqueladora || itinerario.numeradora;
}

/**
 * Excluye de bandeja etiquetas Xerox: impresión digital plana (paso 2) sin
 * Konica/Troq/Num. Las etiquetas Hugo sin pasos aún importados en Hub entran.
 */
export function isOtExcluidaBandejaXerox(procesoIds: readonly number[]): boolean {
  if (tieneItinerarioEtiquetasHugo(maquinaFlagsFromProcesoIds(procesoIds))) {
    return false;
  }
  return procesoIds.includes(PROCESO_IMPRESION_DIGITAL_PLANO);
}

/** Itinerario I/T/N para semáforo: si no hay pasos en maestro, asume I+T+N (etiqueta digital). */
export function resolveSemaforoItinerario(
  itinerario: EtiquetasMaquinaFlags,
): EtiquetasMaquinaFlags {
  if (itinerario.konica || itinerario.troqueladora || itinerario.numeradora) {
    return itinerario;
  }
  return { konica: true, troqueladora: true, numeradora: true };
}

/** OT identificada como etiqueta en maestro (sin exigir itinerario). */
export function isOtMaestroEtiquetaDigital(row: {
  tipo_pedido?: string | null;
  familia?: string | null;
  titulo?: string | null;
}): boolean {
  const tipo = String(row.tipo_pedido ?? "")
    .trim()
    .toLowerCase();
  if (tipo.includes("etiquet")) return true;
  const familia = String(row.familia ?? "")
    .trim()
    .toLowerCase();
  if (familia.includes("etiquet")) return true;
  const titulo = String(row.titulo ?? "")
    .trim()
    .toLowerCase();
  if (titulo.includes("etiqueta")) return true;
  return false;
}

function fechaMaestroToYmd(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type MaestroRow = {
  id: string;
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
  fecha_entrega: string | null;
  fecha_apertura?: string | null;
  estado_desc: string | null;
  despachado: boolean | null;
  tipo_pedido?: string | null;
  familia?: string | null;
  vendedor?: string | null;
  pedido_cliente?: string | null;
};

type PasoRow = {
  ot_id: string;
  proceso_id: number;
};

type DespRow = {
  ot_numero: string | null;
  material: string | null;
  despachado_at?: string | null;
};

function buildCandidataFromMaestro(
  m: MaestroRow,
  procesoIdsByOtId: ReadonlyMap<string, number[]>,
  despachoByOt: ReadonlyMap<string, DespRow>,
): EtiquetasPoolCandidata | null {
  if (!isOtEstadoOptimusElegibleBandeja(m.estado_desc)) return null;
  if (!isOtFechaMinimaBandeja(m)) return null;
  const otNumero = normalizaOtNumero(m.num_pedido);
  if (!otNumero) return null;

  const desp = despachoByOt.get(otNumero);
  const despachada =
    Boolean(m.despachado) ||
    Boolean(desp?.despachado_at) ||
    Boolean(desp?.material?.trim());

  return {
    otGeneralId: m.id,
    otNumero,
    cliente: m.cliente,
    trabajo: m.titulo,
    cantidad: m.cantidad,
    fechaEntrega: fechaMaestroToYmd(m.fecha_entrega),
    fechaApertura: fechaMaestroToYmd(m.fecha_apertura),
    despachada,
    despachadoAt: desp?.despachado_at ?? null,
    materialDespacho: desp?.material?.trim() || null,
    itinerario: maquinaFlagsFromProcesoIds(procesoIdsByOtId.get(m.id) ?? []),
  };
}

export function filterCandidatasBandeja(input: {
  candidatoOtIds: readonly string[];
  maestroByOtId: ReadonlyMap<string, MaestroRow>;
  procesoIdsByOtId: ReadonlyMap<string, number[]>;
  enHojaRuta: ReadonlySet<string>;
  enPool: ReadonlySet<string>;
  despachoByOt: ReadonlyMap<string, DespRow>;
  filtroTexto: string;
  /** Si true, excluye OTs de laboratorio (número ≥ 98.000). */
  omitirPruebas?: boolean;
}): EtiquetasPoolCandidata[] {
  const needle = input.filtroTexto.trim().toLowerCase();
  const out: EtiquetasPoolCandidata[] = [];
  const seen = new Set<string>();

  for (const otId of input.candidatoOtIds) {
    const m = input.maestroByOtId.get(otId);
    if (!m) continue;

    const candidata = buildCandidataFromMaestro(
      m,
      input.procesoIdsByOtId,
      input.despachoByOt,
    );
    if (!candidata) continue;
    if (seen.has(candidata.otNumero)) continue;
    if (input.enHojaRuta.has(candidata.otNumero)) continue;
    if (input.enPool.has(candidata.otNumero)) continue;
    if (input.omitirPruebas && isOtNumeroPrueba(candidata.otNumero)) continue;
    const procesoIds = input.procesoIdsByOtId.get(otId) ?? [];
    if (isOtExcluidaBandejaXerox(procesoIds)) continue;

    if (needle) {
      const hay = [candidata.otNumero, candidata.cliente, candidata.trabajo]
        .map((x) => String(x ?? "").toLowerCase())
        .some((x) => x.includes(needle));
      if (!hay) continue;
    }

    seen.add(candidata.otNumero);
    out.push(candidata);
  }

  out.sort((a, b) => {
    const fa = a.fechaApertura ?? a.fechaEntrega ?? "";
    const fb = b.fechaApertura ?? b.fechaEntrega ?? "";
    if (fa !== fb) return fb.localeCompare(fa);
    return b.otNumero.localeCompare(a.otNumero);
  });

  return out;
}

export function mergePlanConCandidatas(
  planRows: ProdEtiquetasPoolPlanRow[],
  candidataByOt: ReadonlyMap<string, EtiquetasPoolCandidata>,
): EtiquetasPoolPlanItem[] {
  const sorted = [...planRows].sort(
    (a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at),
  );
  const out: EtiquetasPoolPlanItem[] = [];

  for (const p of sorted) {
    const ot = normalizaOtNumero(p.ot_numero);
    const base = candidataByOt.get(ot);
    if (base) {
      out.push({ ...base, id: p.id, orden: p.orden });
      continue;
    }
    out.push({
      otGeneralId: "",
      otNumero: ot,
      cliente: null,
      trabajo: null,
      cantidad: null,
      fechaEntrega: null,
      fechaApertura: null,
      despachada: false,
      despachadoAt: null,
      materialDespacho: null,
      itinerario: { konica: false, troqueladora: false, numeradora: false },
      id: p.id,
      orden: p.orden,
    });
  }

  return out;
}

export function buildEnCursoItems(
  hrRows: ProdEtiquetasHojaRutaRow[],
  procesoIdsByOtId: ReadonlyMap<string, number[]>,
  maestroByOtId: ReadonlyMap<string, MaestroRow>,
): EtiquetasPoolEnCursoItem[] {
  const activas = hrRows.filter((r) => !r.finalizado);
  const out: EtiquetasPoolEnCursoItem[] = [];

  for (const r of activas) {
    const otNumero = normalizaOtNumero(r.ot_numero);
    if (!otNumero) continue;

    let itinerario: EtiquetasMaquinaFlags = {
      konica: false,
      troqueladora: false,
      numeradora: false,
    };
    if (r.ot_general_id) {
      itinerario = maquinaFlagsFromProcesoIds(
        procesoIdsByOtId.get(r.ot_general_id) ?? [],
      );
    } else {
      const m = [...maestroByOtId.values()].find(
        (row) => normalizaOtNumero(row.num_pedido) === otNumero,
      );
      if (m) {
        itinerario = maquinaFlagsFromProcesoIds(
          procesoIdsByOtId.get(m.id) ?? [],
        );
      }
    }

    out.push({
      hrId: r.id,
      otNumero,
      cliente: r.cliente,
      trabajo: r.trabajo,
      fechaEntrega: r.fecha_entrega_ot,
      itinerario,
      hecho: {
        konica: r.konica,
        troqueladora: r.troqueladora,
        numeradora: r.numeradora,
      },
    });
  }

  out.sort((a, b) => {
    const fa = a.fechaEntrega ?? "9999-99-99";
    const fb = b.fechaEntrega ?? "9999-99-99";
    if (fa !== fb) return fa.localeCompare(fb);
    return a.otNumero.localeCompare(b.otNumero);
  });

  return out;
}

async function fetchProcesoIdsByOtId(
  supabase: SupabaseClient,
): Promise<Map<string, number[]>> {
  const procesoIds = [
    ...PROCESOS_ETIQUETA_DIGITAL_IDS,
    PROCESO_IMPRESION_DIGITAL_PLANO,
  ];
  const { data, error } = await supabase
    .from(TABLE_PASOS)
    .select("ot_id, proceso_id")
    .in("proceso_id", procesoIds);
  if (error) throw error;

  const map = new Map<string, number[]>();
  for (const row of (data ?? []) as PasoRow[]) {
    const otId = String(row.ot_id ?? "").trim();
    if (!otId) continue;
    const list = map.get(otId) ?? [];
    if (!list.includes(row.proceso_id)) list.push(row.proceso_id);
    map.set(otId, list);
  }
  return map;
}

const MAESTRO_SELECT_FIELDS =
  "id, num_pedido, cliente, titulo, cantidad, fecha_entrega, fecha_apertura, estado_desc, despachado, tipo_pedido, familia, vendedor, pedido_cliente";

async function fetchMaestroEtiquetaRows(
  supabase: SupabaseClient,
): Promise<MaestroRow[]> {
  const { data, error } = await supabase
    .from(TABLE_MAESTRO)
    .select(MAESTRO_SELECT_FIELDS)
    .or(
      "tipo_pedido.ilike.%etiquet%,familia.ilike.%etiquet%,titulo.ilike.%ETIQUETA%",
    )
    .or(
      `fecha_entrega.gte.${POOL_BANDEJA_FECHA_MINIMA},fecha_apertura.gte.${POOL_BANDEJA_FECHA_MINIMA}`,
    )
    .order("fecha_apertura", { ascending: false, nullsFirst: false })
    .order("num_pedido", { ascending: false })
    .limit(MAESTRO_ETIQUETA_SCAN_LIMIT);
  if (error) throw error;
  return (data ?? []) as MaestroRow[];
}

export type EtiquetasPoolSnapshotOptions = {
  filtroTexto?: string;
  /** Por defecto true: oculta OTs ≥ 98.000 en bandeja. */
  omitirPruebas?: boolean;
};

export async function fetchEtiquetasPoolSnapshot(
  supabase: SupabaseClient,
  options: EtiquetasPoolSnapshotOptions | string = "",
): Promise<{
  candidatas: EtiquetasPoolCandidata[];
  plan: EtiquetasPoolPlanItem[];
  enCurso: EtiquetasPoolEnCursoItem[];
  candidataByOt: Map<string, EtiquetasPoolCandidata>;
}> {
  const filtroTexto =
    typeof options === "string" ? options : (options.filtroTexto ?? "");
  const omitirPruebas =
    typeof options === "string" ? true : (options.omitirPruebas ?? true);

  const procesoIdsByOtId = await fetchProcesoIdsByOtId(supabase);
  const maestroEtiquetaRows = await fetchMaestroEtiquetaRows(supabase);

  const pasoOtIds = [...procesoIdsByOtId.keys()];
  const maestroFromPasos =
    pasoOtIds.length > 0
      ? await fetchAllInChunks(pasoOtIds, 100, async (chunk) => {
          const { data, error } = await supabase
            .from(TABLE_MAESTRO)
            .select(MAESTRO_SELECT_FIELDS)
            .in("id", chunk);
          if (error) throw error;
          return (data ?? []) as MaestroRow[];
        })
      : [];

  const maestroByOtId = new Map<string, MaestroRow>();
  for (const m of [...maestroEtiquetaRows, ...maestroFromPasos]) {
    if (!isOtMaestroEtiquetaDigital(m) && !procesoIdsByOtId.has(m.id)) continue;
    maestroByOtId.set(m.id, m);
  }

  const candidatoOtIds = [...maestroByOtId.keys()];
  const otNumeros = [
    ...new Set(
      [...maestroByOtId.values()]
        .map((m) => normalizaOtNumero(m.num_pedido))
        .filter(Boolean),
    ),
  ];

  const { data: hrData, error: hrErr } = await supabase
    .from(TABLE_HR)
    .select("*")
    .order("fecha_entrada_depto", { ascending: false });
  if (hrErr) throw hrErr;
  const hrRows = (hrData ?? []) as ProdEtiquetasHojaRutaRow[];
  const enHojaRuta = new Set(
    hrRows.map((r) => normalizaOtNumero(r.ot_numero)).filter(Boolean),
  );

  const { data: poolData, error: poolErr } = await supabase
    .from(TABLE_POOL)
    .select("*")
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (poolErr) {
    const msg = String(poolErr.message ?? "");
    const missingTable =
      poolErr.code === "42P01" ||
      msg.includes("prod_etiquetas_pool_plan") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache");
    if (!missingTable) throw poolErr;
  }
  const planRows = (poolData ?? []) as ProdEtiquetasPoolPlanRow[];
  const enPool = new Set(planRows.map((p) => normalizaOtNumero(p.ot_numero)));

  const despachoRows =
    otNumeros.length > 0
      ? await fetchAllInChunks(otNumeros, 100, async (chunk) => {
          const { data, error } = await supabase
            .from(TABLE_DESPACHADAS)
            .select("ot_numero, material, despachado_at")
            .in("ot_numero", chunk);
          if (error) throw error;
          return (data ?? []) as DespRow[];
        })
      : [];
  const despachoByOt = new Map<string, DespRow>();
  for (const d of despachoRows) {
    const ot = normalizaOtNumero(d.ot_numero);
    if (ot && !despachoByOt.has(ot)) despachoByOt.set(ot, d);
  }

  const candidatas = filterCandidatasBandeja({
    candidatoOtIds,
    maestroByOtId,
    procesoIdsByOtId,
    enHojaRuta,
    enPool,
    despachoByOt,
    filtroTexto,
    omitirPruebas,
  });

  const candidataByOt = new Map(candidatas.map((c) => [c.otNumero, c]));
  for (const p of planRows) {
    const ot = normalizaOtNumero(p.ot_numero);
    if (candidataByOt.has(ot)) continue;
    const m = [...maestroByOtId.values()].find(
      (row) => normalizaOtNumero(row.num_pedido) === ot,
    );
    if (!m) continue;
    const built = buildCandidataFromMaestro(m, procesoIdsByOtId, despachoByOt);
    if (built) candidataByOt.set(ot, built);
  }

  const plan = mergePlanConCandidatas(planRows, candidataByOt);
  const enCurso = buildEnCursoItems(hrRows, procesoIdsByOtId, maestroByOtId);

  return { candidatas, plan, enCurso, candidataByOt };
}

export async function addOtToPoolPlan(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<void> {
  const ot = normalizaOtNumero(otNumero);
  if (!ot) throw new Error("OT no válida.");

  const { data: maxRow, error: maxErr } = await supabase
    .from(TABLE_POOL)
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw maxErr;

  const nextOrden =
    maxRow && typeof (maxRow as { orden?: number }).orden === "number"
      ? (maxRow as { orden: number }).orden + 1
      : 0;

  const { error } = await supabase.from(TABLE_POOL).insert({
    ot_numero: ot,
    orden: nextOrden,
  } as never);
  if (error) {
    if (error.code === "23505") {
      throw new Error(`La OT ${ot} ya está en el plan del día.`);
    }
    throw error;
  }
}

export async function removeOtFromPoolPlan(
  supabase: SupabaseClient,
  poolId: string,
): Promise<void> {
  const { error } = await supabase.from(TABLE_POOL).delete().eq("id", poolId);
  if (error) throw error;
}

export async function removeOtFromPoolPlanByOtNumero(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<void> {
  const ot = normalizaOtNumero(otNumero);
  if (!ot) return;
  const { error } = await supabase.from(TABLE_POOL).delete().eq("ot_numero", ot);
  if (error) throw error;
}

export async function fetchMaestroOtDetalle(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<EtiquetasPoolOtDetalle | null> {
  const ot = normalizaOtNumero(otNumero);
  if (!ot) return null;

  const { data, error } = await supabase
    .from(TABLE_MAESTRO)
    .select(MAESTRO_SELECT_FIELDS)
    .eq("num_pedido", ot)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const m = data as MaestroRow;
  const procesoIdsByOtId = await fetchProcesoIdsByOtId(supabase);
  const itinerario = maquinaFlagsFromProcesoIds(procesoIdsByOtId.get(m.id) ?? []);

  const { data: despData } = await supabase
    .from(TABLE_DESPACHADAS)
    .select("ot_numero, material, despachado_at")
    .eq("ot_numero", ot)
    .maybeSingle();
  const desp = despData as DespRow | null;

  return {
    otNumero: ot,
    cliente: m.cliente,
    trabajo: m.titulo,
    cantidad: m.cantidad,
    fechaEntrega: fechaMaestroToYmd(m.fecha_entrega),
    fechaApertura: fechaMaestroToYmd(m.fecha_apertura),
    estadoDesc: m.estado_desc,
    tipoPedido: m.tipo_pedido ?? null,
    familia: m.familia ?? null,
    vendedor: m.vendedor ?? null,
    pedidoCliente: m.pedido_cliente ?? null,
    despachada:
      Boolean(m.despachado) ||
      Boolean(desp?.despachado_at) ||
      Boolean(desp?.material?.trim()),
    materialDespacho: desp?.material?.trim() || null,
    itinerario,
  };
}

/** Devuelve una OT de hoja de ruta a la cola (borra fila HR y la reinserta en pool). */
export async function devolverEnCursoACola(
  supabase: SupabaseClient,
  hrId: string,
  otNumero: string,
): Promise<void> {
  const { error: delErr } = await supabase.from(TABLE_HR).delete().eq("id", hrId);
  if (delErr) throw delErr;

  try {
    await addOtToPoolPlan(supabase, otNumero);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("ya está en el plan")) throw e;
  }
}

export async function movePoolPlanItem(
  supabase: SupabaseClient,
  poolId: string,
  direction: "up" | "down",
  plan: ReadonlyArray<Pick<ProdEtiquetasPoolPlanRow, "id" | "orden">>,
): Promise<void> {
  const idx = plan.findIndex((p) => p.id === poolId);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= plan.length) return;

  const a = plan[idx]!;
  const b = plan[swapIdx]!;
  const { error: errA } = await supabase
    .from(TABLE_POOL)
    .update({ orden: b.orden } as never)
    .eq("id", a.id);
  if (errA) throw errA;
  const { error: errB } = await supabase
    .from(TABLE_POOL)
    .update({ orden: a.orden } as never)
    .eq("id", b.id);
  if (errB) throw errB;
}
