import * as XLSX from "xlsx";

import { cellNum, cellStr, pick } from "@/lib/sales-parse-rows";
import type { StockEstado } from "@/types/prod-stock";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Fila parseada del export Optimus (stocksoptimus*.xlsx). */
export type StockOptimusParsedRow = {
  id_stock: number;
  codigo_articulo: string | null;
  descripcion: string;
  material_nombre: string;
  gramaje: number | null;
  formato: string | null;
  marca: string | null;
  cantidad_no_asignada: number;
  cantidad_asignada: number;
  cantidad_fisica: number;
  unidad: "hojas" | "uds" | "kg" | "m";
  coste: number | null;
  nota_entrega: string | null;
  ref_lote: string | null;
  proveedor_source: string | null;
  ubicacion: string | null;
  ots: StockOptimusOtReserva[];
  estado: StockEstado;
};

export type StockOptimusOtReserva = {
  ot_numero: string;
  cantidad_reservada: number | null;
};

export type StockOptimusParseResult = {
  rows: StockOptimusParsedRow[];
  parseWarnings: string[];
  filasLeidas: number;
  filasOmitidas: number;
  totales: {
    palets: number;
    hojasLibres: number;
    hojasReservadas: number;
    valoracion: number;
  };
};

export type StockOptimusImportResult = {
  paletsInsertados: number;
  otsInsertadas: number;
  pilotEliminados: number;
};

const PILOT_ID_STOCK_MIN = 10310;
const PILOT_ID_STOCK_MAX = 10320;

function trimColumnKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new Map<string, number>();
  for (const [k, v] of Object.entries(raw)) {
    const base = String(k).trim().replace(/\s+/g, " ").trim();
    if (!base) continue;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out[n === 0 ? base : `${base}__dup${n + 1}`] = v;
  }
  return out;
}

function parseDescripcion(desc: string): {
  material_nombre: string;
  gramaje: number | null;
  formato: string | null;
  marca: string | null;
} {
  const gramajeMatch = desc.match(/(\d+)\s*gr/i);
  const formatMatch = desc.match(/(\d+x\d+)\s*cm/i);
  const marcaMatch = desc.match(/-\s*([A-Za-z0-9][A-Za-z0-9\s./-]*)$/);
  return {
    material_nombre: desc,
    gramaje: gramajeMatch ? parseInt(gramajeMatch[1], 10) : null,
    formato: formatMatch ? formatMatch[1] : null,
    marca: marcaMatch ? marcaMatch[1].trim() : null,
  };
}

/** Extrae números de OT desde Referencia lote y/o Nº Pedido (export Optimus). */
export function parseOtNumerosFromOptimus(
  refLote: string | null | undefined,
  numPedido: string | null | undefined
): string[] {
  const ots: string[] = [];
  const add = (ot: string) => {
    const t = ot.trim();
    if (t && !ots.includes(t)) ots.push(t);
  };

  if (numPedido != null && String(numPedido).trim()) {
    const p = String(numPedido).trim();
    const m = p.match(/^(\d{5}(?:-\d{2})?)/);
    if (m) add(m[1]!);
    else if (/^\d+$/.test(p)) add(p);
  }

  if (refLote != null) {
    const s = String(refLote).trim();
    if (!s || /^STOCK/i.test(s)) return ots;
    const found = s.match(/\b(\d{5}(?:-\d{2})?)\b/g);
    if (found) {
      for (const f of found) add(f);
    } else {
      for (const part of s.split(/[-/]/)) {
        const p = part.trim();
        if (/^\d{5}(-\d{2})?$/.test(p)) add(p);
      }
    }
  }
  return ots;
}

function buildOtsReservas(
  noAsignado: number,
  asignado: number,
  refLote: string | null,
  numPedido: string | null
): StockOptimusOtReserva[] {
  const ots = parseOtNumerosFromOptimus(refLote, numPedido);
  if (asignado > 0) {
    const primary = ots[0];
    if (!primary) return [];
    const result: StockOptimusOtReserva[] = [
      { ot_numero: primary, cantidad_reservada: Math.round(asignado) },
    ];
    for (const ot of ots.slice(1)) {
      result.push({ ot_numero: ot, cantidad_reservada: null });
    }
    return result;
  }
  if (ots.length > 0) {
    return ots.map((ot) => ({ ot_numero: ot, cantidad_reservada: null }));
  }
  return [];
}

