import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

import { excelCellToDateInput } from "@/lib/externos-excel-import";
import { parseSpanishDecimal } from "@/lib/prod-ots-optimus-import";
import { cellStr, normalizeSalesRecord, pick } from "@/lib/sales-parse-rows";

const TBL_MATERIALES = "almacen_materiales";
const TBL_RESERVAS = "almacen_reservas";
const TBL_TRANSITO = "almacen_pedidos_transito";

const SHEET_STOCK = "STOCK_BASE";
const SHEET_RESERVAS = "RESERVAS_OT";
const SHEET_TRANSITO = "PEDIDOS_EN_TRANSITO";

const UPSERT_CHUNK = 250;
const INSERT_CHUNK = 250;
const DELETE_CHUNK = 500;

export type AlmacenExcelSyncResult = {
  ok: true;
  materialesUpserted: number;
  reservasInserted: number;
  transitoInserted: number;
  reservasSkippedNoMaterial: number;
  transitoSkippedNoMaterial: number;
  warnings: string[];
};

export type AlmacenExcelSyncError = {
  ok: false;
  message: string;
};

export type AlmacenExcelSyncOutcome = AlmacenExcelSyncResult | AlmacenExcelSyncError;

function materialLookupKey(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim().toLowerCase();
}

function toIntStock(v: unknown): number {
  const n = parseSpanishDecimal(v);
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function toIntQty(v: unknown): number | null {
  const n = parseSpanishDecimal(v);
  if (n == null || !Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function requireSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet {
  const ws = wb.Sheets[name];
  if (!ws) {
    const available = wb.SheetNames.join(", ");
    throw new Error(
      `Falta la hoja "${name}". Hojas en el libro: ${available || "(ninguna)"}.`
    );
  }
  return ws;
}

function sheetToRows(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  });
}

async function deleteAllPaged(
  supabase: SupabaseClient,
  table: typeof TBL_RESERVAS | typeof TBL_TRANSITO
): Promise<void> {
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .limit(DELETE_CHUNK);
    if (error) throw error;
    if (!data?.length) break;
    const ids = data.map((r: { id: string }) => r.id);
    const { error: delErr } = await supabase.from(table).delete().in("id", ids);
    if (delErr) throw delErr;
  }
}

async function fetchNombreToIdMap(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const page = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(TBL_MATERIALES)
      .select("id,nombre")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data as { id: string; nombre: string | null }[]) {
      const n = cellStr(row.nombre);
      if (n) map.set(materialLookupKey(n), row.id);
    }
    if (data.length < page) break;
    from += page;
  }
  return map;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Lee el Excel de planificación de materiales (3 hojas en orden) y sincroniza Supabase.
 *
 * A) `STOCK_BASE` → upsert masivo en `almacen_materiales` (`nombre` como conflicto único).
 * B) `RESERVAS_OT` → vacía `almacen_reservas` e inserta filas (cruce por Material → material_id).
 * C) `PEDIDOS_EN_TRANSITO` → vacía `almacen_pedidos_transito` e inserta filas.
 */
