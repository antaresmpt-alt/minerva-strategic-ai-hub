import * as XLSX from "xlsx";

import { ingestSalesRecords, type IngestSalesResult, SalesParseError } from "@/lib/sales-ingest";

/**
 * Primera hoja del libro · cabeceras corporativas o export ERP (p. ej. Nº Pedido).
 * `raw: false` prioriza el texto mostrado en Excel (fechas y números como en pantalla).
 */
export function parseVentasExcel(buffer: ArrayBuffer): IngestSalesResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) {
    throw new SalesParseError(
      "El libro Excel no contiene ninguna hoja.",
      [],
      "Añade una hoja con la tabla de pedidos o exporta de nuevo desde el origen."
    );
  }
  const sheet = wb.Sheets[name];
  if (!sheet) {
    throw new SalesParseError(
      "No se pudo leer la primera hoja del Excel.",
      [],
      undefined
    );
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return ingestSalesRecords(json);
}
