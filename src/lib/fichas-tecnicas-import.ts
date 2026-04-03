import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  fechaExcelADateInput,
  parseIdPedidoOptimus,
} from "@/lib/externos-excel-import";
import { cellStr, normalizeSalesRecord, pick } from "@/lib/sales-parse-rows";

/** Cada cabecera: trim; duplicados tras trim → sufijo (mismo criterio que externos). */
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

function pickOtRaw(r: Record<string, unknown>): unknown {
  return pick(
    r,
    "id_pedido",
    "ID_Pedido",
    "ID Pedido",
    "OT",
    "ot",
    "Nº Pedido",
    "Nº pedido",
    "Numero Pedido",
    "Número Pedido"
  );
}

function parseDensidadCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function densidadN(r: Record<string, unknown>, n: number): number | null {
  const raw = pick(
    r,
    `Densidad Tinta ${n}`,
    `densidad_${n}`,
    `densidad_tinta_${n}`,
    `Densidad tinta ${n}`,
    `Densidad Tinta${n}`,
    `Densidad ${n}`,
    `Tinta ${n}`,
    `DENSIDAD_TINTA_${n}`
  );
  return parseDensidadCell(raw);
}

/** Fila lista para upsert en prod_fichas_tecnicas (nombres = columnas SQL). */
export type FichaTecnicaImportPayload = {
  ot: number;
  cliente: string;
  trabajo: string;
  gramaje: string | null;
  tipo_material: string | null;
  formato: string | null;
  pasadas: string | null;
  tipo_impresion: string | null;
  densidad_1: number | null;
  densidad_2: number | null;
  densidad_3: number | null;
  densidad_4: number | null;
  densidad_5: number | null;
  densidad_6: number | null;
  densidad_7: number | null;
  densidad_8: number | null;
  notas: string | null;
  ruta_backup: string | null;
  fecha: string | null;
  maquinista: string | null;
};

export type FichasTecnicasImportParseResult = {
  rows: FichaTecnicaImportPayload[];
  parseWarnings: string[];
  filasLeidas: number;
};

function buildPayloadFromRecord(
  r: Record<string, unknown>,
  rowIndex: number,
  parseWarnings: string[]
): FichaTecnicaImportPayload | null {
  const ot = parseIdPedidoOptimus(pickOtRaw(r));
  if (Number.isNaN(ot) || ot <= 0) {
    parseWarnings.push(`Fila ${rowIndex}: OT no válida (se omite).`);
    return null;
  }

  const cliente = cellStr(
    pick(
      r,
      "Nombre Cliente",
      "nombre_cliente",
      "cliente",
      "Cliente",
      "Nombre cliente"
    )
  );
  const trabajo = cellStr(
    pick(
      r,
      "Nombre Trabajo",
      "nombre_trabajo",
      "trabajo",
      "Trabajo",
      "Título",
      "Titulo",
      "titulo"
    )
  );

  const gramaje = cellStr(
    pick(r, "Gramaje", "gramaje", "GRS", "g/m²", "g/m2")
  );
  const tipo_material = cellStr(
    pick(
      r,
      "Tipo de material",
      "Tipo de Material",
      "Tipo Material",
      "tipo_material",
      "Material",
      "material"
    )
  );
  const formato = cellStr(pick(r, "Formato", "formato", "Tamaño", "tamano"));
  const pasadas = cellStr(
    pick(r, "Pasadas", "pasadas", "Nº Pasadas", "Num. Pasadas")
  );
  const tipo_impresion = cellStr(
    pick(
      r,
      "Tipo_impresion",
      "Tipo de Impresión",
      "Tipo Impresión",
      "tipo_impresion",
      "Tipo impresión",
      "Tintas",
      "tintas",
      "Tipo tintas"
    )
  );

  const notas = cellStr(pick(r, "Notas", "notas", "Observaciones", "observaciones"));
  const ruta_backup = cellStr(
    pick(
      r,
      "Adjuntos",
      "adjuntos",
      "Ruta de Backup",
      "Ruta backup",
      "ruta_backup",
      "Backup",
      "Path",
      "Ruta"
    )
  );

  const fechaCell = pick(
    r,
    "Fecha Trabajo",
    "Fecha",
    "fecha",
    "fecha_ficha",
    "Fecha Ficha",
    "Fecha creación",
    "Fecha creacion"
  );
  const fecha = fechaExcelADateInput(fechaCell) || null;

  const maquinista = cellStr(
    pick(
      r,
      "Maquinista",
      "maquinista",
      "Oficial",
      "oficial_maquinista",
      "Oficial (Maquinista)",
      "Operario"
    )
  );

  return {
    ot,
    cliente,
    trabajo,
    gramaje: gramaje || null,
    tipo_material: tipo_material || null,
    formato: formato || null,
    pasadas: pasadas || null,
    tipo_impresion: tipo_impresion || null,
    densidad_1: densidadN(r, 1),
    densidad_2: densidadN(r, 2),
    densidad_3: densidadN(r, 3),
    densidad_4: densidadN(r, 4),
    densidad_5: densidadN(r, 5),
    densidad_6: densidadN(r, 6),
    densidad_7: densidadN(r, 7),
    densidad_8: densidadN(r, 8),
    notas: notas || null,
    ruta_backup: ruta_backup || null,
    fecha,
    maquinista: maquinista || null,
  };
}

function buildRowsFromJson(
  json: Record<string, unknown>[]
): FichasTecnicasImportParseResult {
  const parseWarnings: string[] = [];
  const rows: FichaTecnicaImportPayload[] = [];
  let rowIndex = 0;
  for (const raw of json) {
    rowIndex += 1;
    const r = normalizeSalesRecord(trimColumnKeys(raw));
    const payload = buildPayloadFromRecord(r, rowIndex, parseWarnings);
    if (payload) rows.push(payload);
  }
  return { rows, parseWarnings, filasLeidas: json.length };
}

export function parseFichasTecnicasExcelBuffer(
  buffer: ArrayBuffer
): FichasTecnicasImportParseResult {
  const parseWarnings: string[] = [];
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
  const built = buildRowsFromJson(json);
  return {
    rows: built.rows,
    parseWarnings: [...parseWarnings, ...built.parseWarnings],
    filasLeidas: built.filasLeidas,
  };
}

export function parseFichasTecnicasCsvText(
  text: string
): FichasTecnicasImportParseResult {
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

export async function parseFichasTecnicasImportFile(
  file: File
): Promise<FichasTecnicasImportParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseFichasTecnicasCsvText(text);
  }
  if (name.endsWith(".xlsx")) {
    const buf = await file.arrayBuffer();
    return parseFichasTecnicasExcelBuffer(buf);
  }
  return {
    rows: [],
    parseWarnings: ["Formato no soportado. Usa .xlsx o .csv."],
    filasLeidas: 0,
  };
}
