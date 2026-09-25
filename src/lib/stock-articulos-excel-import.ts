/**
 * Bloque 15.1b — plantilla Excel generada en app + parse/validación import stock artículos.
 * Import fila a fila vía prod_stock_articulos_alta_lote (sin RPC batch).
 */

import * as XLSX from "xlsx";

import type {
  StockArticuloEstadoProceso,
  StockArticuloUnidad,
} from "@/types/prod-stock-articulos";

export const STOCK_ARTICULOS_IMPORT_SHEET = "Stock";
export const STOCK_ARTICULOS_LISTAS_SHEET = "Listas";

/** Cabeceras exactas de la plantilla (fila 1). */
export const STOCK_ARTICULOS_IMPORT_HEADERS = [
  "referencia_minerva",
  "referencia_cliente",
  "cliente",
  "cantidad",
  "unidad",
  "proceso",
  "poses",
  "bultos",
  "uds_por_bulto",
  "pico",
  "palets",
  "tipo_embalaje",
  "ubicacion",
  "ot_origen",
  "notas",
] as const;

export type StockArticulosImportHeader =
  (typeof STOCK_ARTICULOS_IMPORT_HEADERS)[number];

export type StockArticulosImportSemaforo = "verde" | "amarillo" | "rojo";

export type StockArticulosImportResolvedRef = {
  id: string;
  codigo: string;
  cliente: string | null;
};

export type StockArticulosImportDraftRow = {
  rowIndex: number; // 1-based Excel (fila datos)
  referencia_minerva: string;
  referencia_cliente: string;
  cliente: string;
  cantidad: string;
  unidad: string;
  proceso: string;
  poses: string;
  bultos: string;
  uds_por_bulto: string;
  pico: string;
  palets: string;
  tipo_embalaje: string;
  ubicacion: string;
  ot_origen: string;
  notas: string;
  semaforo: StockArticulosImportSemaforo;
  mensajes: string[];
  resolved?: StockArticulosImportResolvedRef;
  /** Payload listo para alta_lote si no es rojo. */
  payload?: {
    p_referencia_id: string;
    p_cantidad: number;
    p_unidad: StockArticuloUnidad;
    p_estado_proceso: StockArticuloEstadoProceso;
    p_poses?: number;
    p_bultos?: number;
    p_unidades_por_bulto?: number;
    p_pico?: number;
    p_palets?: number;
    p_caja_embalaje?: string;
    p_ubicacion_fisica?: string;
    p_ot_origen?: string;
    p_notas?: string;
  };
};

const UNIDADES: StockArticuloUnidad[] = ["uds", "hojas"];
const PROCESOS: StockArticuloEstadoProceso[] = [
  "terminado",
  "impreso",
  "troquelado",
  "otro",
];

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function parseIntOpt(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Math.trunc(Number(String(raw).replace(",", ".")));
  return Number.isFinite(n) ? n : NaN;
}

function parseNumOpt(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Fingerprint estable del archivo (para anti-doble import en notas). */
export async function fingerprintStockImportFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 16);
}

export function importTagFromFingerprint(fp: string): string {
  return `[import:${fp}]`;
}

/**
 * Genera y descarga plantilla .xlsx con:
 * - hoja Stock (cabeceras + 2 ejemplos)
 * - hoja Listas (valores permitidos)
 * - validación desplegable unidad / proceso (si el runtime SheetJS lo emite)
 */
