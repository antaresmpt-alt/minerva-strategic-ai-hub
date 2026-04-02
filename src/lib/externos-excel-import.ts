import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  cellNum,
  cellStr,
  normalizeSalesRecord,
  pick,
} from "@/lib/sales-parse-rows";

/** Solo estas filas del export Optimus pasan a la sala de validación. */
const ESTADOS_INCLUIDOS = new Set(["abierto", "en curso"]);

function normalizeEstadoClave(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function esEstadoIncluido(estadoRaw: string): boolean {
  const n = normalizeEstadoClave(estadoRaw);
  return ESTADOS_INCLUIDOS.has(n);
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
    let dd = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
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

function buildCandidatesFromJsonRows(
  json: Record<string, unknown>[]
): { rows: ExternosImportCandidate[]; parseWarnings: string[] } {
  const parseWarnings: string[] = [];
  const rows: ExternosImportCandidate[] = [];
  let rowIndex = 0;
  for (const raw of json) {
    rowIndex += 1;
    const r = normalizeSalesRecord(raw);
    const estadoOpt = cellStr(
      pick(r, "estado_optimus", "Estado", "Estado Optimus", "Estado_Optimus")
    );
    if (!estadoOpt) continue;
    if (!esEstadoIncluido(estadoOpt)) continue;

    const idPedido = cellNum(
      pick(
        r,
        "id_pedido",
        "ID_Pedido",
        "ID Pedido",
        "Nº Pedido",
        "Nº pedido",
        "No Pedido",
        "Numero Pedido",
        "Número Pedido"
      )
    );
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

  if (rows.length === 0 && json.length > 0) {
    parseWarnings.push(
      "No quedó ninguna fila con estado «Abierto» o «En Curso» y OT válida. Revisa el archivo."
    );
  }

  return { rows, parseWarnings };
}

/**
 * Primera hoja del Excel, filas con `estado_optimus` Abierto / En Curso.
 */
export function parseExternosExcelBuffer(buffer: ArrayBuffer): {
  rows: ExternosImportCandidate[];
  parseWarnings: string[];
} {
  const parseWarnings: string[] = [];
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) {
    return { rows: [], parseWarnings: ["El archivo no contiene ninguna hoja."] };
  }
  const sheet = wb.Sheets[name];
  if (!sheet) {
    return { rows: [], parseWarnings: ["No se pudo leer la primera hoja."] };
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const built = buildCandidatesFromJsonRows(json);
  return { rows: built.rows, parseWarnings: [...parseWarnings, ...built.parseWarnings] };
}

/** CSV con cabecera (mismas columnas que el Excel Optimus). */
export function parseExternosCsvText(text: string): {
  rows: ExternosImportCandidate[];
  parseWarnings: string[];
} {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    const msg = parsed.errors.slice(0, 3).map((e) => e.message).join(" · ");
    return {
      rows: [],
      parseWarnings: [`Error al leer CSV: ${msg}`],
    };
  }
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  return buildCandidatesFromJsonRows(data);
}

/** Solo admite `.xlsx` o `.csv` en el nombre del archivo. */
export async function parseExternosImportFile(file: File): Promise<{
  rows: ExternosImportCandidate[];
  parseWarnings: string[];
}> {
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
  };
}