function deriveEstadoLegacy(
  noAsignado: number,
  asignado: number
): StockEstado {
  const fisica = noAsignado + asignado;
  if (fisica <= 0) return "consumido";
  if (asignado <= 0) return "disponible";
  if (noAsignado <= 0) return "reservado";
  return "parcial";
}

function normalizeUnidad(raw: string): "hojas" | "uds" | "kg" | "m" {
  const u = raw.toLowerCase();
  if (u.startsWith("hoja")) return "hojas";
  if (u === "uds" || u.startsWith("ud")) return "uds";
  if (u === "kg") return "kg";
  if (u === "m") return "m";
  return "hojas";
}

function parseOptimusRecord(raw: Record<string, unknown>): StockOptimusParsedRow | null {
  const r = trimColumnKeys(raw);
  const idRaw = pick(r, "Id", "ID", "id_stock", "Id Stock");
  const idNum = cellNum(idRaw);
  if (!Number.isFinite(idNum) || idNum <= 0) return null;

  const noAsignado = Math.max(0, Math.round(cellNum(pick(r, "Stock no asignado")) || 0));
  const asignado = Math.max(0, Math.round(cellNum(pick(r, "Stock asignado")) || 0));
  const fisica = noAsignado + asignado;
  if (fisica <= 0) return null;

  const desc = cellStr(pick(r, "Descripción", "Descripcion", "descripcion"));
  const parsed = parseDescripcion(desc);
  const refLote = cellStr(pick(r, "Referencia lote", "Referencia Lote")) || null;
  const numPedido = cellStr(pick(r, "Nº Pedido", "N Pedido", "Numero Pedido")) || null;
  const costeRaw = cellNum(pick(r, "Coste", "coste"));
  const coste = Number.isFinite(costeRaw) && costeRaw >= 0 ? costeRaw : null;
  const source = cellStr(pick(r, "Source", "Proveedor")) || null;

  const ots = buildOtsReservas(noAsignado, asignado, refLote, numPedido || null);

  return {
    id_stock: Math.round(idNum),
    codigo_articulo: cellStr(pick(r, "Código artículo", "Codigo articulo")) || null,
    descripcion: desc,
    ...parsed,
    cantidad_no_asignada: noAsignado,
    cantidad_asignada: asignado,
    cantidad_fisica: fisica,
    unidad: normalizeUnidad(cellStr(pick(r, "Unidad", "unidad")) || "hojas"),
    coste,
    nota_entrega: cellStr(pick(r, "Nota de entrega", "Nota entrega")) || null,
    ref_lote: refLote,
    proveedor_source: source,
    ubicacion: cellStr(pick(r, "Ubicación", "Ubicacion")) || null,
    ots,
    estado: deriveEstadoLegacy(noAsignado, asignado),
  };
}

