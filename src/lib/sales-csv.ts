import Papa from "papaparse";

import { ingestSalesRecords, type IngestSalesResult } from "@/lib/sales-ingest";

export function parseVentasCsv(csvText: string): IngestSalesResult {
  const { data, errors } = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0) {
    console.warn("CSV parse warnings:", errors);
  }

  return ingestSalesRecords(data);
}

export async function loadVentasCsv(
  url = "/data/ventasDataSet_mejorado.csv"
): Promise<IngestSalesResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar el CSV (${res.status})`);
  const text = await res.text();
  return parseVentasCsv(text);
}
