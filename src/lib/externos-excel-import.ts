import Papa from "papaparse";
import * as XLSX from "xlsx";

import { cellStr, normalizeSalesRecord, pick } from "@/lib/sales-parse-rows";

/**
 * Colapsa espacios (p. ej. 'En  Producción'), quita tildes y compara estable.
 */
function normalizeEstadoClave(s: string): string {
  return String(s)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Cada cabecera del Excel/CSV: trim inmediato; duplicados tras trim → sufijo. */
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

const ESTADOS_INCLUIDOS = new Set(
  ["abierto", "en curso", "no empezado", "en produccion"].map((x) =>
    normalizeEstadoClave(x)
  )
);

/** Descarte silencioso: no cuenta como filasOmitidasPorEstado. */
const ESTADOS_DESCARTE_SILENCIOSO = new Set(
  ["cancelado", "suspendido", "terminado"].map((x) => normalizeEstadoClave(x))
);

/**
 * Código interno Optimus (p. ej. 4100) frente a nombre de estado.
 * Optimus exporta a veces "4,100" — Number("4,100") es NaN; hay que ignorar
 * separadores de miles antes de decidir.
 */
function isLikelyNumericEstadoCode(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "number" && Number.isFinite(v)) return true;
  const s = String(v).trim();
  if (!s) return false;
  if (/[a-záéíóúñü]/i.test(s)) return false;
  const compact = s.replace(/[\s.,']/g, "");
  return /^\d+$/.test(compact) && compact.length > 0;
}

/**
 * Entre varias columnas *Estado*, usa la que no sea solo numérica (p. ej. 4100
 * vs «En producción»).
 */
function pickEstadoOptimusValue(r: Record<string, unknown>): string {
  const candidates: [string, unknown][] = [];
  for (const [k, v] of Object.entries(r)) {
    const kt = String(k).trim().toLowerCase();
    if (
      kt === "estado_optimus" ||
      kt === "estado" ||
      kt.includes("estado")
    ) {
      candidates.push([k, v]);
    }
  }
  if (candidates.length === 0) {
    return cellStr(
      pick(r, "estado_optimus", "Estado Optimus", "Estado_Optimus", "Estado")
    );
  }
  if (candidates.length === 1) {
    return cellStr(candidates[0][1]);
  }
  const texto = candidates.filter(([, v]) => !isLikelyNumericEstadoCode(v));
  if (texto.length >= 1) {
    return cellStr(texto[0][1]);
  }
  return cellStr(candidates[0][1]);
}

function pickIdPedidoRaw(r: Record<string, unknown>): unknown {
  return pick(r, "Nº Pedido", "id_pedido");
}

/**
 * OT numérica. Optimus suele exportar "35,302" — Number() falla; solo dígitos.
 * Exportada por compatibilidad.
 */
export function parseIdPedidoOptimus(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number" && Number.isFinite(v)) {
    const t = Math.trunc(v);
    return t > 0 ? t : NaN;
  }
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return NaN;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER) {
    return NaN;
  }
  return Math.trunc(n);
}

/**
 * Convierte celda Excel/CSV a `YYYY-MM-DD` (ignora hora en strings tipo
 * `YYYY-MM-DD HH:mm:ss`).
 */
