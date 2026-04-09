import type { SupabaseClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { excelCellToDateInput } from "@/lib/externos-excel-import";
import { cellStr, normalizeSalesRecord, pick } from "@/lib/sales-parse-rows";

function trimColumnKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new Map<string, number>();
  for (const [k, v] of Object.entries(raw)) {
    const base = String(k).trim().replace(/\s+/g, " ").trim();
    if (!base) continue;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const key = n === 0 ? base : `${base}__dup${n + 1}`;
    out[key] = v;
  }
  return out;
}

/** Fila lista para insert en prod_troqueles (nombres = columnas SQL). */
export type TroquelImportPayload = {
  num_troquel: string;
  proveedor: string | null;
  ref_proveedor: string | null;
  cliente: string | null;
  descripcion: string | null;
  tipo_producto: string | null;
  mides: string | null;
  num_figuras: string | null;
  material: string | null;
  formato_papel: string | null;
  figuras_hoja: string | null;
  pinza: string | null;
  plancha_hendidos: string | null;
  expulsion: string | null;
  num_expulsion: string | null;
  taco: string | null;
  relieve_seco: string | null;
  caucho_acrilico: string | null;
  maquina: string | null;
  fecha_ultima_fab: string | null;
  notas: string | null;
};

export type TroquelesImportParseResult = {
  rows: TroquelImportPayload[];
  parseWarnings: string[];
  filasLeidas: number;
};

function nullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

function pickNumTroquel(r: Record<string, unknown>): string {
  return cellStr(
    pick(
      r,
      "NUM. TROQUEL (intern)",
      "NUM. TROQUEL",
      "NUM TROQUEL",
      "num_troquel",
      "Nº TROQUEL",
      "Nº Troquel",
      "Num. Troquel",
      "Num Troquel",
      "TROQUEL",
      "Troquel"
    )
  ).trim();
}

function buildPayloadFromRecord(
  r: Record<string, unknown>,
  numTroquel: string,
  _rowIndex: number,
  _parseWarnings: string[]
): TroquelImportPayload | null {
  const nt = numTroquel.trim();
  if (!nt) {
    return null;
  }

  const proveedor = cellStr(
    pick(
      r,
      "PROVEÏDOR",
      "PROVEEDOR",
      "Proveedor",
      "proveedor",
      "Proveïdor"
    )
  );
  const ref_proveedor = cellStr(
    pick(
      r,
      "REF. PROVEEDOR",
      "REF PROVEEDOR",
      "ref_proveedor",
      "Ref. Proveedor",
      "Ref proveedor"
    )
  );
  const cliente = cellStr(
    pick(r, "CLIENT", "CLIENTE", "Cliente", "cliente", "Client")
  );
  const descripcion = cellStr(
    pick(
      r,
      "DESCRIPCIÓ DE LA FEINA",
      "DESCRIPCION DE LA FEINA",
      "DESCRIPCIÓN",
      "descripcion",
      "Descripción",
      "Descripcion",
      "DESCRIPCIO"
    )
  );
  const tipo_producto = cellStr(
    pick(
      r,
      "TIPO PRODUCTO",
      "tipo_producto",
      "Tipo producto",
      "Tipo Producto"
    )
  );
  const mides = cellStr(pick(r, "MIDES", "mides", "Mides", "Medidas"));
  const num_figuras = cellStr(
    pick(
      r,
      "NUM. FIGURAS",
      "NUM FIGURAS",
      "num_figuras",
      "Nº Figuras",
      "Num. figuras"
    )
  );
  const material = cellStr(pick(r, "MATERIAL", "material", "Material"));
  const formato_papel = cellStr(
    pick(
      r,
      "FORMATO PAPEL",
      "formato_papel",
      "Formato papel",
      "Formato Papel"
    )
  );
  const figuras_hoja = cellStr(
    pick(
      r,
      "FIGURAS POR HOJA IMPRESIÓN",
      "FIGURAS POR HOJA IMPRESION",
      "figuras_hoja",
      "Figuras por hoja",
      "Figuras por hoja impresión"
    )
  );
  const pinza = cellStr(pick(r, "PINZA", "pinza", "Pinza"));
  const plancha_hendidos = cellStr(
    pick(
      r,
      "PLANCHA HENDIDOS",
      "plancha_hendidos",
      "Plancha hendidos",
      "PLANCHA HENDITOS"
    )
  );
  const expulsion = cellStr(
    pick(r, "EXPULSIÓN", "EXPULSION", "expulsion", "Expulsión", "Expulsion")
  );
  const num_expulsion = cellStr(
    pick(
      r,
      "Nº EXPULSION",
      "Nº EXPULSIÓN",
      "num_expulsion",
      "Num expulsion",
      "Núm. expulsión"
    )
  );
  const taco = cellStr(pick(r, "TACO", "taco", "Taco"));
  const relieve_seco = cellStr(
    pick(
      r,
      "RELIEVE EN SECO",
      "RELIEVE SECO",
      "relieve_seco",
      "Relieve en seco",
      "Relieve seco"
    )
  );
  const caucho_acrilico = cellStr(
    pick(
      r,
      "CAUCHO ACRÍLICO",
      "CAUCHO ACRILICO",
      "caucho_acrilico",
      "Caucho acrílico",
      "Caucho acrilico"
    )
  );
  const maquina = cellStr(
    pick(r, "MÀQUINA", "MAQUINA", "maquina", "Máquina", "Maquina")
  );

  const fechaCell = pick(
    r,
    "FECHA ULTIMA FABRICACIÓN",
    "FECHA ULTIMA FABRICACION",
    "fecha_ultima_fab",
    "Fecha última fabricación",
    "Fecha ultima fabricacion"
  );
  const fecha_ultima_fab = nullIfEmpty(excelCellToDateInput(fechaCell));

  const notas = cellStr(
    pick(r, "NOTAS", "notas", "Notas", "OBSERVACIONES", "Observaciones")
  );

  return {
    num_troquel: nt,
    proveedor: nullIfEmpty(proveedor),
    ref_proveedor: nullIfEmpty(ref_proveedor),
    cliente: nullIfEmpty(cliente),
    descripcion: nullIfEmpty(descripcion),
    tipo_producto: nullIfEmpty(tipo_producto),
    mides: nullIfEmpty(mides),
    num_figuras: nullIfEmpty(num_figuras),
    material: nullIfEmpty(material),
    formato_papel: nullIfEmpty(formato_papel),
    figuras_hoja: nullIfEmpty(figuras_hoja),
    pinza: nullIfEmpty(pinza),
    plancha_hendidos: nullIfEmpty(plancha_hendidos),
    expulsion: nullIfEmpty(expulsion),
    num_expulsion: nullIfEmpty(num_expulsion),
    taco: nullIfEmpty(taco),
    relieve_seco: nullIfEmpty(relieve_seco),
    caucho_acrilico: nullIfEmpty(caucho_acrilico),
    maquina: nullIfEmpty(maquina),
    fecha_ultima_fab,
    notas: nullIfEmpty(notas),
  };
}

