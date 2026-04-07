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

/** Estados válidos en `prod_seguimiento_externos.estado` (operativa fábrica). */
export const ESTADOS_SEGUIMIENTO_EXTERNOS = [
  "Pendiente",
  "Enviado",
  "En Minerva para salir",
  "En Proveedor",
  "Acabado en Proveedor",
  "Retrasado",
  "Parcial",
  "Muelle Minerva",
  "Recibido",
] as const;

const ESTADOS_OPTIMUS_INCLUIDOS = new Set(
  [
    "abierto",
    "en curso",
    "no empezado",
    "en produccion",
    "en cola",
  ].map((x) => normalizeEstadoClave(x))
);

/** Descarte silencioso: no cuenta como filasOmitidasPorEstado. */
const ESTADOS_DESCARTE_SILENCIOSO = new Set(
  ["cancelado", "suspendido", "terminado"].map((x) => normalizeEstadoClave(x))
);

function isLikelyNumericEstadoCode(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "number" && Number.isFinite(v)) return true;
  const s = String(v).trim();
  if (!s) return false;
  if (/[a-záéíóúñü]/i.test(s)) return false;
  const compact = s.replace(/[\s.,']/g, "");
  return /^\d+$/.test(compact) && compact.length > 0;
}

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
  return pick(r, "Nº Pedido", "id_pedido", "Nº pedido");
}

/**
 * OT numérica. Optimus suele exportar "35,302" — solo dígitos.
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

/** Vacío / «no data» → placeholder pedido en fábrica. */
export const OT_PLACEHOLDER_PEDIDO = 999999;

/** Exportado para formulario manual de envío. */
export function normalizeOtRawToString(raw: unknown): string {
  const s = cellStr(raw);
  if (!s || /^no\s*data$/i.test(s)) return String(OT_PLACEHOLDER_PEDIDO);
  return s.trim();
}

export function otRawToIdPedido(otRaw: string): number {
  const n = parseIdPedidoOptimus(otRaw);
  if (!Number.isNaN(n) && n > 0) return n;
  return OT_PLACEHOLDER_PEDIDO;
}

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

/**
 * Número serial Excel o fecha → `YYYY-MM-DD`.
 */
export function excelCellToDateInput(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return fechaExcelADateInput(v);
  }
  if (typeof v === "number" && v > 20000 && v < 120000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && typeof d.y === "number") {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  return fechaExcelADateInput(v);
}

