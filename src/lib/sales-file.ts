import { parseVentasCsv } from "@/lib/sales-csv";
import { parseVentasExcel } from "@/lib/sales-excel";
import type { IngestSalesResult } from "@/lib/sales-ingest";

const CSV_TYPES = new Set(["text/csv", "application/csv", "text/plain"]);
const EXCEL_EXT = new Set(["xlsx", "xls"]);
const CSV_EXT = new Set(["csv"]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export type ParsedSalesFile = IngestSalesResult;

export async function parseSalesFile(file: File): Promise<ParsedSalesFile> {
  const ext = extOf(file.name);

  if (CSV_EXT.has(ext) || CSV_TYPES.has(file.type)) {
    const text = await file.text();
    return parseVentasCsv(text);
  }

  if (EXCEL_EXT.has(ext)) {
    const buf = await file.arrayBuffer();
    return parseVentasExcel(buf);
  }

  if (
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.type === "application/vnd.ms-excel"
  ) {
    const buf = await file.arrayBuffer();
    return parseVentasExcel(buf);
  }

  throw new Error(
    "Formato no reconocido. Usa CSV o Excel (.xlsx / .xls) con las columnas corporativas."
  );
}
