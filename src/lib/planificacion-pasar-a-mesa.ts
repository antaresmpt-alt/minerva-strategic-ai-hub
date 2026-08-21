/**
 * Bloque 11 PR1 — Enviar OT(s) a cola de Mesa (sin slot / máquina / fecha).
 * Extraído de Pool (`pasarAMesa`): solo `estado_pool = 'enviada_mesa'`.
 * No es «lanzar» a ejecución.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchOtMetaByNumPedidos,
  isPoolRowSelectableForMesa,
} from "@/lib/planificacion-contenedor-query";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import type { ProdOtTipo } from "@/types/prod-ots";

const TABLE_POOL = "prod_planificacion_pool";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_COMPRA = "prod_compra_material";

/** Filas de pool que pueden reenviarse a mesa o actualizarse. */
export const POOL_ESTADOS_PARA_MESA = [
  "pendiente",
  "enviada_mesa",
  "en_transito",
] as const;

export const MESA_ESTADOS_ACTIVOS = [
  "borrador",
  "confirmado",
  "en_ejecucion",
] as const;

export type PasarAMesaCandidate = {
  ot: string;
  otTipo: ProdOtTipo;
  hasCompraGenerada: boolean;
  hojasStockCartelado?: number;
  fechaEntrega?: string | null;
  materialStatus?: string | null;
  troquelStatus?: string | null;
  requiereTroquel?: boolean;
  acabadoPral?: string | null;
};

export type PasarAMesaResult = {
  enviadas: string[];
  yaEnMesa: string[];
  rechazadas: Array<{ ot: string; motivo: string }>;
};

export type PasarAMesaGateInfo = {
  ot: string;
  otTipo: ProdOtTipo;
  hasCompraGenerada: boolean;
  hojasStockCartelado: number;
  fechaEntrega: string | null;
};

type StockOtRow = {
  ot_numero: string | null;
  cantidad_reservada: number | null;
  prod_stock_palets: {
    cantidad_actual: number;
    es_prueba: boolean | null;
  } | null;
};

/**
 * Carga tipo OT + compra + hojas carteladas para el gate de envío a mesa.
 */
export async function fetchPasarAMesaGateByOt(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, PasarAMesaGateInfo>> {
  const out = new Map<string, PasarAMesaGateInfo>();
  const ots = [
    ...new Set(otNumeros.map((o) => String(o ?? "").trim()).filter(Boolean)),
  ];
  if (ots.length === 0) return out;

  const meta = await fetchOtMetaByNumPedidos(supabase, ots);

  const compraRows = await fetchAllInChunks(ots, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_COMPRA)
      .select("ot_numero")
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as Array<{ ot_numero?: string | null }>;
  });
  const hasCompra = new Set<string>();
  for (const r of compraRows) {
    const ot = String(r.ot_numero ?? "").trim();
    if (ot) hasCompra.add(ot);
  }

  const stockCarteladoByOt = new Map<string, number>();
  const stockOtData = await fetchAllInChunks(ots, 100, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_stock_palet_ots")
      .select(
        "ot_numero, cantidad_reservada, prod_stock_palets!palet_id(cantidad_actual, es_prueba)",
      )
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as unknown as StockOtRow[];
  });
  for (const r of stockOtData) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const palet = r.prod_stock_palets;
    if (!palet || palet.es_prueba) continue;
    if (palet.cantidad_actual <= 0) continue;
    const hojas =
      r.cantidad_reservada != null
        ? r.cantidad_reservada
        : palet.cantidad_actual;
    if (hojas > 0) {
      stockCarteladoByOt.set(ot, (stockCarteladoByOt.get(ot) ?? 0) + hojas);
    }
  }

  for (const ot of ots) {
    const m = meta.get(ot);
    out.set(ot, {
      ot,
      otTipo: m?.otTipo ?? "simple",
      hasCompraGenerada: hasCompra.has(ot),
      hojasStockCartelado: stockCarteladoByOt.get(ot) ?? 0,
      fechaEntrega: m?.fechaEntrega ?? null,
    });
  }
  return out;
}

/**
 * Pone OTs en cola de mesa (`enviada_mesa`) sin crear fila de planificación ni slot.
 */
