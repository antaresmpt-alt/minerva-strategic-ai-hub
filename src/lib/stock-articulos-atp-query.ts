import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_STOCK_ARTICULOS_QUERY_LIMIT,
  isStockArticulosAggregation,
  safeIlikeTermArticulos,
  type StockArticulosQueryFilters,
} from "@/lib/stock-articulos-query-filters";
import type { StockArticuloAtpRow } from "@/types/prod-stock-articulos";

/** Tope PostgREST habitual (`max_rows`); pedir más no devuelve más filas. */
const SUPABASE_MAX_ROWS = 1000;

export type StockArticulosQueryAggregation = {
  tipo: "contar" | "sumar_libre" | "sumar_fisico" | "sumar_reservado";
  valor: number;
  unidad: string;
  /** Totales por unidad (evita mezclar uds + hojas en un solo número). */
  por_unidad?: Array<{ unidad: string; valor: number }>;
};

export type StockArticulosAtpQueryResult = {
  rows: StockArticuloAtpRow[];
  totalMatches: number;
  truncated: boolean;
  aggregation?: StockArticulosQueryAggregation;
};

export type StockArticulosQueryResultRow = {
  id: string;
  cliente: string | null;
  referencia_cliente: string | null;
  referencia_codigo: string;
  descripcion: string | null;
  proceso: string;
  unidad: string;
  libre: number;
  fisico: number;
  reservado: number;
  estado: string;
  ubicacion: string | null;
  ot_origen: string | null;
};

function sumByUnidad(
  rows: StockArticuloAtpRow[],
  pick: (r: StockArticuloAtpRow) => number
): {
  por_unidad: Array<{ unidad: string; valor: number }>;
  valor: number;
  unidad: string;
} {
  const map = new Map<string, number>();
  for (const r of rows) {
    const u = r.unidad || "uds";
    map.set(u, (map.get(u) ?? 0) + pick(r));
  }
  const por_unidad = [...map.entries()]
    .map(([unidad, valor]) => ({ unidad, valor }))
    .sort((a, b) => a.unidad.localeCompare(b.unidad));
  const first = por_unidad[0] ?? { unidad: "uds", valor: 0 };
  return {
    por_unidad,
    valor: first.valor,
    unidad: por_unidad.length === 1 ? first.unidad : "varias",
  };
}

/** Ejecuta consulta segura sobre `stock_articulos_atp`. */
export async function queryStockArticulosAtp(
  supabase: SupabaseClient,
  filtros: StockArticulosQueryFilters
): Promise<StockArticulosAtpQueryResult> {
  const aggregating = isStockArticulosAggregation(filtros.agregacion);
  const fetchLimit = aggregating
    ? SUPABASE_MAX_ROWS
    : Math.min(
        filtros.limite ?? DEFAULT_STOCK_ARTICULOS_QUERY_LIMIT,
        SUPABASE_MAX_ROWS
      );

  let q = supabase
    .from("stock_articulos_atp")
    .select("*", { count: "exact" });

  if (!filtros.incluir_agotados) {
    q = q.gt("cantidad_fisica", 0);
  }

  if (filtros.solo_pt) {
    q = q.eq("unidad", "uds").eq("estado_proceso", "terminado");
  } else {
    if (filtros.unidad) q = q.eq("unidad", filtros.unidad);
    if (filtros.estado_proceso) {
      const procs = Array.isArray(filtros.estado_proceso)
        ? filtros.estado_proceso
        : [filtros.estado_proceso];
      q = q.in("estado_proceso", procs);
    }
  }

  if (filtros.cliente_contiene) {
    const t = safeIlikeTermArticulos(filtros.cliente_contiene);
    q = q.ilike("cliente", `%${t}%`);
  }
  if (filtros.referencia_cliente_contiene) {
    const t = safeIlikeTermArticulos(filtros.referencia_cliente_contiene);
    q = q.ilike("referencia_cliente", `%${t}%`);
  }
  if (filtros.referencia_codigo_contiene) {
    const t = safeIlikeTermArticulos(filtros.referencia_codigo_contiene);
    q = q.ilike("referencia_codigo", `%${t}%`);
  }
  if (filtros.descripcion_contiene) {
    const t = safeIlikeTermArticulos(filtros.descripcion_contiene);
    q = q.ilike("referencia_descripcion", `%${t}%`);
  }
  if (filtros.ubicacion_contiene) {
    const t = safeIlikeTermArticulos(filtros.ubicacion_contiene);
    q = q.ilike("ubicacion_fisica", `%${t}%`);
  }
  if (filtros.ot_origen) {
    q = q.eq("ot_origen", filtros.ot_origen);
  }
  if (filtros.libre_min != null) q = q.gte("cantidad_libre", filtros.libre_min);
  if (filtros.libre_max != null) q = q.lte("cantidad_libre", filtros.libre_max);
  if (filtros.fisico_min != null) {
    q = q.gte("cantidad_fisica", filtros.fisico_min);
  }
  if (filtros.fisico_max != null) {
    q = q.lte("cantidad_fisica", filtros.fisico_max);
  }
  if (filtros.reservado_min != null) {
    q = q.gte("cantidad_reservada_total", filtros.reservado_min);
  }
  if (filtros.solo_libre) q = q.gt("cantidad_libre", 0);
  if (filtros.solo_reservado) q = q.gt("cantidad_reservada_total", 0);
  if (filtros.estado_derivado) {
    const estados = Array.isArray(filtros.estado_derivado)
      ? filtros.estado_derivado
      : [filtros.estado_derivado];
    q = q.in("estado_derivado", estados);
  }

  q = q.order("created_at", { ascending: false }).limit(fetchLimit);

  const { data: view, error, count } = await q;
  if (error) throw error;

  const filtered = (view ?? []) as StockArticuloAtpRow[];
  const totalMatches = typeof count === "number" ? count : filtered.length;
  const truncated = totalMatches > filtered.length;

  let aggregation: StockArticulosQueryAggregation | undefined;
  if (filtros.agregacion === "contar") {
    aggregation = {
      tipo: "contar",
      valor: totalMatches,
      unidad: "lotes",
    };
  } else if (filtros.agregacion === "sumar_libre") {
    const s = sumByUnidad(filtered, (r) => r.cantidad_libre);
    aggregation = {
      tipo: "sumar_libre",
      valor: s.valor,
      unidad: s.unidad,
      por_unidad: s.por_unidad,
    };
  } else if (filtros.agregacion === "sumar_fisico") {
    const s = sumByUnidad(filtered, (r) => r.cantidad_fisica);
    aggregation = {
      tipo: "sumar_fisico",
      valor: s.valor,
      unidad: s.unidad,
      por_unidad: s.por_unidad,
    };
  } else if (filtros.agregacion === "sumar_reservado") {
    const s = sumByUnidad(filtered, (r) => r.cantidad_reservada_total);
    aggregation = {
      tipo: "sumar_reservado",
      valor: s.valor,
      unidad: s.unidad,
      por_unidad: s.por_unidad,
    };
  }

  const displayLimit = aggregating
    ? Math.min(40, filtered.length)
    : (filtros.limite ?? DEFAULT_STOCK_ARTICULOS_QUERY_LIMIT);

  return {
    rows: filtered.slice(0, displayLimit),
    totalMatches,
    truncated,
    aggregation,
  };
}