export function fechaExcelADateInput(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = cellStr(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    const dt = new Date(yy, mo - 1, dd);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(s.replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return "";
}

/** Fecha prevista por defecto: un día antes de la entrega al cliente (externo entrega antes). */
export function fechaPrevistaDefaultDesdeEntrega(fechaEntregaCell: unknown): string {
  const ymd = fechaExcelADateInput(fechaEntregaCell);
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Solo fecha DD/MM/YYYY para la tabla de validación (oculta horas). */
export function formatEntregaClienteSoloFecha(raw: string): string {
  if (raw == null || String(raw).trim() === "") return "—";
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3])
    );
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
  const parsed = new Date(s.replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return s;
}

export type ExternosImportCandidate = {
  id_pedido: number;
  cliente: string;
  ref_cliente: string;
  titulo: string;
  /** Valor crudo del archivo (p. ej. con hora) para notas / trazabilidad. */
  fecha_entrega_excel: string;
  /** Valor por defecto para fecha prevista (YYYY-MM-DD), un día antes de entrega cliente. */
  fecha_prevista_default: string;
};

export type ExternosImportParseResult = {
  rows: ExternosImportCandidate[];
  parseWarnings: string[];
  /** Filas con estado no permitido (excl. descarte silencioso). */
  filasOmitidasPorEstado: number;
  /** Número de filas de datos leídas del archivo (excl. cabecera). */
  filasLeidas: number;
};

function buildCandidatesFromJsonRows(
  json: Record<string, unknown>[]
): ExternosImportParseResult {
  const parseWarnings: string[] = [];
  const rows: ExternosImportCandidate[] = [];
  let filasOmitidasPorEstado = 0;
  let rowIndex = 0;
  for (const raw of json) {
    rowIndex += 1;
    const r = normalizeSalesRecord(trimColumnKeys(raw));

    const estadoRaw = pickEstadoOptimusValue(r);
    const idRaw = pickIdPedidoRaw(r);

    if (!estadoRaw.trim()) continue;

    const estadoN = normalizeEstadoClave(estadoRaw);
    if (ESTADOS_DESCARTE_SILENCIOSO.has(estadoN)) continue;

    if (!ESTADOS_INCLUIDOS.has(estadoN)) {
      filasOmitidasPorEstado += 1;
      continue;
    }

    const idPedido = parseIdPedidoOptimus(idRaw);
    if (Number.isNaN(idPedido) || idPedido <= 0) {
      parseWarnings.push(`Fila ${rowIndex}: OT no válida (se omite).`);
      continue;
    }

    const cliente = cellStr(pick(r, "Cliente", "cliente"));
    const refCliente = cellStr(
      pick(
        r,
        "ref_cliente",
        "Ref Cliente",
        "Ref_cliente",
        "Pedido Cliente",
        "Pedido_Cliente",
        "pedido_cliente"
      )
    );
    const titulo = cellStr(
      pick(
        r,
        "título",
        "Título",
        "Titulo",
        "titulo",
        "titulo ",
        "Trabajo",
        "trabajo",
        "trabajo_titulo"
      )
    );

    const fechaEntregaCell = pick(
      r,
      "Fecha_Entrega",
      "Fecha Entrega",
      "fecha_entrega",
      "fecha_entrega_cliente",
      "Fecha entrega"
    );
    const fecha_entrega_excel = cellStr(fechaEntregaCell);
    const fecha_prevista_default =
      fechaPrevistaDefaultDesdeEntrega(fechaEntregaCell);

    rows.push({
      id_pedido: idPedido,
      cliente,
      ref_cliente: refCliente,
      titulo,
      fecha_entrega_excel,
      fecha_prevista_default,
    });
  }

  return {
    rows,
    parseWarnings,
    filasOmitidasPorEstado,
    filasLeidas: json.length,
  };
}

/**
 * Primera hoja del Excel, filas con estado Optimus permitido para externo.
 */
export function parseExternosExcelBuffer(buffer: ArrayBuffer): ExternosImportParseResult {
  const parseWarnings: string[] = [];
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) {
    return {
      rows: [],
      parseWarnings: ["El archivo no contiene ninguna hoja."],
      filasOmitidasPorEstado: 0,
      filasLeidas: 0,
    };
  }
  const sheet = wb.Sheets[name];
  if (!sheet) {
    return {
      rows: [],
      parseWarnings: ["No se pudo leer la primera hoja."],
      filasOmitidasPorEstado: 0,
      filasLeidas: 0,
    };
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const built = buildCandidatesFromJsonRows(json);
  return {
    rows: built.rows,
    parseWarnings: [...parseWarnings, ...built.parseWarnings],
    filasOmitidasPorEstado: built.filasOmitidasPorEstado,
    filasLeidas: built.filasLeidas,
  };
}

/** CSV con cabecera (mismas columnas que el Excel Optimus). */
export function parseExternosCsvText(text: string): ExternosImportParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    const msg = parsed.errors.slice(0, 3).map((e) => e.message).join(" · ");
    return {
      rows: [],
      parseWarnings: [`Error al leer CSV: ${msg}`],
      filasOmitidasPorEstado: 0,
      filasLeidas: 0,
    };
  }
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  return buildCandidatesFromJsonRows(data);
}

/** Solo admite `.xlsx` o `.csv` en el nombre del archivo. */
export async function parseExternosImportFile(
  file: File
): Promise<ExternosImportParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseExternosCsvText(text);
  }
  if (name.endsWith(".xlsx")) {
    const buf = await file.arrayBuffer();
    return parseExternosExcelBuffer(buf);
  }
  return {
    rows: [],
    parseWarnings: ["Formato no soportado. Usa .xlsx o .csv."],
    filasOmitidasPorEstado: 0,
    filasLeidas: 0,
  };
}