export function fechaPrevistaDefaultDesdeEntrega(fechaEntregaCell: unknown): string {
  const ymd = fechaExcelADateInput(fechaEntregaCell);
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

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

export type ExternosImportFormat = "hermano" | "optimus";

export type ExternosImportCandidate = {
  /** Origen del parseo (sala de validación / toasts). */
  format: ExternosImportFormat;
  /** Valor OT tal cual en Excel (tras normalizar placeholder). */
  ot_raw: string;
  id_pedido: number;
  cliente: string;
  ref_cliente: string;
  titulo: string;
  fecha_entrega_excel: string;
  fecha_prevista_default: string;
  unidades: number | null;
  prioridad: string | null;
  palets: number | null;
  observaciones: string | null;
  /** Estado al insertar en seguimiento */
  estado_sugerido: string;
  fecha_envio_default: string;
  /** Control Externos: texto de columna PROVEEDOR (fuzzy → proveedor_id en UI). */
  proveedor_excel: string | null;
  /** Control Externos: texto de columna PROCESO (fuzzy → acabado_id en UI). */
  proceso_excel: string | null;
};

export type ExternosImportParseResult = {
  rows: ExternosImportCandidate[];
  parseWarnings: string[];
  filasOmitidasPorEstado: number;
  filasLeidas: number;
  format: ExternosImportFormat;
};

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

function normalizePrioridad(v: unknown): string | null {
  const s = cellStr(v);
  if (!s) return null;
  const n = normalizeEstadoClave(s);
  if (n.includes("urgent")) return "Urgente";
  if (n.includes("program")) return "Programado";
  if (n === "normal" || n.includes("normal")) return "Normal";
  return s;
}

/**
 * Mapea texto de Excel «Control Externos» a estado interno.
 */
function mapHermanoEstado(raw: string): string {
  const n = normalizeEstadoClave(raw);
  if (!n) return "Pendiente";
  const table: Record<string, string> = {
    pendiente: "Pendiente",
    enviado: "Enviado",
    "en minerva para salir": "En Minerva para salir",
    "en proveedor": "En Proveedor",
    "acabado en proveedor": "Acabado en Proveedor",
    retrasado: "Retrasado",
    parcial: "Parcial",
    "muelle minerva": "Muelle Minerva",
    recibido: "Recibido",
    recepcionado: "Recibido",
    recepción: "Recibido",
    finalizado: "Recibido",
  };
  if (table[n]) return table[n];
  const matchCanon = ESTADOS_SEGUIMIENTO_EXTERNOS.find(
    (e) => normalizeEstadoClave(e) === n
  );
  if (matchCanon) return matchCanon;
  return "Pendiente";
}

function isHermanoSheet(json: Record<string, unknown>[]): boolean {
  if (json.length === 0) return false;
  const keys = new Set(
    Object.keys(trimColumnKeys(json[0])).map((k) => k.trim())
  );
  /** Hoja «Control Externos»: cabeceras fijas OT + CLIENTE + TRABAJO. */
  return keys.has("OT") && keys.has("CLIENTE") && keys.has("TRABAJO");
}

function buildCandidatesFromHermanoRows(
  json: Record<string, unknown>[]
): ExternosImportParseResult {
  const parseWarnings: string[] = [];
  const rows: ExternosImportCandidate[] = [];
  let rowIndex = 0;
  for (const raw of json) {
    rowIndex += 1;
    const r = normalizeSalesRecord(trimColumnKeys(raw));
    const otStr = normalizeOtRawToString(pick(r, "OT", "ot"));
    const id_pedido = otRawToIdPedido(otStr);
    const cliente = cellStr(pick(r, "CLIENTE", "Cliente", "cliente"));
    const titulo = cellStr(
      pick(r, "TRABAJO", "Trabajo", "trabajo", "trabajo_titulo")
    );
    if (!titulo && !cliente && id_pedido === OT_PLACEHOLDER_PEDIDO) {
      continue;
    }
    if (!titulo && !cliente) {
      parseWarnings.push(`Fila ${rowIndex}: sin cliente ni trabajo (omitida).`);
      continue;
    }

    const unidades = parseIntLoose(pick(r, "UNIDADES", "Unidades", "unidades"));
    const prioridad = normalizePrioridad(
      pick(r, "PRIORIDAD", "Prioridad", "prioridad")
    );
    const palets = parseIntLoose(pick(r, "PALETS", "Palets", "palets"));
    const observaciones = cellStr(
      pick(r, "OBSERVACIONES", "Observaciones", "observaciones")
    );
    const estadoRaw = cellStr(pick(r, "ESTADO", "Estado", "estado"));
    const estado_sugerido = mapHermanoEstado(estadoRaw);

    const fechaEntregaCell = pick(
      r,
      "Fecha Entrega",
      "Fecha_Entrega",
      "fecha_entrega",
      "fecha_entrega_cliente"
    );
    const fecha_entrega_excel = cellStr(fechaEntregaCell);

    const fechaEnvioCell = pick(
      r,
      "FECHA ENVÍO",
      "FECHA ENVIO",
      "Fecha envío",
      "Fecha Envío",
      "fecha_envio",
      "FECHA ENVIO"
    );
    const fechaPrevCell = pick(
      r,
      "FECHA PREVISTA",
      "Fecha prevista",
      "fecha_prevista",
      "FECHA PREVISTA "
    );

    let fecha_prevista_default = excelCellToDateInput(fechaPrevCell);
    if (!fecha_prevista_default) {
      fecha_prevista_default = fechaPrevistaDefaultDesdeEntrega(fechaEntregaCell);
    }

    const fecha_envio_default = excelCellToDateInput(fechaEnvioCell);

    const ref_cliente = cellStr(
      pick(r, "Pedido Cliente", "pedido_cliente", "REF", "Ref")
    );

    const proveedor_excel = cellStr(
      pick(r, "PROVEEDOR", "Proveedor", "proveedor")
    );
    const proceso_excel = cellStr(pick(r, "PROCESO", "Proceso", "proceso"));

    rows.push({
      format: "hermano",
      ot_raw: otStr,
      id_pedido,
      cliente,
      ref_cliente,
      titulo,
      fecha_entrega_excel,
      fecha_prevista_default,
      unidades,
      prioridad,
      palets,
      observaciones: observaciones || null,
      estado_sugerido,
      fecha_envio_default,
      proveedor_excel: proveedor_excel || null,
      proceso_excel: proceso_excel || null,
    });
  }

  return {
    rows,
    parseWarnings,
    filasOmitidasPorEstado: 0,
    filasLeidas: json.length,
    format: "hermano",
  };
}

function buildCandidatesFromOptimusRows(
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

    if (!ESTADOS_OPTIMUS_INCLUIDOS.has(estadoN)) {
      filasOmitidasPorEstado += 1;
      continue;
    }

    const idPedido = parseIdPedidoOptimus(idRaw);
    if (Number.isNaN(idPedido) || idPedido <= 0) {
      parseWarnings.push(`Fila ${rowIndex}: OT no válida (se omite).`);
      continue;
    }

    const otStr = String(idPedido);
    const cliente = cellStr(pick(r, "Cliente", "cliente"));
    const refCliente = cellStr(
      pick(
        r,
        "ref_cliente",
        "Ref Cliente",
        "Ref_cliente",
        "Pedido Cliente",
        "Pedido_Cliente",
        "pedido_cliente",
        "Pedido             Cliente"
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

    const cantidad = parseIntLoose(
      pick(
        r,
        "Cantidad pedida",
        "Cantidad             pedida",
        "cantidad_pedida",
        "Cantidad Pedida"
      )
    );

    const prioridadRaw = cellStr(
      pick(r, "Prioridad", "prioridad", "PRIORIDAD")
    );
    const prioridad = normalizePrioridad(prioridadRaw);

    const fechaEntregaCell = pick(
      r,
      "Fecha_Entrega",
      "Fecha Entrega",
      "fecha_entrega",
      "fecha_entrega_cliente",
      "Fecha entrega",
      "Fecha             Entrega"
    );
    const fecha_entrega_excel = cellStr(fechaEntregaCell);
    const fecha_prevista_default =
      fechaPrevistaDefaultDesdeEntrega(fechaEntregaCell);

    /** Optimus: «En cola» y el resto de estados incluidos entran como Pendiente de seguimiento. */
    const estado_sugerido = "Pendiente";

    rows.push({
      format: "optimus",
      ot_raw: otStr,
      id_pedido: idPedido,
      cliente,
      ref_cliente: refCliente,
      titulo,
      fecha_entrega_excel,
      fecha_prevista_default,
      unidades: cantidad,
      prioridad,
      palets: null,
      observaciones: null,
      estado_sugerido,
      fecha_envio_default: "",
      proveedor_excel: null,
      proceso_excel: null,
    });
  }

  return {
    rows,
    parseWarnings,
    filasOmitidasPorEstado,
    filasLeidas: json.length,
    format: "optimus",
  };
}

export function parseExternosExcelBuffer(buffer: ArrayBuffer): ExternosImportParseResult {
  const parseWarnings: string[] = [];
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("Control Externos")
    ? "Control Externos"
    : wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      parseWarnings: ["El archivo no contiene ninguna hoja."],
      filasOmitidasPorEstado: 0,
      filasLeidas: 0,
      format: "optimus",
    };
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return {
      rows: [],
      parseWarnings: ["No se pudo leer la hoja de datos."],
      filasOmitidasPorEstado: 0,
      filasLeidas: 0,
      format: "optimus",
    };
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const hermano = isHermanoSheet(json);
  const built = hermano
    ? buildCandidatesFromHermanoRows(json)
    : buildCandidatesFromOptimusRows(json);
  return {
    rows: built.rows,
    parseWarnings: [...parseWarnings, ...built.parseWarnings],
    filasOmitidasPorEstado: built.filasOmitidasPorEstado,
    filasLeidas: built.filasLeidas,
    format: built.format,
  };
}

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
      format: "optimus",
    };
  }
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  const hermano = isHermanoSheet(data);
  const built = hermano
    ? buildCandidatesFromHermanoRows(data)
    : buildCandidatesFromOptimusRows(data);
  return built;
}

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
    format: "optimus",
  };
}