export function downloadStockArticulosPlantilla(): void {
  const headers = [...STOCK_ARTICULOS_IMPORT_HEADERS];
  const ejemplo1: Record<string, string | number> = {
    referencia_minerva: "M-01632",
    referencia_cliente: "",
    cliente: "",
    cantidad: 1000,
    unidad: "uds",
    proceso: "terminado",
    poses: "",
    bultos: 20,
    uds_por_bulto: 50,
    pico: 0,
    palets: 1,
    tipo_embalaje: "MN2L",
    ubicacion: "A3",
    ot_origen: "35519",
    notas: "Ejemplo PT — borrar o editar",
  };
  const ejemplo2: Record<string, string | number> = {
    referencia_minerva: "",
    referencia_cliente: "I02997",
    cliente: "TURRIS",
    cantidad: 500,
    unidad: "hojas",
    proceso: "impreso",
    poses: 2,
    bultos: "",
    uds_por_bulto: "",
    pico: "",
    palets: "",
    tipo_embalaje: "",
    ubicacion: "",
    ot_origen: "",
    notas: "Ejemplo WIP por ref. cliente+cliente",
  };

  const aoa: (string | number)[][] = [
    headers,
    headers.map((h) => ejemplo1[h] ?? ""),
    headers.map((h) => ejemplo2[h] ?? ""),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map((h) => {
    if (h === "notas" || h === "cliente") return { wch: 28 };
    if (h === "referencia_minerva" || h === "referencia_cliente") return { wch: 18 };
    return { wch: 12 };
  });

  // Desplegables (SheetJS community: best-effort; Listas sheet siempre disponible).
  const unidadCol = headers.indexOf("unidad"); // 0-based → Excel col
  const procesoCol = headers.indexOf("proceso");
  const colLetter = (i: number) => XLSX.utils.encode_col(i);
  const dv: Array<{
    type: string;
    allowBlank: boolean;
    sqref: string;
    formulas: string[];
  }> = [
    {
      type: "list",
      allowBlank: false,
      sqref: `${colLetter(unidadCol)}2:${colLetter(unidadCol)}500`,
      formulas: ['"uds,hojas"'],
    },
    {
      type: "list",
      allowBlank: false,
      sqref: `${colLetter(procesoCol)}2:${colLetter(procesoCol)}500`,
      formulas: ['"terminado,impreso,troquelado,otro"'],
    },
  ];
  (ws as XLSX.WorkSheet & { "!dataValidation"?: typeof dv })["!dataValidation"] =
    dv;

  const listas = XLSX.utils.aoa_to_sheet([
    ["unidad", "proceso"],
    ...Array.from({ length: Math.max(UNIDADES.length, PROCESOS.length) }).map(
      (_, i) => [UNIDADES[i] ?? "", PROCESOS[i] ?? ""]
    ),
    [],
    ["Instrucciones"],
    ["1. Usa referencia_minerva (M-xxxxx) O bien referencia_cliente + cliente."],
    ["2. unidad: solo uds u hojas. proceso: terminado|impreso|troquelado|otro."],
    ["3. Con hojas, poses es obligatorio (>0)."],
    ["4. No crees códigos nuevos: la referencia debe existir en el maestro."],
    ["5. Importa desde Minerva → Stock artículos → Importar Excel."],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, STOCK_ARTICULOS_IMPORT_SHEET);
  XLSX.utils.book_append_sheet(wb, listas, STOCK_ARTICULOS_LISTAS_SHEET);
  XLSX.writeFile(wb, "plantilla_stock_articulos.xlsx");
}

function rowFromJson(raw: Record<string, unknown>, rowIndex: number): StockArticulosImportDraftRow {
  const get = (k: StockArticulosImportHeader) => cellStr(raw[k]);
  return {
    rowIndex,
    referencia_minerva: get("referencia_minerva"),
    referencia_cliente: get("referencia_cliente"),
    cliente: get("cliente"),
    cantidad: get("cantidad"),
    unidad: get("unidad").toLowerCase(),
    proceso: get("proceso").toLowerCase(),
    poses: get("poses"),
    bultos: get("bultos"),
    uds_por_bulto: get("uds_por_bulto"),
    pico: get("pico"),
    palets: get("palets"),
    tipo_embalaje: get("tipo_embalaje"),
    ubicacion: get("ubicacion"),
    ot_origen: get("ot_origen"),
    notas: get("notas"),
    semaforo: "verde",
    mensajes: [],
  };
}

export function parseStockArticulosExcel(buffer: ArrayBuffer): {
  rows: StockArticulosImportDraftRow[];
  error?: string;
} {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === "stock") ??
    wb.SheetNames.find((n) => n !== STOCK_ARTICULOS_LISTAS_SHEET) ??
    wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], error: "El Excel no tiene hojas." };
  }
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  if (!json.length) {
    return { rows: [], error: "No hay filas de datos (solo cabecera o vacío)." };
  }

  const first = json[0] ?? {};
  const keys = Object.keys(first).map((k) => k.trim().toLowerCase());
  const missing = STOCK_ARTICULOS_IMPORT_HEADERS.filter(
    (h) => !keys.includes(h.toLowerCase())
  );
  // Tolerar plantillas parciales: exigir al menos cantidad + alguna ref
  if (!keys.includes("cantidad")) {
    return {
      rows: [],
      error: `Falta columna «cantidad». Descarga la plantilla actualizada. Faltan: ${missing.join(", ") || "—"}`,
    };
  }

  const normalized = json.map((raw) => {
    const map: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      map[k.trim().toLowerCase()] = v;
    }
    // remap to canonical keys
    const canon: Record<string, unknown> = {};
    for (const h of STOCK_ARTICULOS_IMPORT_HEADERS) {
      canon[h] = map[h.toLowerCase()] ?? "";
    }
    return canon;
  });

  const rows = normalized
    .map((r, i) => rowFromJson(r, i + 2)) // fila Excel = header+1+i
    .filter(
      (r) =>
        r.referencia_minerva ||
        r.referencia_cliente ||
        r.cliente ||
        r.cantidad ||
        r.notas
    );

  return { rows };
}