export async function pasarOtsAColaMesa(
  supabase: SupabaseClient,
  candidates: readonly PasarAMesaCandidate[],
  opts?: { notas?: string },
): Promise<PasarAMesaResult> {
  const notas = opts?.notas?.trim() || "Enviada a cola de Mesa";
  const result: PasarAMesaResult = {
    enviadas: [],
    yaEnMesa: [],
    rechazadas: [],
  };

  const cleaned = candidates
    .map((c) => ({
      ...c,
      ot: String(c.ot ?? "").trim(),
    }))
    .filter((c) => c.ot.length > 0);

  if (cleaned.length === 0) return result;

  const accepted: PasarAMesaCandidate[] = [];
  for (const c of cleaned) {
    if (c.otTipo === "contenedor") {
      result.rechazadas.push({
        ot: c.ot,
        motivo: "El contenedor no se envía a mesa (sin itinerario ejecutable)",
      });
      continue;
    }
    if (
      !isPoolRowSelectableForMesa({
        otTipo: c.otTipo,
        hasCompraGenerada: c.hasCompraGenerada,
        hojasStockCartelado: c.hojasStockCartelado,
      })
    ) {
      result.rechazadas.push({
        ot: c.ot,
        motivo: "Sin compra ni stock cartelado",
      });
      continue;
    }
    accepted.push(c);
  }

  if (accepted.length === 0) return result;

  const ots = accepted.map((c) => c.ot);
  const { data: mesaExist, error: meErr } = await supabase
    .from(TABLE_MESA)
    .select("ot_numero")
    .in("ot_numero", ots)
    .in("estado_mesa", [...MESA_ESTADOS_ACTIVOS]);
  if (meErr) throw meErr;

  const enMesa = new Set(
    ((mesaExist ?? []) as Array<{ ot_numero: string | null }>)
      .map((x) => String(x.ot_numero ?? "").trim())
      .filter(Boolean),
  );

  const nuevos = accepted.filter((c) => {
    if (enMesa.has(c.ot)) {
      result.yaEnMesa.push(c.ot);
      return false;
    }
    return true;
  });

  if (nuevos.length === 0) return result;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const actorId =
    typeof user?.id === "string" && user.id.trim().length > 0
      ? user.id.trim()
      : null;
  const actorEmail =
    typeof user?.email === "string" && user.email.trim().length > 0
      ? user.email.trim()
      : null;

  const { data: poolExist, error: poolErr } = await supabase
    .from(TABLE_POOL)
    .select("id, ot_numero")
    .in(
      "ot_numero",
      nuevos.map((r) => r.ot),
    )
    .in("estado_pool", [...POOL_ESTADOS_PARA_MESA]);
  if (poolErr) throw poolErr;

  const poolByOt = new Map<string, string>();
  for (const p of (poolExist ?? []) as Array<{ id: string; ot_numero: string }>) {
    const ot = String(p.ot_numero ?? "").trim();
    if (ot) poolByOt.set(ot, p.id);
  }

  for (const item of nuevos) {
    const poolId = poolByOt.get(item.ot);
    if (!poolId) continue;
    const { error: updErr } = await supabase
      .from(TABLE_POOL)
      .update({
        estado_pool: "enviada_mesa",
        troquel_status: item.troquelStatus ?? null,
        acabado_pral_snapshot: item.acabadoPral || null,
        closed_at: null,
        closed_by: null,
        closed_by_email: null,
        notas,
      })
      .eq("id", poolId);
    if (updErr) throw updErr;
    result.enviadas.push(item.ot);
  }

  const insPool = nuevos
    .filter((r) => !poolByOt.has(r.ot))
    .map((r) => ({
      ot_numero: r.ot,
      estado_pool: "enviada_mesa",
      prioridad_snapshot: null,
      fecha_entrega_snapshot: r.fechaEntrega ?? null,
      material_status: r.materialStatus ?? null,
      troquel_status: r.troquelStatus ?? null,
      requiere_troquel: Boolean(r.requiereTroquel),
      acabado_pral_snapshot: r.acabadoPral || null,
      notas,
      created_by: actorId,
      created_by_email: actorEmail,
    }));

  if (insPool.length > 0) {
    const { error: insPoolErr } = await supabase.from(TABLE_POOL).insert(insPool);
    if (insPoolErr) throw insPoolErr;
    for (const row of insPool) {
      result.enviadas.push(row.ot_numero);
    }
  }

  return result;
}