function buildRowsFromJson(
  json: Record<string, unknown>[]
): TroquelesImportParseResult {
  const parseWarnings: string[] = [];
  const rows: TroquelImportPayload[] = [];
  let rowIndex = 0;
  let sinRefSeq = 0;
  for (const raw of json) {
    rowIndex += 1;
    const r = normalizeSalesRecord(trimColumnKeys(raw));
    let num = pickNumTroquel(r);
    if (!num) {
      sinRefSeq += 1;
      num = `SIN_REF_${String(sinRefSeq).padStart(3, "0")}`;
    }
    const payload = buildPayloadFromRecord(r, num, rowIndex, parseWarnings);
    if (payload) rows.push(payload);
  }
  if (sinRefSeq > 0) {
    parseWarnings.push(
      `${sinRefSeq} fila(s) sin número de troquel: se asignaron códigos SIN_REF_XXX.`
    );
  }
  return { rows, parseWarnings, filasLeidas: json.length };
}

/**
 * Si un SIN_REF_XXX generado en el Excel ya existe en BD, reasigna el siguiente libre.
 */
export async function resolveSinRefCollisionsWithDb(
  rows: TroquelImportPayload[],
  supabase: SupabaseClient
): Promise<TroquelImportPayload[]> {
  const { data: existingRows, error } = await supabase
    .from("prod_troqueles")
    .select("num_troquel");
  if (error) throw error;

  const taken = new Set(
    (existingRows ?? [])
      .map((r) => String(r.num_troquel ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  function nextSinRef(): string {
    let n = 1;
    for (;;) {
      const code = `SIN_REF_${String(n).padStart(3, "0")}`;
      const k = code.toLowerCase();
      if (!taken.has(k)) {
        taken.add(k);
        return code;
      }
      n += 1;
      if (n > 99999) {
        const fallback = `SIN_REF_${Date.now()}`;
        taken.add(fallback.toLowerCase());
        return fallback;
      }
    }
  }

  const out = rows.map((r) => ({ ...r }));
  for (const p of out) {
    const raw = p.num_troquel.trim();
    const k = raw.toLowerCase();
    if (!k) continue;
    if (taken.has(k) && /^sin_ref_\d+$/i.test(raw)) {
      p.num_troquel = nextSinRef();
    } else if (!taken.has(k)) {
      taken.add(k);
    }
  }
  return out;
}

export function parseTroquelesExcelBuffer(
  buffer: ArrayBuffer
): TroquelesImportParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) {
    return {
      rows: [],
      parseWarnings: ["El archivo no contiene ninguna hoja."],
      filasLeidas: 0,
    };
  }
  const sheet = wb.Sheets[name];
  if (!sheet) {
    return {
      rows: [],
      parseWarnings: ["No se pudo leer la primera hoja."],
      filasLeidas: 0,
    };
  }
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return buildRowsFromJson(json);
}

export function parseTroquelesCsvText(text: string): TroquelesImportParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    const msg = parsed.errors.slice(0, 3).map((e) => e.message).join(" · ");
    return {
      rows: [],
      parseWarnings: [`Error al leer CSV: ${msg}`],
      filasLeidas: 0,
    };
  }
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  return buildRowsFromJson(data);
}

export async function parseTroquelesImportFile(
  file: File
): Promise<TroquelesImportParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseTroquelesCsvText(text);
  }
  if (name.endsWith(".xlsx")) {
    const buf = await file.arrayBuffer();
    return parseTroquelesExcelBuffer(buf);
  }
  return {
    rows: [],
    parseWarnings: ["Formato no soportado. Usa .xlsx o .csv."],
    filasLeidas: 0,
  };
}
