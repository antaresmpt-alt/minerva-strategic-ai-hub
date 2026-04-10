import Papa from "papaparse";
import * as XLSX from "xlsx";

import { cellStr, normalizeSalesRecord, pick } from "@/lib/sales-parse-rows";
import { excelCellToDateInput } from "@/lib/externos-excel-import";

export type OptimusOtsUpsertRow = {
  num_pedido: string;
  estado_desc: string;
  estado_cod: number | null;
  cliente: string;
  titulo: string;
  familia: string;
  cantidad: number | null;
  valor_potencial: number | null;
  /** `date` en Postgres: solo `YYYY-MM-DD` (día calendario local parseado). */
  fecha_apertura: string | null;
  fecha_entrega: string | null;
  /** `timestamptz`: ISO completo. */
  ultima_transaccion: string | null;
  vendedor: string;
  pedido_cliente: string;
  prioridad: number | null;
  tipo_pedido: string;
  prueba_color: string;
  pdf_ok: string;
  muestra_ok: string;
  updated_at: string;
};

function trimColumnKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new Map<string, number>();
  for (const [k, v] of Object.entries(raw)) {
    const base = String(k).trim();
    if (!base) continue;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const key = n === 0 ? base : `${base}__dup${n + 1}`;
    out[key] = v;
  }
  return out;
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Heurística para `estado_cod` cuando el Excel solo trae texto. */
export function inferEstadoCodFromDesc(desc: string): number | null {
  const n = normalizeKey(desc);
  if (!n) return null;
  if (n.includes("termin")) return 4;
  if (n.includes("retras")) return 2;
  if (n.includes("lanz")) return 1;
  if (n.includes("producci") || n.includes("en curso") || n.includes("en cola")) {
    return 3;
  }
  return null;
}

/** Meses abreviados (Optimus: `31-mar-26`). */
const MES_ABBR_ES: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

/**
 * Formato español Optimus: miles con `.`, decimales con `,` (p. ej. `3.926,44`).
 * Cantidades enteras con miles: `50.000` → 50000 (no 50).
 * Con `sheet_to_json` en `raw: true`, Excel suele entregar `50000` / `3926.44` como number.
 */
