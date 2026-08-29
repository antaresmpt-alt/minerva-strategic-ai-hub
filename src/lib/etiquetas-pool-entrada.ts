/**
 * Pool entrada etiquetas digital (Bloque 5 v1).
 * Bandeja: OTs etiqueta en maestro no presentes en hoja de ruta ni en el plan del día.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findHojaRutaPorOtNumero,
  normalizaOtNumero,
} from "@/lib/etiquetas-hoja-ruta-duplicados";
import { PROCESOS_ETIQUETA_DIGITAL_IDS } from "@/lib/hoja-ruta-campos-config";
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
  despachada: boolean;
  despachadoAt: string | null;
  materialDespacho: string | null;
  maquinas: EtiquetasMaquinaFlags;
};

export type EtiquetasPoolPlanItem = EtiquetasPoolCandidata & {
  poolId: string;
  orden: number;
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

function fechaMaestroToYmd(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type MaestroRow = {
  id: string;
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
  fecha_entrega: string | null;
  estado_desc: string | null;
  despachado: boolean | null;
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

export function filterCandidatasBandeja(input: {
  maestroByOtId: ReadonlyMap<string, MaestroRow>;
  procesoIdsByOtId: ReadonlyMap<string, number[]>;
  enHojaRuta: ReadonlySet<string>;
  enPool: ReadonlySet<string>;
  despachoByOt: ReadonlyMap<string, DespRow>;
  filtroTexto: string;
}): EtiquetasPoolCandidata[] {
  const needle = input.filtroTexto.trim().toLowerCase();
  const out: EtiquetasPoolCandidata[] = [];

  for (const [otId, procesoIds] of input.procesoIdsByOtId) {
    const m = input.maestroByOtId.get(otId);
    if (!m) continue;
    if (!isOtMaestroAbierta(m.estado_desc)) continue;

    const otNumero = normalizaOtNumero(m.num_pedido);
    if (!otNumero) continue;
    if (input.enHojaRuta.has(otNumero)) continue;
    if (input.enPool.has(otNumero)) continue;

    if (needle) {
      const hay = [otNumero, m.cliente, m.titulo]
        .map((x) => String(x ?? "").toLowerCase())
        .some((x) => x.includes(needle));
      if (!hay) continue;
    }

    const desp = input.despachoByOt.get(otNumero);
    const despachada =
      Boolean(m.despachado) ||
      Boolean(desp?.despachado_at) ||
      Boolean(desp?.material?.trim());

    out.push({
      otGeneralId: m.id,
      otNumero,
      cliente: m.cliente,
      trabajo: m.titulo,
      cantidad: m.cantidad,
      fechaEntrega: fechaMaestroToYmd(m.fecha_entrega),
      despachada,
      despachadoAt: desp?.despachado_at ?? null,
      materialDespacho: desp?.material?.trim() || null,
      maquinas: maquinaFlagsFromProcesoIds(procesoIds),
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

export function mergePlanConCandidatas(
  planRows: ProdEtiquetasPoolPlanRow[],
  candidataByOt: ReadonlyMap<string, EtiquetasPoolCandidata>,
): EtiquetasPoolPlanItem[] {
  const sorted = [...planRows].sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at));
  const out: EtiquetasPoolPlanItem[] = [];

  for (const p of sorted) {
    const ot = normalizaOtNumero(p.ot_numero);
    const base = candidataByOt.get(ot);
    if (base) {
      out.push({ ...base, poolId: p.id, orden: p.orden });
      continue;
    }
    out.push({
      otGeneralId: "",
      otNumero: ot,
      cliente: null,
      trabajo: null,
      cantidad: null,
      fechaEntrega: null,
      despachada: false,
      despachadoAt: null,
      materialDespacho: null,
      maquinas: { konica: false, troqueladora: false, numeradora: false },
      poolId: p.id,
      orden: p.orden,
    });
  }

  return out;
}

async function fetchProcesoIdsByOtId(
  supabase: SupabaseClient,
): Promise<Map<string, number[]>> {
  const procesoIds = [...PROCESOS_ETIQUETA_DIGITAL_IDS];
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

export async function fetchEtiquetasPoolSnapshot(
  supabase: SupabaseClient,
  filtroTexto = "",
): Promise<{
  candidatas: EtiquetasPoolCandidata[];
  plan: EtiquetasPoolPlanItem[];
  candidataByOt: Map<string, EtiquetasPoolCandidata>;
}> {
  const procesoIdsByOtId = await fetchProcesoIdsByOtId(supabase);
  const otIds = [...procesoIdsByOtId.keys()];
  if (otIds.length === 0) {
    return { candidatas: [], plan: [], candidataByOt: new Map() };
  }

  const maestroRows = await fetchAllInChunks(otIds, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_MAESTRO)
      .select(
        "id, num_pedido, cliente, titulo, cantidad, fecha_entrega, estado_desc, despachado",
      )
      .in("id", chunk);
    if (error) throw error;
    return (data ?? []) as MaestroRow[];
  });

  const maestroByOtId = new Map<string, MaestroRow>();
  const otNumeros: string[] = [];
  for (const m of maestroRows) {
    maestroByOtId.set(m.id, m);
    const num = normalizaOtNumero(m.num_pedido);
    if (num) otNumeros.push(num);
  }

  const { data: hrData, error: hrErr } = await supabase
    .from(TABLE_HR)
    .select("ot_numero");
  if (hrErr) throw hrErr;
  const enHojaRuta = new Set(
    ((hrData ?? []) as { ot_numero: string }[]).map((r) =>
      normalizaOtNumero(r.ot_numero),
    ),
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

  const despachoRows = await fetchAllInChunks(otNumeros, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_DESPACHADAS)
      .select("ot_numero, material, despachado_at")
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as DespRow[];
  });
  const despachoByOt = new Map<string, DespRow>();
  for (const d of despachoRows) {
    const ot = normalizaOtNumero(d.ot_numero);
    if (ot && !despachoByOt.has(ot)) despachoByOt.set(ot, d);
  }

  const candidatas = filterCandidatasBandeja({
    maestroByOtId,
    procesoIdsByOtId,
    enHojaRuta,
    enPool,
    despachoByOt,
    filtroTexto,
  });

  const candidataByOt = new Map(candidatas.map((c) => [c.otNumero, c]));
  for (const p of planRows) {
    const ot = normalizaOtNumero(p.ot_numero);
    if (!candidataByOt.has(ot)) {
      const m = [...maestroByOtId.values()].find(
        (row) => normalizaOtNumero(row.num_pedido) === ot,
      );
      if (m) {
        const desp = despachoByOt.get(ot);
        candidataByOt.set(ot, {
          otGeneralId: m.id,
          otNumero: ot,
          cliente: m.cliente,
          trabajo: m.titulo,
          cantidad: m.cantidad,
          fechaEntrega: fechaMaestroToYmd(m.fecha_entrega),
          despachada:
            Boolean(m.despachado) ||
            Boolean(desp?.despachado_at) ||
            Boolean(desp?.material?.trim()),
          despachadoAt: desp?.despachado_at ?? null,
          materialDespacho: desp?.material?.trim() || null,
          maquinas: maquinaFlagsFromProcesoIds(procesoIdsByOtId.get(m.id) ?? []),
        });
      }
    }
  }

  const plan = mergePlanConCandidatas(planRows, candidataByOt);
  return { candidatas, plan, candidataByOt };
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

export async function iniciarOtEnHojaRutaDesdePool(
  supabase: SupabaseClient,
  item: Pick<
    EtiquetasPoolCandidata,
    | "otNumero"
    | "otGeneralId"
    | "cliente"
    | "trabajo"
    | "cantidad"
    | "fechaEntrega"
    | "materialDespacho"
    | "maquinas"
  >,
): Promise<ProdEtiquetasHojaRutaRow> {
  const ot = normalizaOtNumero(item.otNumero);
  if (!ot) throw new Error("OT no válida.");

  const existentes = await findHojaRutaPorOtNumero(supabase, ot);
  if (existentes.length > 0) {
    const err = new Error("DUPLICADO_HR") as Error & {
      existentes: ProdEtiquetasHojaRutaRow[];
    };
    err.existentes = existentes;
    throw err;
  }

  const row: Record<string, unknown> = {
    ot_numero: ot,
    ot_general_id: item.otGeneralId || null,
    cliente: item.cliente?.trim() || null,
    trabajo: item.trabajo?.trim() || null,
    papel: item.materialDespacho?.trim() || null,
    cantidad: item.cantidad,
    fecha_entrega_ot: item.fechaEntrega,
    fecha_entrada_depto: todayYmd(),
    urgencia: "normal",
    konica: item.maquinas.konica,
    troqueladora: item.maquinas.troqueladora,
    numeradora: item.maquinas.numeradora,
    fecha_fin_konica: null,
    fecha_fin_troqueladora: null,
    fecha_fin_numeradora: null,
    finalizado: false,
  };

  const { data, error } = await supabase
    .from(TABLE_HR)
    .insert(row as never)
    .select("*")
    .single();
  if (error) throw error;

  const inserted = data as ProdEtiquetasHojaRutaRow;
  await supabase.from(TABLE_POOL).delete().eq("ot_numero", ot);
  return inserted;
}
