import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_STOCK_QUERY_LIMIT,
  isStockAggregation,
  safeIlikeTerm,
  type StockQueryFilters,
} from "@/lib/stock-query-filters";
import { costeRemanentePalet } from "@/lib/stock-valoracion";
import type {
  StockPaletAtpConOts,
  StockPaletAtpRow,
  StockPaletOtChip,
} from "@/types/prod-stock";

function unwrapJoinRow(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first != null && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function proveedorFromNotas(notas: string | null | undefined): string | null {
  if (!notas) return null;
  const m = notas.match(/Proveedor:\s*(.+?)(?:\s*·|$)/i);
  return m?.[1]?.trim() ?? null;
}

function matchesProveedor(
  row: StockPaletAtpConOts,
  term: string,
): boolean {
  const t = term.toLowerCase();
  const prov = row.proveedor_nombre?.toLowerCase() ?? "";
  return prov.includes(t);
}

function matchesFormato(row: StockPaletAtpRow, term: string): boolean {
  const fmt = (row.formato ?? "").toLowerCase().replace(/×/g, "x");
  const t = term.toLowerCase().replace(/×/g, "x");
  return fmt.includes(t);
}

function applyMemoryFilters(
  rows: StockPaletAtpConOts[],
  filtros: StockQueryFilters,
): StockPaletAtpConOts[] {
  let out = rows;

  if (filtros.formato_contiene) {
    const t = filtros.formato_contiene;
    out = out.filter((r) => matchesFormato(r, t));
  }

  if (filtros.proveedor_contiene) {
    const t = filtros.proveedor_contiene;
    out = out.filter((r) => matchesProveedor(r, t));
  }

  if (filtros.ot_numero) {
    const ot = filtros.ot_numero;
    out = out.filter((r) => r.ots.some((o) => o.ot_numero === ot));
  }

  return out;
}

async function enrichStockRows(
  supabase: SupabaseClient,
  view: StockPaletAtpRow[],
): Promise<StockPaletAtpConOts[]> {
  if (!view.length) return [];

  const paletIds = view.map((v) => v.id);

  const { data: notasRows } = await supabase
    .from("prod_stock_palets")
    .select("id, notas")
    .in("id", paletIds);
  const notasById: Record<string, string | null> = {};
  for (const n of notasRows ?? []) {
    notasById[n.id as string] =
      typeof n.notas === "string" ? n.notas : null;
  }

  const { data: otsRows } = await supabase
    .from("prod_stock_palet_ots")
    .select("palet_id, ot_numero, cantidad_reservada")
    .in("palet_id", paletIds);

  const otsByPalet: Record<string, StockPaletOtChip[]> = {};
  for (const r of otsRows ?? []) {
    if (!otsByPalet[r.palet_id]) otsByPalet[r.palet_id] = [];
    otsByPalet[r.palet_id].push({
      ot_numero: r.ot_numero,
      cantidad_reservada: r.cantidad_reservada ?? null,
    });
  }

  const recepIds = [
    ...new Set(
      view.map((v) => v.recepcion_id).filter((x): x is string => !!x),
    ),
  ];
  const proveedorByRecep: Record<string, string | null> = {};
  if (recepIds.length > 0) {
    const { data: receps } = await supabase
      .from("prod_recepciones_material")
      .select("id, prod_compra_material(prod_proveedores(nombre))")
      .in("id", recepIds);
    for (const raw of (receps ?? []) as Record<string, unknown>[]) {
      const compra = unwrapJoinRow(raw.prod_compra_material);
      const prov = compra ? unwrapJoinRow(compra.prod_proveedores) : null;
      proveedorByRecep[String(raw.id)] =
        typeof prov?.nombre === "string" ? prov.nombre : null;
    }
  }

  return view.map((v) => {
    const provRecep = v.recepcion_id
      ? (proveedorByRecep[v.recepcion_id] ?? null)
      : null;
    const provNotas = proveedorFromNotas(notasById[v.id]);
    return {
      ...v,
      ots: otsByPalet[v.id] ?? [],
      proveedor_nombre: provRecep ?? provNotas,
    };
  });
}

export type StockQueryAggregation = {
  tipo: "contar" | "sumar_libre" | "sumar_fisico" | "sumar_reservado";
  valor: number;
  unidad: string;
};

export type StockAtpQueryResult = {
  rows: StockPaletAtpConOts[];
  totalMatches: number;
  truncated: boolean;
  aggregation?: StockQueryAggregation;
};

/** Ejecuta consulta segura sobre `stock_palets_atp` + filtros en memoria. */
export async function queryStockPaletsAtp(
  supabase: SupabaseClient,
  filtros: StockQueryFilters,
): Promise<StockAtpQueryResult> {
  const aggregating = isStockAggregation(filtros.agregacion);
  const fetchLimit = aggregating
    ? 2000
    : (filtros.limite ?? DEFAULT_STOCK_QUERY_LIMIT);

  let paletIdsForOt: string[] | null = null;
  if (filtros.ot_numero) {
    const { data: otRows, error: otErr } = await supabase
      .from("prod_stock_palet_ots")
      .select("palet_id")
      .eq("ot_numero", filtros.ot_numero);
    if (otErr) throw otErr;
    paletIdsForOt = [...new Set((otRows ?? []).map((r) => r.palet_id as string))];
    if (paletIdsForOt.length === 0) {
      return { rows: [], totalMatches: 0, truncated: false };
    }
  }

  let q = supabase.from("stock_palets_atp").select("*");

  if (!filtros.incluir_prueba) {
    q = q.eq("es_prueba", false);
  }
  if (filtros.id_stock != null) {
    q = q.eq("id_stock", filtros.id_stock);
  }
  if (paletIdsForOt) {
    q = q.in("id", paletIdsForOt);
  }
  if (filtros.material_contiene) {
    const t = safeIlikeTerm(filtros.material_contiene);
    q = q.or(
      `material_nombre.ilike.%${t}%,descripcion_material.ilike.%${t}%`,
    );
  }
  if (filtros.codigo_articulo_contiene) {
    const t = safeIlikeTerm(filtros.codigo_articulo_contiene);
    q = q.ilike("codigo_articulo", `%${t}%`);
  }
  if (filtros.ubicacion_fila) {
    q = q.ilike("ubicacion_fila", `%${filtros.ubicacion_fila}%`);
  }
  if (filtros.nota_entrega_contiene) {
    const t = safeIlikeTerm(filtros.nota_entrega_contiene);
    q = q.ilike("nota_entrega", `%${t}%`);
  }
  if (filtros.gramaje_exacto != null) {
    q = q.eq("gramaje", filtros.gramaje_exacto);
  } else {
    if (filtros.gramaje_min != null) q = q.gte("gramaje", filtros.gramaje_min);
    if (filtros.gramaje_max != null) q = q.lte("gramaje", filtros.gramaje_max);
  }
  if (filtros.libre_min != null) q = q.gte("cantidad_libre", filtros.libre_min);
  if (filtros.libre_max != null) q = q.lte("cantidad_libre", filtros.libre_max);
  if (filtros.fisico_min != null) q = q.gte("cantidad_fisica", filtros.fisico_min);
  if (filtros.fisico_max != null) q = q.lte("cantidad_fisica", filtros.fisico_max);
  if (filtros.reservado_min != null) {
    q = q.gte("cantidad_reservada_total", filtros.reservado_min);
  }
  if (filtros.sin_ot) {
    q = q.eq("ots_referenciadas", 0);
  }
  if (filtros.solo_libre) {
    q = q.gt("cantidad_libre", 0);
  }
  if (filtros.solo_reservado) {
    q = q.gt("cantidad_reservada_total", 0);
  }
  if (filtros.estado_derivado) {
    const estados = Array.isArray(filtros.estado_derivado)
      ? filtros.estado_derivado
      : [filtros.estado_derivado];
    q = q.in("estado_derivado", estados);
  }

  q = q.order("id_stock", { ascending: false }).limit(fetchLimit);

  const { data: view, error } = await q;
  if (error) throw error;

  const enriched = await enrichStockRows(
    supabase,
    (view ?? []) as StockPaletAtpRow[],
  );
  const filtered = applyMemoryFilters(enriched, filtros);
  const totalMatches = filtered.length;
  const truncated = aggregating
    ? totalMatches >= fetchLimit
    : totalMatches >= fetchLimit;

  let aggregation: StockQueryAggregation | undefined;
  if (filtros.agregacion === "contar") {
    aggregation = { tipo: "contar", valor: totalMatches, unidad: "palets" };
  } else if (filtros.agregacion === "sumar_libre") {
    aggregation = {
      tipo: "sumar_libre",
      valor: filtered.reduce((a, r) => a + r.cantidad_libre, 0),
      unidad: filtered[0]?.unidad ?? "hojas",
    };
  } else if (filtros.agregacion === "sumar_fisico") {
    aggregation = {
      tipo: "sumar_fisico",
      valor: filtered.reduce((a, r) => a + r.cantidad_fisica, 0),
      unidad: filtered[0]?.unidad ?? "hojas",
    };
  } else if (filtros.agregacion === "sumar_reservado") {
    aggregation = {
      tipo: "sumar_reservado",
      valor: filtered.reduce((a, r) => a + r.cantidad_reservada_total, 0),
      unidad: filtered[0]?.unidad ?? "hojas",
    };
  }

  const displayLimit = aggregating
    ? Math.min(30, filtered.length)
    : (filtros.limite ?? DEFAULT_STOCK_QUERY_LIMIT);

  return {
    rows: filtered.slice(0, displayLimit),
    totalMatches,
    truncated,
    aggregation,
  };
}

/** Fila compacta para respuesta API / UI del asistente. */
export type StockQueryResultRow = {
  id_stock: number;
  material: string | null;
  gramaje: number | null;
  formato: string | null;
  libre: number;
  reservado: number;
  fisico: number;
  unidad: string;
  estado: string;
  ubicacion: string | null;
  ots: string[];
  albaran: string | null;
  proveedor: string | null;
  coste_eur: number | null;
};

export function toStockQueryResultRows(
  rows: StockPaletAtpConOts[],
): StockQueryResultRow[] {
  return rows.map((r) => ({
    id_stock: r.id_stock,
    material: r.material_nombre ?? r.descripcion_material,
    gramaje: r.gramaje,
    formato: r.formato,
    libre: r.cantidad_libre,
    reservado: r.cantidad_reservada_total,
    fisico: r.cantidad_fisica,
    unidad: r.unidad,
    estado: r.estado_derivado,
    ubicacion: r.ubicacion_fila,
    ots: r.ots.map((o) => o.ot_numero),
    albaran: r.nota_entrega,
    proveedor: r.proveedor_nombre ?? null,
    coste_eur: costeRemanentePalet(
      r.coste,
      r.cantidad_inicial,
      r.cantidad_fisica,
    ),
  }));
}

export function buildStockQueryMarkdown(
  interpretacion: string,
  filtros: StockQueryFilters,
  result: StockAtpQueryResult,
): string {
  const lines: string[] = [];
  lines.push(`**Criterios:** ${interpretacion}`);

  if (result.aggregation) {
    const { tipo, valor, unidad } = result.aggregation;
    const label =
      tipo === "contar"
        ? "Palets encontrados"
        : tipo === "sumar_libre"
          ? "Hojas libres (ATP)"
          : tipo === "sumar_fisico"
            ? "Hojas físicas"
            : "Hojas reservadas";
    const suffix = tipo === "contar" ? "" : ` ${unidad}`;
    lines.push(`\n### ${label}: **${valor.toLocaleString("es-ES")}**${suffix}`);
    if (result.truncated) {
      lines.push(
        "\n> ⚠️ El cálculo puede estar incompleto (más de 2.000 palets en el conjunto).",
      );
    }
  } else {
    lines.push(
      `\n**Coincidencias:** ${result.totalMatches.toLocaleString("es-ES")} palet${result.totalMatches !== 1 ? "s" : ""}`,
    );
    if (result.truncated) {
      lines.push(
        `\n> Mostrando los primeros ${result.rows.length} resultados.`,
      );
    }
  }

  if (result.rows.length > 0 && result.aggregation?.tipo !== "contar") {
    lines.push("\n| Id | Material | Gr. | Formato | Libre | Físico | Estado |");
    lines.push("| --- | --- | ---: | --- | ---: | ---: | --- |");
    for (const r of result.rows) {
      const mat = (r.material_nombre ?? r.descripcion_material ?? "—").replace(
        /\|/g,
        "/",
      );
      lines.push(
        `| **${r.id_stock}** | ${mat} | ${r.gramaje ?? "—"} | ${r.formato ?? "—"} | ${r.cantidad_libre.toLocaleString("es-ES")} | ${r.cantidad_fisica.toLocaleString("es-ES")} | ${r.estado_derivado} |`,
      );
    }
  } else if (
    result.totalMatches === 0 &&
    Object.keys(filtros).length > 0
  ) {
    lines.push(
      "\nNo hay palets en stock que cumplan esos criterios (sin incluir cartelas de prueba salvo que lo pidas).",
    );
  }

  return lines.join("\n");
}