export async function parseStockOptimusFile(
  file: File
): Promise<StockOptimusParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      parseWarnings: ["El archivo no contiene hojas."],
      filasLeidas: 0,
      filasOmitidas: 0,
      totales: { palets: 0, hojasLibres: 0, hojasReservadas: 0, valoracion: 0 },
    };
  }
  const ws = wb.Sheets[sheetName]!;
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: false,
  });

  const parseWarnings: string[] = [];
  const rows: StockOptimusParsedRow[] = [];
  let filasOmitidas = 0;

  for (const raw of jsonRows) {
    const parsed = parseOptimusRecord(raw);
    if (!parsed) {
      filasOmitidas++;
      continue;
    }
    rows.push(parsed);
  }

  if (rows.length === 0) {
    parseWarnings.push("No se encontraron filas válidas con Id y cantidad > 0.");
  }

  const byId = new Map<number, StockOptimusParsedRow>();
  for (const row of rows) {
    byId.set(row.id_stock, row);
  }
  const deduped = Array.from(byId.values());
  if (deduped.length < rows.length) {
    parseWarnings.push(
      `Se omitieron ${rows.length - deduped.length} filas duplicadas por Id.`
    );
  }

  let hojasLibres = 0;
  let hojasReservadas = 0;
  let valoracion = 0;
  for (const r of deduped) {
    hojasLibres += r.cantidad_no_asignada;
    hojasReservadas += r.cantidad_asignada;
    if (r.coste != null) valoracion += r.coste;
  }

  return {
    rows: deduped,
    parseWarnings,
    filasLeidas: jsonRows.length,
    filasOmitidas,
    totales: {
      palets: deduped.length,
      hojasLibres,
      hojasReservadas,
      valoracion,
    },
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Elimina cartelas piloto (#10310–#10320). */
export async function deletePilotStockCartelas(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("prod_stock_palets")
    .delete()
    .gte("id_stock", PILOT_ID_STOCK_MIN)
    .lte("id_stock", PILOT_ID_STOCK_MAX)
    .select("id_stock");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Importa filas parseadas a prod_stock_palets + prod_stock_palet_ots. */
export async function executeStockOptimusImport(
  supabase: SupabaseClient,
  rows: StockOptimusParsedRow[],
  options: { deletePilotFirst?: boolean } = {}
): Promise<StockOptimusImportResult> {
  let pilotEliminados = 0;
  if (options.deletePilotFirst !== false) {
    pilotEliminados = await deletePilotStockCartelas(supabase);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let paletsInsertados = 0;
  let otsInsertadas = 0;

  for (const chunk of chunkArray(rows, 40)) {
    const paletPayloads = chunk.map((r) => ({
      id_stock: r.id_stock,
      tipo_stock: "materia_prima" as const,
      unidad: r.unidad,
      codigo_articulo: r.codigo_articulo,
      descripcion_material: r.descripcion,
      material_nombre: r.material_nombre,
      gramaje: r.gramaje,
      formato: r.formato,
      marca: r.marca,
      cantidad_inicial: r.cantidad_fisica,
      cantidad_actual: r.cantidad_fisica,
      coste: r.coste,
      ot_destino_numero: r.ots.length === 1 ? r.ots[0]!.ot_numero : null,
      estado: r.estado,
      ubicacion_fila: r.ubicacion && r.ubicacion !== "GEN" ? r.ubicacion : null,
      nota_entrega: r.nota_entrega,
      ref_lote: r.ref_lote,
      notas: r.proveedor_source
        ? `Import Optimus 03/07/2026 · Proveedor: ${r.proveedor_source}`
        : "Import Optimus 03/07/2026",
      es_fsc: false,
      es_pefc: false,
      created_by: user?.id ?? null,
    }));

    const { data: upserted, error: upsertErr } = await supabase
      .from("prod_stock_palets")
      .upsert(paletPayloads, { onConflict: "id_stock" })
      .select("id, id_stock");

    if (upsertErr) throw upsertErr;
    if (!upserted?.length) continue;

    paletsInsertados += upserted.length;

    const idByStock = new Map(
      upserted.map((p) => [p.id_stock as number, p.id as string])
    );
    const paletIds = upserted.map((p) => p.id as string);

    const { error: delOtsErr } = await supabase
      .from("prod_stock_palet_ots")
      .delete()
      .in("palet_id", paletIds);
    if (delOtsErr) throw delOtsErr;

    const otsPayload: {
      palet_id: string;
      ot_numero: string;
      cantidad_reservada: number | null;
    }[] = [];

    for (const row of chunk) {
      const paletId = idByStock.get(row.id_stock);
      if (!paletId || row.ots.length === 0) continue;
      for (const ot of row.ots) {
        otsPayload.push({
          palet_id: paletId,
          ot_numero: ot.ot_numero,
          cantidad_reservada: ot.cantidad_reservada,
        });
      }
    }

    if (otsPayload.length > 0) {
      for (const otChunk of chunkArray(otsPayload, 200)) {
        const { error: otsErr } = await supabase
          .from("prod_stock_palet_ots")
          .insert(otChunk);
        if (otsErr) throw otsErr;
        otsInsertadas += otChunk.length;
      }
    }
  }

  const { error: seqErr } = await supabase.rpc("prod_stock_sync_id_stock_seq");
  if (seqErr) {
    console.warn("No se pudo sincronizar secuencia id_stock:", seqErr.message);
  }

  return { paletsInsertados, otsInsertadas, pilotEliminados };
}