export type RefCatalogRow = {
  id: string;
  codigo: string;
  referencia_cliente: string | null;
  cliente: string | null;
};

/**
 * Resuelve referencias y valida filas → semáforo.
 * `existingImportTags`: tags `[import:…]` ya presentes en notas de lotes (anti-doble).
 * `fileTag`: tag de este archivo.
 */
export function validateStockArticulosImportRows(
  rows: StockArticulosImportDraftRow[],
  catalog: RefCatalogRow[],
  opts: {
    fileTag: string;
    existingImportTags: Set<string>;
    /** Claves "refId|cantidad|ot" de lotes existentes (aviso posible duplicado). */
    existingLoteKeys: Set<string>;
  }
): StockArticulosImportDraftRow[] {
  const byCodigo = new Map<string, RefCatalogRow>();
  for (const r of catalog) {
    byCodigo.set(normKey(r.codigo), r);
  }

  return rows.map((row) => {
    const mensajes: string[] = [];
    // Anotar el tipo: si no, TS estrecha a literal "verde" y marcaRojo en clausura no lo amplía.
    let semaforo = "verde" as StockArticulosImportSemaforo;
    let resolved: StockArticulosImportResolvedRef | undefined;

    const markRojo = (m: string) => {
      mensajes.push(m);
      semaforo = "rojo";
    };
    const markAmarillo = (m: string) => {
      mensajes.push(m);
      if (semaforo === "verde") semaforo = "amarillo";
    };

    // Resolver referencia
    const minerva = row.referencia_minerva.trim();
    if (minerva) {
      const hit = byCodigo.get(normKey(minerva));
      if (!hit) {
        markRojo(`Referencia Minerva «${minerva}» no existe en el maestro.`);
      } else {
        resolved = {
          id: hit.id,
          codigo: hit.codigo,
          cliente: hit.cliente,
        };
      }
    } else if (row.referencia_cliente.trim()) {
      const rc = normKey(row.referencia_cliente);
      const cli = normKey(row.cliente);
      const hits = catalog.filter((c) => {
        const crc = normKey(c.referencia_cliente ?? "");
        if (crc !== rc) return false;
        if (!cli) return true;
        return normKey(c.cliente ?? "") === cli;
      });
      if (hits.length === 0) {
        markRojo(
          `No hay artículo con ref. cliente «${row.referencia_cliente}»` +
            (cli ? ` y cliente «${row.cliente}»` : " (indica también cliente si hay varias).")
        );
      } else if (hits.length > 1 && !cli) {
        markRojo(
          `Ref. cliente «${row.referencia_cliente}» corresponde a ${hits.length} artículos. Indica cliente.`
        );
      } else if (hits.length > 1) {
        markRojo(
          `Ref. cliente + cliente ambiguos (${hits.length} coincidencias).`
        );
      } else {
        const hit = hits[0]!;
        resolved = {
          id: hit.id,
          codigo: hit.codigo,
          cliente: hit.cliente,
        };
      }
    } else {
      markRojo("Indica referencia_minerva o referencia_cliente (+ cliente).");
    }

    const cantidad = parseIntOpt(row.cantidad);
    if (cantidad == null || !Number.isFinite(cantidad) || cantidad <= 0) {
      markRojo("cantidad debe ser un entero > 0.");
    }

    let unidad: StockArticuloUnidad | null = null;
    if (!UNIDADES.includes(row.unidad as StockArticuloUnidad)) {
      markRojo(`unidad inválida «${row.unidad || "∅"}» (uds|hojas).`);
    } else {
      unidad = row.unidad as StockArticuloUnidad;
    }

    let proceso: StockArticuloEstadoProceso | null = null;
    if (!PROCESOS.includes(row.proceso as StockArticuloEstadoProceso)) {
      markRojo(
        `proceso inválido «${row.proceso || "∅"}» (terminado|impreso|troquelado|otro).`
      );
    } else {
      proceso = row.proceso as StockArticuloEstadoProceso;
    }

    const poses = parseIntOpt(row.poses);
    if (unidad === "hojas") {
      if (poses == null || !Number.isFinite(poses) || poses <= 0) {
        markRojo("Con unidad hojas, poses es obligatorio (>0).");
      }
    } else if (poses != null && (!Number.isFinite(poses) || poses <= 0)) {
      markRojo("poses debe ser > 0 si se indica.");
    }

    const bultos = parseIntOpt(row.bultos);
    const udsBulto = parseIntOpt(row.uds_por_bulto);
    const pico = parseIntOpt(row.pico);
    const palets = parseNumOpt(row.palets);

    for (const [label, n] of [
      ["bultos", bultos],
      ["uds_por_bulto", udsBulto],
      ["pico", pico],
      ["palets", palets],
    ] as const) {
      if (n != null && Number.isNaN(n)) markRojo(`${label} no es un número válido.`);
      if (n != null && Number.isFinite(n) && n < 0) markRojo(`${label} no puede ser negativo.`);
      if (label === "uds_por_bulto" && n != null && Number.isFinite(n) && n <= 0) {
        markRojo("uds_por_bulto debe ser > 0.");
      }
    }

    if (
      unidad === "uds" &&
      cantidad != null &&
      Number.isFinite(cantidad) &&
      bultos != null &&
      Number.isFinite(bultos) &&
      udsBulto != null &&
      Number.isFinite(udsBulto)
    ) {
      const picoVal = pico != null && Number.isFinite(pico) ? pico : 0;
      const emb = bultos * udsBulto + picoVal;
      if (emb !== cantidad) {
        markAmarillo(
          `Embalaje ${emb.toLocaleString("es-ES")} ≠ cantidad ${cantidad.toLocaleString("es-ES")} uds.`
        );
      }
    }

    if (opts.existingImportTags.has(opts.fileTag)) {
      markAmarillo(
        "Este archivo (o uno idéntico) ya se importó antes. Revisa para no duplicar."
      );
    }

    if (resolved && cantidad != null && Number.isFinite(cantidad)) {
      const ot = row.ot_origen.trim() || "";
      const key = `${resolved.id}|${cantidad}|${ot}`;
      if (opts.existingLoteKeys.has(key)) {
        markAmarillo(
          "Ya hay un lote con misma referencia, cantidad y OT origen (posible duplicado)."
        );
      }
    }

    let payload: StockArticulosImportDraftRow["payload"];
    if (semaforo !== "rojo" && resolved && cantidad && unidad && proceso) {
      const noteParts = [
        row.notas.trim() || null,
        opts.fileTag,
      ].filter(Boolean);
      payload = {
        p_referencia_id: resolved.id,
        p_cantidad: cantidad,
        p_unidad: unidad,
        p_estado_proceso: proceso,
        p_poses:
          poses != null && Number.isFinite(poses) ? poses : undefined,
        p_bultos:
          bultos != null && Number.isFinite(bultos) ? bultos : undefined,
        p_unidades_por_bulto:
          udsBulto != null && Number.isFinite(udsBulto) ? udsBulto : undefined,
        p_pico: pico != null && Number.isFinite(pico) ? pico : undefined,
        p_palets:
          palets != null && Number.isFinite(palets) ? palets : undefined,
        p_caja_embalaje: row.tipo_embalaje.trim() || undefined,
        p_ubicacion_fisica: row.ubicacion.trim() || undefined,
        p_ot_origen: row.ot_origen.trim() || undefined,
        p_notas: noteParts.join(" ") || undefined,
      };
    }

    return {
      ...row,
      semaforo,
      mensajes,
      resolved,
      payload,
    };
  });
}