export function toStockArticulosQueryResultRows(
  rows: StockArticuloAtpRow[]
): StockArticulosQueryResultRow[] {
  return rows.map((r) => ({
    id: r.id,
    cliente: r.cliente,
    referencia_cliente: r.referencia_cliente,
    referencia_codigo: r.referencia_codigo,
    descripcion: r.referencia_descripcion,
    proceso: r.estado_proceso,
    unidad: r.unidad,
    libre: r.cantidad_libre,
    fisico: r.cantidad_fisica,
    reservado: r.cantidad_reservada_total,
    estado: r.estado_derivado,
    ubicacion: r.ubicacion_fisica,
    ot_origen: r.ot_origen,
  }));
}

export function buildStockArticulosQueryMarkdown(
  interpretacion: string,
  filtros: StockArticulosQueryFilters,
  result: StockArticulosAtpQueryResult
): string {
  const lines: string[] = [`**${interpretacion}**`, ""];

  if (result.aggregation) {
    const { tipo, valor, unidad, por_unidad } = result.aggregation;
    const label =
      tipo === "contar"
        ? "Lotes"
        : tipo === "sumar_libre"
          ? "Suma libre"
          : tipo === "sumar_fisico"
            ? "Suma físico"
            : "Suma reservado";
    if (tipo !== "contar" && por_unidad && por_unidad.length > 1) {
      for (const p of por_unidad) {
        lines.push(
          `- ${label} (${p.unidad}): **${p.valor.toLocaleString("es-ES")}**`
        );
      }
      lines.push("_Varias unidades — no se suman juntas._");
    } else {
      lines.push(
        `- ${label}: **${valor.toLocaleString("es-ES")}** ${unidad}`
      );
    }
    lines.push(
      `- Coincidencias en el conjunto: ${result.totalMatches.toLocaleString("es-ES")}` +
        (result.truncated
          ? ` (suma sobre ${Math.min(result.totalMatches, SUPABASE_MAX_ROWS).toLocaleString("es-ES")} filas cargadas — truncado)`
          : "")
    );
  } else {
    lines.push(
      `- ${result.totalMatches.toLocaleString("es-ES")} lote(s)` +
        (result.truncated ? " (truncado)" : "")
    );
  }

  const keys = Object.keys(filtros).filter(
    (k) => k !== "agregacion" && k !== "limite"
  );
  if (keys.length > 0) {
    lines.push("", "_Criterios:_ " + keys.map((k) => `\`${k}\``).join(", "));
  }

  return lines.join("\n");
}