export function parseSpanishDecimal(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  let s = String(raw).trim().replace(/[\s\u00a0]/g, "");
  if (!s) return null;

  // `3.926,44` o `10,5`
  const european = /^(\d{1,3}(?:\.\d{3})*),(\d+)$/;
  if (european.test(s)) {
    const m = s.match(european)!;
    const intPart = m[1].replace(/\./g, "");
    return Number(`${intPart}.${m[2]}`);
  }

  // Enteros con miles y punto: `50.000`, `1.234.567`
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    return Number(s.replace(/\./g, ""));
  }

  // `50,000` sin puntos: en exportes US = miles (poco frecuente en ES)
  if (/^\d+,\d{3}$/.test(s) && !s.includes(".")) {
    return Number(s.replace(",", ""));
  }

  // Decimal solo con coma: `50,5`
  if (/^\d+,\d+$/.test(s)) {
    return Number(s.replace(",", "."));
  }

  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseSpanishInteger(raw: unknown): number | null {
  const n = parseSpanishDecimal(raw);
  if (n == null || !Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeYear(y: number): number {
  if (!Number.isFinite(y)) return y;
  if (y >= 100) return y;
  return y + 2000;
}

/** Interpreta fecha/hora en **hora local** (como en Excel España). */
function parseDmyOptionalTimeToLocalDate(s: string): Date | null {
  const t = s.trim().replace(/\s+/g, " ");

  const tryDmy = (
    dd: number,
    mo: number,
    yyRaw: number,
    H: number,
    min: number,
    sec: number
  ): Date | null => {
    const yy = normalizeYear(yyRaw);
    const d = new Date(yy, mo - 1, dd, H, min, sec, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // DD/MM/YYYY HH:mm o H:mm (también :ss); DD/MM/YY HH:mm
  const m1 = t.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m1) {
    return tryDmy(
      Number(m1[1]),
      Number(m1[2]),
      Number(m1[3]),
      Number(m1[4]),
      Number(m1[5]),
      m1[6] ? Number(m1[6]) : 0
    );
  }
  // DD/MM/YYYY o DD/MM/YY sin hora
  const m2 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m2) {
    return tryDmy(
      Number(m2[1]),
      Number(m2[2]),
      Number(m2[3]),
      12,
      0,
      0
    );
  }
  // DD-MM-YYYY HH:mm
  const m3 = t.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m3) {
    return tryDmy(
      Number(m3[1]),
      Number(m3[2]),
      Number(m3[3]),
      Number(m3[4]),
      Number(m3[5]),
      m3[6] ? Number(m3[6]) : 0
    );
  }
  // 31-mar-26, 31-Mar-2026
  const m4 = t.match(/^(\d{1,2})-([a-zñ]{3})-(\d{2,4})$/i);
  if (m4) {
    const dd = Number(m4[1]);
    const mon = MES_ABBR_ES[m4[2].toLowerCase()];
    if (mon === undefined || !Number.isFinite(dd)) return null;
    let yy = Number(m4[3]);
    if (!Number.isFinite(yy)) return null;
    yy = normalizeYear(yy);
    const d = new Date(yy, mon, dd, 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Serial Excel (día + fracción) → `Date` local. */
function excelSerialToLocalDate(v: number): Date | null {
  if (!(typeof v === "number" && v > 20000 && v < 120000)) return null;
  const p = XLSX.SSF.parse_date_code(v);
  if (!p || typeof p.y !== "number") return null;
  const H = p.H ?? 0;
  const M = p.M ?? 0;
  const sec = p.S ?? 0;
  const S = Math.floor(sec);
  const ms = Math.round((sec - S) * 1000);
  const d = new Date(p.y, p.m - 1, p.d, H, M, S, ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Serial de fecha Excel (días desde 1899-12-30).
 * Excluye importes tipo `3926,44` como number (parte entera < 30000).
 */
function isLikelyExcelDateSerial(v: number): boolean {
  if (!Number.isFinite(v)) return false;
  const whole = Math.floor(Math.abs(v));
  if (v % 1 !== 0) {
    return whole >= 30000 && whole < 80000;
  }
  return whole >= 20000 && whole < 80000;
}

/** Fecha/hora Optimus → `Date` local (texto, serial, `Date` nativo, ISO). */
export function optimusCellToLocalDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (isLikelyExcelDateSerial(v)) {
      const fromSerial = excelSerialToLocalDate(v);
      if (fromSerial) return fromSerial;
    }
  }
  const s = cellStr(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = parseDmyOptionalTimeToLocalDate(s);
  if (dmy) return dmy;
  const ymd = excelCellToDateInput(v);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Para columnas Postgres `date`: `YYYY-MM-DD` en calendario local. */
function localDateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Para `timestamptz`. */
export function optimusCellToIsoTimestamptz(v: unknown): string | null {
  const d = optimusCellToLocalDate(v);
  return d ? d.toISOString() : null;
}

/** Solo día (columnas `fecha_apertura` / `fecha_entrega` tipo `date`). */
export function optimusCellToYmd(v: unknown): string | null {
  const d = optimusCellToLocalDate(v);
  return d ? localDateToYmd(d) : null;
}

function pickNumPedido(r: Record<string, unknown>): string {
  const raw = pick(
    r,
    "Nº Pedido",
    "Nº pedido",
    "Num Pedido",
    "num_pedido",
    "id_pedido"
  );
  const s = cellStr(raw).replace(/\s+/g, "");
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits) return digits;
  return cellStr(raw).trim();
}

/** Valores que son claramente fechas (Optimus a veces pone fechas en columnas mal alineadas). */
export function looksLikeDateCell(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true;
  const compact = t.replace(/\s+/g, "");
  if (/^\d{1,2}[-/][A-Za-z]{3,}[-/]\d{2,4}$/.test(compact)) return true;
  if (/\d{1,2}:\d{2}\s+\d{1,2}[-/][A-Za-z]/i.test(t)) return true;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(compact)) return true;
  if (/^\d{1,2}-[A-Za-z]{3}-\d{2}$/i.test(compact)) return true;
  return false;
}

/**
 * Familia / análisis ventas: solo por nombre de cabecera (nunca por índice).
 * Si «Análisis ventas» trae una fecha (export desplazado), se usa «Tipo pedido».
 */
function pickFamiliaOptimus(r: Record<string, unknown>): string {
  const fromAnalisis = cellStr(
    pick(
      r,
      "Análisis ventas",
      "Análisis venta",
      "Analisis ventas",
      "Analisis venta",
      "Análisis de ventas",
      "Analisis de ventas",
      "ANÁLISIS VENTAS",
      "analisis ventas"
    )
  ).trim();

  if (fromAnalisis && !looksLikeDateCell(fromAnalisis)) {
    return fromAnalisis;
  }

  const fromTipo = cellStr(
    pick(
      r,
      "Tipo pedido",
      "Tipo Pedido",
      "tipo_pedido",
      "Tipo de pedido",
      "Tipo  pedido"
    )
  ).trim();
  if (fromTipo && !looksLikeDateCell(fromTipo)) {
    return fromTipo;
  }

  const fromFamilia = cellStr(pick(r, "Familia", "familia")).trim();
  if (fromFamilia && !looksLikeDateCell(fromFamilia)) {
    return fromFamilia;
  }

  return fromTipo;
}

function pickVendedorOptimus(r: Record<string, unknown>): string {
  return cellStr(
    pick(
      r,
      "Vendedor",
      "VENDEDOR",
      "vendedor",
      "Nombre Vendedor",
      "Nombre vendedor",
      "Vendedor/a",
      "Vendedora"
    )
  ).trim();
}

function isLikelyNumericEstadoCell(v: unknown): boolean {
  if (v == null || v === "") return true;
  if (typeof v === "number" && Number.isFinite(v)) return true;
  const s = cellStr(v).trim();
  if (!s) return true;
  if (/[a-záéíóúñü]/i.test(s)) return false;
  return /^[\d.\s,]+$/.test(s);
}

/** Prefiere la columna de estado con texto (no el código numérico duplicado). */
function pickEstadoTextoOptimus(r: Record<string, unknown>): string {
  const pairs: { key: string; val: unknown }[] = [];
  for (const [k, v] of Object.entries(r)) {
    const nk = normalizeKey(k);
    if (nk === "estado" || nk.includes("estado")) {
      pairs.push({ key: k, val: v });
    }
  }
  for (const { val } of pairs) {
    if (!isLikelyNumericEstadoCell(val)) {
      return cellStr(val).trim();
    }
  }
  if (pairs.length > 0) {
    return cellStr(pairs[0].val).trim();
  }
  return cellStr(
    pick(r, "Estado (texto)", "Estado texto", "Estado descripción", "Estado")
  ).trim();
}

/** Si el export solo trae código numérico en la columna Estado, convierte a texto conocido. */
function normalizeEstadoImport(raw: string): {
  estado_desc: string;
  estado_cod: number | null;
} {
  const t = raw.trim();
  if (!t) return { estado_desc: "", estado_cod: null };
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    const byCod: Record<number, string> = {
      4: "Terminado",
      3: "En producción",
      1: "Lanzado",
      2: "Retrasado",
    };
    const desc = byCod[n];
    if (desc) return { estado_desc: desc, estado_cod: n };
    return { estado_desc: "", estado_cod: Number.isFinite(n) ? n : null };
  }
  return {
    estado_desc: t,
    estado_cod: inferEstadoCodFromDesc(t),
  };
}

function parseIntLoose(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseRow(
  raw: Record<string, unknown>,
  rowIndex: number
): { row?: OptimusOtsUpsertRow; skip?: string } {
  const r = normalizeSalesRecord(trimColumnKeys(raw));
  const num_pedido = pickNumPedido(r);
  if (!num_pedido) {
    return { skip: `Fila ${rowIndex}: sin Nº Pedido.` };
  }

  const rawEstado = pickEstadoTextoOptimus(r);
  const { estado_desc, estado_cod: estadoCodNorm } = normalizeEstadoImport(rawEstado);
  const cliente = cellStr(pick(r, "Cliente", "cliente")).trim();
  const titulo = cellStr(
    pick(r, "Título", "Titulo", "titulo", "Trabajo", "trabajo")
  ).trim();
  const familia = pickFamiliaOptimus(r);
  const vendedor = pickVendedorOptimus(r);
  const pedido_cliente = cellStr(
    pick(
      r,
      "Pedido Cliente",
      "Pedido             Cliente",
      "pedido_cliente",
      "Pedido_Cliente",
      "Ref Cliente",
      "Ref_cliente"
    )
  ).trim();
  const tipo_pedido = cellStr(
    pick(r, "Tipo pedido", "Tipo Pedido", "tipo_pedido", "Tipo de pedido")
  ).trim();
  const prueba_color = cellStr(
    pick(r, "Prueba color", "Prueba Color", "prueba_color", "Prueba  color")
  ).trim();
  const pdf_ok = cellStr(
    pick(
      r,
      "PDF para ok",
      "PDF para OK",
      "Pdf para ok",
      "pdf_ok",
      "PDF OK",
      "Pdf ok"
    )
  ).trim();
  const muestra_ok = cellStr(
    pick(
      r,
      "Muestra para OK",
      "Muestra para ok",
      "muestra_ok",
      "Muestra OK",
      "Muestra ok"
    )
  ).trim();

  const cantRaw = pick(
    r,
    "Cantidad pedida",
    "Cantidad             pedida",
    "cantidad_pedida",
    "Cantidad Pedida",
    "cantidad"
  );
  const cantidad = parseSpanishInteger(cantRaw);

  const valorRaw = pick(
    r,
    "Valor Potencial",
    "valor_potencial",
    "Valor potencial"
  );
  const valor_potencial = parseSpanishDecimal(valorRaw);

  const prioridad = parseIntLoose(pick(r, "Prioridad", "prioridad", "PRIORIDAD"));

  const faCell = pick(
    r,
    "Fecha Apertura",
    "fecha_apertura",
    "Fecha apertura",
    "F. Apertura",
    "F Apertura"
  );
  const feCell = pick(
    r,
    "Fecha Entrega",
    "Fecha_Entrega",
    "fecha_entrega",
    "Fecha             Entrega",
    "F. Entrega",
    "F Entrega"
  );
  const utCell = pick(
    r,
    "Última transacción",
    "Ultima transaccion",
    "ultima_transaccion",
    "Última Transacción",
    "Ultima Transacción",
    "Ultima Transacción"
  );

  const fecha_apertura = optimusCellToYmd(faCell);
  const fecha_entrega = optimusCellToYmd(feCell);
  const ultima_transaccion = optimusCellToIsoTimestamptz(utCell);

  return {
    row: {
      num_pedido,
      estado_desc,
      estado_cod: estadoCodNorm,
      cliente,
      titulo,
      familia,
      cantidad,
      valor_potencial,
      fecha_apertura,
      fecha_entrega,
      ultima_transaccion,
      vendedor,
      pedido_cliente,
      prioridad,
      tipo_pedido,
      prueba_color,
      pdf_ok,
      muestra_ok,
      updated_at: new Date().toISOString(),
    },
  };
}

export type OptimusOtsImportResult = {
  rows: OptimusOtsUpsertRow[];
  warnings: string[];
  filasLeidas: number;
};

function sheetToJson(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    /** Valores nativos: cantidades 50000, importes y seriales de fecha sin perder miles/decimales. */
    raw: true,
  });
}

export function parseOptimusOtsMasterExcelBuffer(
  buffer: ArrayBuffer
): OptimusOtsImportResult {
  const warnings: string[] = [];
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], warnings: ["El archivo no contiene hojas."], filasLeidas: 0 };
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], warnings: ["No se pudo leer la hoja."], filasLeidas: 0 };
  }
  const json = sheetToJson(sheet);
  const rows: OptimusOtsUpsertRow[] = [];
  let i = 0;
  for (const raw of json) {
    i += 1;
    const parsed = parseRow(raw, i);
    if (parsed.skip) {
      warnings.push(parsed.skip);
      continue;
    }
    if (parsed.row) rows.push(parsed.row);
  }
  return { rows, warnings, filasLeidas: json.length };
}

export function parseOptimusOtsMasterCsvText(text: string): OptimusOtsImportResult {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    const msg = parsed.errors.slice(0, 3).map((e) => e.message).join(" · ");
    return { rows: [], warnings: [`CSV: ${msg}`], filasLeidas: 0 };
  }
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  const rows: OptimusOtsUpsertRow[] = [];
  const warnings: string[] = [];
  let i = 0;
  for (const raw of data) {
    i += 1;
    const p = parseRow(raw, i);
    if (p.skip) warnings.push(p.skip);
    else if (p.row) rows.push(p.row);
  }
  return { rows, warnings, filasLeidas: data.length };
}

export async function parseOptimusOtsMasterFile(
  file: File
): Promise<OptimusOtsImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseOptimusOtsMasterCsvText(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    return parseOptimusOtsMasterExcelBuffer(buf);
  }
  return {
    rows: [],
    warnings: ["Formato no admitido. Usa .xlsx o .csv."],
    filasLeidas: 0,
  };
}
