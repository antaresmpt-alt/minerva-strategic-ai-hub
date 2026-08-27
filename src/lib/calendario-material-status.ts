/**
 * Semáforo material para calendario (Bloque 11).
 * Misma regla que Pool v2 (cartelas + muelle), más «gris» si no despachada / N/A.
 * No bloquea colocar pastillas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import type { MaterialStatus } from "@/types/planificacion-mesa";

export type CalendarioMaterialStatus = MaterialStatus | "gris";

export type CalendarioMaterialInfo = {
  status: CalendarioMaterialStatus;
  /** Texto tooltip (compra / cartelas / muelle). */
  tooltip: string;
  hojasCarteladas: number;
  hojasObjetivo: number;
  hojasRecibidas: number;
  numCompra: string | null;
  compraEstado: string | null;
  despachada: boolean;
};

type StockOtRow = {
  ot_numero?: string | null;
  cantidad_reservada?: number | null;
  prod_stock_palets?: {
    cantidad_actual?: number | null;
    es_prueba?: boolean | null;
  } | null;
};

type CompraRow = {
  id: string;
  ot_numero?: string | null;
  num_compra?: string | null;
  estado?: string | null;
};

type RecepRow = {
  compra_id?: string | null;
  hojas_recibidas?: number | null;
};

type DespachoRow = {
  ot_numero?: string | null;
  num_hojas_brutas?: number | null;
};

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function compraEstadoRank(estado: string | null | undefined): number {
  const e = String(estado ?? "").trim().toLowerCase();
  if (!e) return 0;
  if (e.includes("recib")) return 50;
  if (e.includes("parcial")) return 40;
  if (e.includes("envi") || e.includes("tránsito") || e.includes("transito")) return 30;
  if (e.includes("pedido") || e.includes("confirm")) return 20;
  if (e.includes("borrador")) return 10;
  return 5;
}

/**
 * Regla Pool Bloque 9.4 (+ gris calendario):
 * - gris: sin despacho (material no aplica aún)
 * - verde: cartelado ≥ objetivo
 * - amarillo: algo cartelado (insuficiente) o solo muelle
 * - rojo: despachada sin cartelas ni muelle
 */
export function resolveCalendarioMaterialStatus(args: {
  despachada: boolean;
  hojasCarteladas: number;
  hojasObjetivo: number;
  hojasRecibidas: number;
}): CalendarioMaterialStatus {
  if (!args.despachada) return "gris";
  const cart = Math.max(0, Math.trunc(args.hojasCarteladas));
  const obj = Math.max(0, Math.trunc(args.hojasObjetivo));
  const recv = Math.max(0, Math.trunc(args.hojasRecibidas));
  if (cart > 0 && obj > 0 && cart >= obj) return "verde";
  if (cart > 0) return "amarillo";
  if (recv > 0) return "amarillo";
  return "rojo";
}

export function labelCalendarioMaterialStatus(
  status: CalendarioMaterialStatus,
): string {
  switch (status) {
    case "verde":
      return "Material OK (cartelado)";
    case "amarillo":
      return "Material parcial / muelle";
    case "rojo":
      return "Material crítico";
    case "gris":
    default:
      return "Material N/A";
  }
}

export function calendarioMaterialDotClass(
  status: CalendarioMaterialStatus,
): string {
  switch (status) {
    case "verde":
      return "border-emerald-400 bg-emerald-100 text-emerald-800";
    case "amarillo":
      return "border-amber-400 bg-amber-100 text-amber-900";
    case "rojo":
      return "border-red-400 bg-red-100 text-red-800";
    case "gris":
    default:
      return "border-slate-300 bg-slate-100 text-slate-500";
  }
}

export function buildCalendarioMaterialTooltip(
  info: Pick<
    CalendarioMaterialInfo,
    | "status"
    | "hojasCarteladas"
    | "hojasObjetivo"
    | "hojasRecibidas"
    | "numCompra"
    | "compraEstado"
    | "despachada"
  >,
): string {
  const head = labelCalendarioMaterialStatus(info.status);
  if (!info.despachada) {
    return `${head} — sin despachar (no bloquea calendario)`;
  }
  const parts: string[] = [head];
  if (info.hojasObjetivo > 0 || info.hojasCarteladas > 0) {
    parts.push(
      `Cartelas ${new Intl.NumberFormat("es-ES").format(info.hojasCarteladas)} / ${new Intl.NumberFormat("es-ES").format(info.hojasObjetivo)} hj`,
    );
  }
  if (info.hojasRecibidas > 0) {
    parts.push(
      `Muelle ${new Intl.NumberFormat("es-ES").format(info.hojasRecibidas)} hj`,
    );
  }
  if (info.numCompra) {
    parts.push(
      `Compra ${info.numCompra}${info.compraEstado ? ` · ${info.compraEstado}` : ""}`,
    );
  } else if (info.compraEstado) {
    parts.push(info.compraEstado);
  } else {
    parts.push("Sin compra");
  }
  return parts.join(" · ");
}