export async function syncAlmacenFromExcelBuffer(
  supabase: SupabaseClient,
  buffer: ArrayBuffer
): Promise<AlmacenExcelSyncOutcome> {
  const warnings: string[] = [];

  try {
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });

    const wsStock = requireSheet(wb, SHEET_STOCK);
    const wsRes = requireSheet(wb, SHEET_RESERVAS);
    const wsTra = requireSheet(wb, SHEET_TRANSITO);

    const stockRows = sheetToRows(wsStock);
    const materialesPayload: {
      nombre: string;
      tipo_material: string | null;
      stock_fisico: number;
      stock_minimo: number;
    }[] = [];

    for (const raw of stockRows) {
      const r = normalizeSalesRecord(raw);
      const nombre = cellStr(
        pick(r, "Material", "material", "MATERIAL", "Nombre", "nombre")
      );
      if (!nombre) continue;
      const tipo_material = cellStr(
        pick(r, "Tipo Material", "Tipo material", "tipo_material", "Tipo")
      );
      const stock_fisico = toIntStock(
        pick(r, "Stock Físico", "Stock fisico", "Stock físico", "stock_fisico")
      );
      const stock_minimo = toIntStock(
        pick(
          r,
          "Stock Mínimo Seguridad",
          "Stock minimo seguridad",
          "Stock Mínimo",
          "stock_minimo",
          "Stock mínimo seguridad"
        )
      );
      materialesPayload.push({
        nombre,
        tipo_material: tipo_material || null,
        stock_fisico,
        stock_minimo,
      });
    }

    let materialesUpserted = 0;
    for (const part of chunk(materialesPayload, UPSERT_CHUNK)) {
      if (part.length === 0) continue;
      const { error } = await supabase.from(TBL_MATERIALES).upsert(part, {
        onConflict: "nombre",
        ignoreDuplicates: false,
      });
      if (error) throw error;
      materialesUpserted += part.length;
    }

    const nombreToId = await fetchNombreToIdMap(supabase);

    await deleteAllPaged(supabase, TBL_RESERVAS);
    const resRows = sheetToRows(wsRes);
    const reservasInsert: {
      ot_num: string;
      material_id: string;
      cantidad_bruta: number;
      estado: string | null;
      fecha_prevista: string | null;
    }[] = [];
    let reservasSkippedNoMaterial = 0;

    for (let i = 0; i < resRows.length; i++) {
      const r = normalizeSalesRecord(resRows[i]);
      const materialNombre = cellStr(
        pick(r, "Material", "material", "MATERIAL", "Descripción", "Descripcion")
      );
      const ot_num = cellStr(
        pick(r, "Nº OT", "Nº ot", "OT", "ot_num", "Nº OT ", "Num OT")
      );
      if (!materialNombre || !ot_num) continue;
      const mid = nombreToId.get(materialLookupKey(materialNombre));
      if (!mid) {
        reservasSkippedNoMaterial += 1;
        if (warnings.length < 40) {
          warnings.push(
            `RESERVAS_OT fila ${i + 2}: material "${materialNombre}" sin coincidencia en catálogo.`
          );
        }
        continue;
      }
      const cant = toIntQty(
        pick(
          r,
          "Consumo Bruto Previsto",
          "Consumo bruto previsto",
          "cantidad_bruta",
          "Consumo bruto"
        )
      );
      if (cant == null) continue;
      const estado = cellStr(pick(r, "Estado", "estado")) || null;
      const fechaRaw = pick(
        r,
        "Fecha Prevista Impresión",
        "Fecha prevista impresion",
        "fecha_prevista",
        "Fecha prevista"
      );
      const fecha_prevista = excelCellToDateInput(fechaRaw) || null;
      reservasInsert.push({
        ot_num,
        material_id: mid,
        cantidad_bruta: cant,
        estado,
        fecha_prevista,
      });
    }

    for (const part of chunk(reservasInsert, INSERT_CHUNK)) {
      if (part.length === 0) continue;
      const { error } = await supabase.from(TBL_RESERVAS).insert(part);
      if (error) throw error;
    }

    await deleteAllPaged(supabase, TBL_TRANSITO);
    const traRows = sheetToRows(wsTra);
    const transitoInsert: {
      num_pedido: string;
      material_id: string;
      cantidad_pedida: number;
      estado: string | null;
      fecha_llegada: string | null;
    }[] = [];
    let transitoSkippedNoMaterial = 0;

    for (let i = 0; i < traRows.length; i++) {
      const r = normalizeSalesRecord(traRows[i]);
      const materialNombre = cellStr(
        pick(r, "Material", "material", "MATERIAL", "Descripción", "Descripcion")
      );
      const num_pedido = cellStr(
        pick(r, "Nº Pedido", "Nº pedido", "Num Pedido", "num_pedido", "Pedido")
      );
      if (!materialNombre || !num_pedido) continue;
      const mid = nombreToId.get(materialLookupKey(materialNombre));
      if (!mid) {
        transitoSkippedNoMaterial += 1;
        if (warnings.length < 40) {
          warnings.push(
            `PEDIDOS_EN_TRANSITO fila ${i + 2}: material "${materialNombre}" sin coincidencia en catálogo.`
          );
        }
        continue;
      }
      const cant = toIntQty(
        pick(r, "Cantidad Pedida", "Cantidad pedida", "cantidad_pedida")
      );
      if (cant == null || cant < 0) continue;
      const estado = cellStr(pick(r, "Estado", "estado")) || null;
      const fechaRaw = pick(
        r,
        "Fecha Prevista Llegada",
        "Fecha prevista llegada",
        "fecha_llegada",
        "Fecha llegada"
      );
      const fecha_llegada = excelCellToDateInput(fechaRaw) || null;
      transitoInsert.push({
        num_pedido,
        material_id: mid,
        cantidad_pedida: cant,
        estado,
        fecha_llegada,
      });
    }

    for (const part of chunk(transitoInsert, INSERT_CHUNK)) {
      if (part.length === 0) continue;
      const { error } = await supabase.from(TBL_TRANSITO).insert(part);
      if (error) throw error;
    }

    if (reservasSkippedNoMaterial + transitoSkippedNoMaterial > 40) {
      warnings.push(
        `…y más filas omitidas por material desconocido (reservas: ${reservasSkippedNoMaterial}, tránsito: ${transitoSkippedNoMaterial}).`
      );
    }

    return {
      ok: true,
      materialesUpserted,
      reservasInserted: reservasInsert.length,
      transitoInserted: transitoInsert.length,
      reservasSkippedNoMaterial,
      transitoSkippedNoMaterial,
      warnings,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error desconocido al importar el Excel.";
    return { ok: false, message };
  }
}
