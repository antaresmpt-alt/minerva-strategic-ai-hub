import * as XLSX from "xlsx";
import type {
  ProdEtiquetasTroquelRow,
  ProdEtiquetasTroquelInsert,
  TroquelExcelRow,
  TroquelDocumento,
} from "@/types/prod-etiquetas-troqueles";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normaliza un código de troquel a 4 dígitos con padding de ceros.
 */
export function normalizarCodigoTroquel(raw: string | number): string {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return "";
  return String(n).padStart(4, "0");
}

/**
 * Convierte "Sí"/"No" a boolean.
 */
function parseSiNo(value: unknown): boolean {
  const str = String(value ?? "").trim().toUpperCase();
  return str === "SÍ" || str === "SI" || str === "YES" || str === "TRUE";
}

/**
 * Parsea un decimal que puede venir con coma o punto.
 */
function parseDecimal(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDateYmd(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const [, dd, mm, yyyyRaw] = match;
  const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Parsea los documentos desde el JSON string en la columna documentos_detalle.
 */
function parseDocumentos(jsonString: string | null | undefined): TroquelDocumento[] | null {
  if (!jsonString || jsonString.trim() === "") return null;
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Parsea un archivo Excel y devuelve las filas tipadas como ProdEtiquetasTroquelInsert.
 * Lee la primera hoja ("Troqueles").
 */
export async function parseExcelFile(file: File): Promise<ProdEtiquetasTroquelInsert[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          reject(new Error("No se pudo leer el archivo"));
          return;
        }
        
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error("El archivo Excel no contiene ninguna hoja"));
          return;
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: TroquelExcelRow[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: null,
        });
        
        const parsed: ProdEtiquetasTroquelInsert[] = rows.map((row) => ({
          codigo: normalizarCodigoTroquel(row.codigo || ""),
          carpeta_original: String(row.carpeta_original || "").trim(),
          carpeta_path: row.carpeta_path ? String(row.carpeta_path).trim() : null,
          forma: row.forma ? String(row.forma).trim() : null,
          ancho_mm: parseDecimal(row.ancho_mm),
          alto_mm: parseDecimal(row.alto_mm),
          diametro_mm: parseDecimal(row.diametro_mm),
          dimensiones_texto: row.dimensiones_texto ? String(row.dimensiones_texto).trim() : null,
          especial: parseSiNo(row.especial),
          multiple: parseSiNo(row.multiple),
          con_hendido: parseSiNo(row.con_hendido),
          estado: row.estado ? String(row.estado).trim() : "activo",
          necesita_revision: parseSiNo(row.necesita_revision),
          notas: row.notas ? String(row.notas).trim() : null,
          fecha_ult_reparacion: parseDateYmd(row.fecha_ult_reparacion),
          documentos: parseDocumentos(row.documentos_detalle),
        }));
        
        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Error parseando el Excel"));
      }
    };
    
    reader.onerror = () => reject(new Error("Error leyendo el archivo"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Resultado del diff entre las filas del Excel y las de la base de datos.
 */
export type TroquelesDiffResult = {
  /** Troqueles nuevos (código no existe en BD) */
  nuevos: ProdEtiquetasTroquelInsert[];
  
  /** Troqueles modificados (código existe pero difiere algún campo) */
  modificados: Array<{
    excel: ProdEtiquetasTroquelInsert;
    bd: ProdEtiquetasTroquelRow;
  }>;
  
  /** Troqueles sin cambios (código existe y campos son iguales) */
  sinCambios: Array<{
    excel: ProdEtiquetasTroquelInsert;
    bd: ProdEtiquetasTroquelRow;
  }>;
  
  /** Troqueles que existen solo en BD (no en Excel) */
  soloEnBd: ProdEtiquetasTroquelRow[];
};

/**
 * Compara dos troqueles campo por campo.
 * Devuelve true si son iguales (en los campos relevantes).
 */
function sonIguales(
  excel: ProdEtiquetasTroquelInsert,
  bd: ProdEtiquetasTroquelRow
): boolean {
  return (
    excel.carpeta_original === bd.carpeta_original &&
    (excel.carpeta_path ?? null) === (bd.carpeta_path ?? null) &&
    (excel.forma ?? null) === (bd.forma ?? null) &&
    (excel.ancho_mm ?? null) === (bd.ancho_mm ?? null) &&
    (excel.alto_mm ?? null) === (bd.alto_mm ?? null) &&
    (excel.diametro_mm ?? null) === (bd.diametro_mm ?? null) &&
    (excel.dimensiones_texto ?? null) === (bd.dimensiones_texto ?? null) &&
    excel.especial === bd.especial &&
    excel.multiple === bd.multiple &&
    excel.con_hendido === bd.con_hendido &&
    excel.estado === bd.estado &&
    excel.necesita_revision === bd.necesita_revision &&
    (excel.notas ?? null) === (bd.notas ?? null) &&
    (excel.fecha_ult_reparacion ?? null) ===
      (bd.fecha_ult_reparacion ?? null) &&
    JSON.stringify(excel.documentos ?? null) === JSON.stringify(bd.documentos ?? null)
  );
}

/**
 * Computa el diff entre las filas del Excel y las filas de la base de datos.
 */
export function computeDiff(
  rowsExcel: ProdEtiquetasTroquelInsert[],
  rowsDb: ProdEtiquetasTroquelRow[]
): TroquelesDiffResult {
  const bdMap = new Map<string, ProdEtiquetasTroquelRow>();
  for (const row of rowsDb) {
    bdMap.set(row.codigo, row);
  }
  
  const excelCodigos = new Set<string>();
  const nuevos: ProdEtiquetasTroquelInsert[] = [];
  const modificados: Array<{
    excel: ProdEtiquetasTroquelInsert;
    bd: ProdEtiquetasTroquelRow;
  }> = [];
  const sinCambios: Array<{
    excel: ProdEtiquetasTroquelInsert;
    bd: ProdEtiquetasTroquelRow;
  }> = [];
  
  for (const excelRow of rowsExcel) {
    excelCodigos.add(excelRow.codigo);
    const bdRow = bdMap.get(excelRow.codigo);
    
    if (!bdRow) {
      nuevos.push(excelRow);
    } else if (!sonIguales(excelRow, bdRow)) {
      modificados.push({ excel: excelRow, bd: bdRow });
    } else {
      sinCambios.push({ excel: excelRow, bd: bdRow });
    }
  }
  
  const soloEnBd = rowsDb.filter((row) => !excelCodigos.has(row.codigo));
  
  return { nuevos, modificados, sinCambios, soloEnBd };
}

/**
 * Opciones para aplicar el diff.
 */
export type AplicarDiffOpciones = {
  /** Si true, actualiza los troqueles modificados. Si false, solo inserta nuevos. */
  incluirModificados: boolean;
};

/**
 * Aplica el diff a la base de datos.
 * - Inserta los nuevos troqueles.
 * - Opcionalmente actualiza los modificados (si incluirModificados es true).
 * - Nunca elimina filas.
 * 
 * Devuelve el número de filas insertadas y actualizadas.
 */
export async function aplicarDiff(
  supabase: SupabaseClient,
  diff: TroquelesDiffResult,
  opciones: AplicarDiffOpciones
): Promise<{ insertados: number; actualizados: number }> {
  let insertados = 0;
  let actualizados = 0;
  
  if (diff.nuevos.length > 0) {
    const { error: insertError } = await supabase
      .from("prod_etiquetas_troqueles")
      .insert(diff.nuevos);
    
    if (insertError) {
      throw new Error(`Error insertando nuevos troqueles: ${insertError.message}`);
    }
    
    insertados = diff.nuevos.length;
  }
  
  if (opciones.incluirModificados && diff.modificados.length > 0) {
    for (const { excel, bd } of diff.modificados) {
      const { error: updateError } = await supabase
        .from("prod_etiquetas_troqueles")
        .update({
          carpeta_original: excel.carpeta_original,
          carpeta_path: excel.carpeta_path,
          forma: excel.forma,
          ancho_mm: excel.ancho_mm,
          alto_mm: excel.alto_mm,
          diametro_mm: excel.diametro_mm,
          dimensiones_texto: excel.dimensiones_texto,
          especial: excel.especial,
          multiple: excel.multiple,
          con_hendido: excel.con_hendido,
          estado: excel.estado,
          necesita_revision: excel.necesita_revision,
          notas: excel.notas,
          fecha_ult_reparacion: excel.fecha_ult_reparacion,
          documentos: excel.documentos,
        })
        .eq("id", bd.id);
      
      if (updateError) {
        throw new Error(`Error actualizando troquel ${bd.codigo}: ${updateError.message}`);
      }
      
      actualizados++;
    }
  }
  
  return { insertados, actualizados };
}

/**
 * Exporta las filas de troqueles a un archivo Excel con la misma estructura
 * que el script de parsing.
 */
export function exportarTroquelesAExcel(rows: ProdEtiquetasTroquelRow[]): void {
  const exportRows = rows.map((row) => ({
    codigo: row.codigo,
    carpeta_original: row.carpeta_original,
    estado: row.estado || "",
    forma: row.forma || "",
    ancho_mm: row.ancho_mm ?? "",
    alto_mm: row.alto_mm ?? "",
    diametro_mm: row.diametro_mm ?? "",
    dimensiones_texto: row.dimensiones_texto || "",
    especial: row.especial ? "Sí" : "No",
    multiple: row.multiple ? "Sí" : "No",
    con_hendido: row.con_hendido ? "Sí" : "No",
    necesita_revision: row.necesita_revision ? "Sí" : "No",
    notas: row.notas || "",
    fecha_ult_reparacion: row.fecha_ult_reparacion || "",
    carpeta_path: row.carpeta_path || "",
    documentos: row.documentos
      ? [...new Set(row.documentos.map((d) => d.tipo))].join(" | ")
      : "",
    documentos_detalle: row.documentos ? JSON.stringify(row.documentos) : "",
    nombre_normalizado: `${row.codigo}${
      row.dimensiones_texto ? ` · ${row.dimensiones_texto}` : ""
    }${row.forma ? ` · ${row.forma}` : ""}`,
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 55 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 32 },
    { wch: 18 },
    { wch: 90 },
    { wch: 24 },
    { wch: 120 },
    { wch: 36 },
  ];
  
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Troqueles");
  
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `troqueles-etiquetas-${timestamp}.xlsx`, {
    compression: true,
  });
}