/** Batch para pastillas visibles del calendario. */
export async function fetchCalendarioMaterialByOtNumeros(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, CalendarioMaterialInfo>> {
  const ots = [
    ...new Set(otNumeros.map((o) => String(o ?? "").trim()).filter(Boolean)),
  ];
  const out = new Map<string, CalendarioMaterialInfo>();
  if (ots.length === 0) return out;

  const despRows = await fetchAllInChunks(ots, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("produccion_ot_despachadas")
      .select("ot_numero, num_hojas_brutas")
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as DespachoRow[];
  });

  const objetivoByOt = new Map<string, number>();
  const despachadas = new Set<string>();
  for (const d of despRows) {
    const ot = String(d.ot_numero ?? "").trim();
    if (!ot) continue;
    despachadas.add(ot);
    objetivoByOt.set(ot, Math.trunc(parseNum(d.num_hojas_brutas)));
  }

  const stockCarteladoByOt = new Map<string, number>();
  const stockOtData = await fetchAllInChunks(ots, 80, async (chunk) => {
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
    if (parseNum(palet.cantidad_actual) <= 0) continue;
    const hojas =
      r.cantidad_reservada != null
        ? parseNum(r.cantidad_reservada)
        : parseNum(palet.cantidad_actual);
    if (hojas > 0) {
      stockCarteladoByOt.set(ot, (stockCarteladoByOt.get(ot) ?? 0) + hojas);
    }
  }

  const compraData = await fetchAllInChunks(ots, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_compra_material")
      .select("id, ot_numero, num_compra, estado")
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as CompraRow[];
  });

  const compraIdsByOt = new Map<string, string[]>();
  const compraNumByOt = new Map<string, string>();
  const compraEstadoByOt = new Map<string, string>();
  const compraIds: string[] = [];
  for (const c of compraData) {
    const ot = String(c.ot_numero ?? "").trim();
    if (!ot) continue;
    const id = String(c.id ?? "").trim();
    if (!id) continue;
    const arr = compraIdsByOt.get(ot) ?? [];
    arr.push(id);
    compraIdsByOt.set(ot, arr);
    compraIds.push(id);
    if (!compraNumByOt.has(ot)) {
      const nc = String(c.num_compra ?? "").trim();
      if (nc) compraNumByOt.set(ot, nc);
    }
    const estadoRaw = String(c.estado ?? "").trim();
    if (estadoRaw) {
      const prev = compraEstadoByOt.get(ot);
      if (!prev || compraEstadoRank(estadoRaw) > compraEstadoRank(prev)) {
        compraEstadoByOt.set(ot, estadoRaw);
      }
    }
  }

  const recepByCompra = new Map<string, number>();
  if (compraIds.length > 0) {
    const recData = await fetchAllInChunks(compraIds, 80, async (chunk) => {
      const { data, error } = await supabase
        .from("prod_recepciones_material")
        .select("compra_id, hojas_recibidas")
        .in("compra_id", chunk);
      if (error) throw error;
      return (data ?? []) as RecepRow[];
    });
    for (const r of recData) {
      const cid = String(r.compra_id ?? "").trim();
      if (!cid) continue;
      recepByCompra.set(
        cid,
        (recepByCompra.get(cid) ?? 0) + parseNum(r.hojas_recibidas),
      );
    }
  }

  for (const ot of ots) {
    const despachada = despachadas.has(ot);
    const hojasCarteladas = stockCarteladoByOt.get(ot) ?? 0;
    const hojasObjetivo = objetivoByOt.get(ot) ?? 0;
    const cids = compraIdsByOt.get(ot) ?? [];
    const hojasRecibidas = Math.trunc(
      cids.reduce((acc, id) => acc + (recepByCompra.get(id) ?? 0), 0),
    );
    const status = resolveCalendarioMaterialStatus({
      despachada,
      hojasCarteladas,
      hojasObjetivo,
      hojasRecibidas,
    });
    const base = {
      status,
      hojasCarteladas,
      hojasObjetivo,
      hojasRecibidas,
      numCompra: compraNumByOt.get(ot) ?? null,
      compraEstado: compraEstadoByOt.get(ot) ?? null,
      despachada,
    };
    out.set(ot, {
      ...base,
      tooltip: buildCalendarioMaterialTooltip(base),
    });
  }

  return out;
}
