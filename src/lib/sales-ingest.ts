import type { SalesOrderRow } from "@/types/sales";
import { normalizeSalesRecord, parseSalesRowRecord } from "@/lib/sales-parse-rows";

export class SalesParseError extends Error {
  readonly detectedHeaders: string[];
  readonly hint?: string;

  constructor(message: string, detectedHeaders: string[], hint?: string) {
    super(message);
    this.name = "SalesParseError";
    this.detectedHeaders = detectedHeaders;
    this.hint = hint;
  }
}

function isBlankRow(raw: Record<string, unknown>): boolean {
  const r = normalizeSalesRecord(raw);
  const vals = Object.values(r);
  if (vals.length === 0) return true;
  return vals.every((v) => v === "" || v == null);
}

function firstDataRow(records: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const rec of records) {
    if (!isBlankRow(rec)) return rec;
  }
  return null;
}

function buildColumnWarnings(keys: string[]): string[] {
  const set = new Set(keys);
  const warnings: string[] = [];

  const has = (...names: string[]) => names.some((n) => set.has(n));

  if (!has("Valor_Real", "Valor Real")) {
    if (has("Valor_Potencial", "Valor Potencial")) {
      warnings.push(
        "No hay columna Valor_Real: se usa Valor potencial como aproximación en KPIs y gráficos que dependen del valor real."
      );
    }
  }

  if (!has("Comercial")) {
    warnings.push(
      'No hay columna Comercial: se asigna "Sin asignar" a todos los pedidos; la vista por comercial no filtrará por persona.'
    );
  }

  if (!has("Tipo_Cliente", "Tipo Cliente")) {
    warnings.push(
      'Falta Tipo_Cliente: el reparto por sector usará "Sin clasificar".'
    );
  }

  if (!has("Coste_Estimado", "Coste Estimado")) {
    warnings.push(
      "Falta Coste_Estimado: costes y alertas Oficina Técnica quedan en 0."
    );
  }

  if (!has("Margen_Euros", "Margen Euros")) {
    warnings.push("Falta Margen_Euros: el margen en € se muestra como 0.");
  }
  if (!has("Margen_Porcentaje", "Margen Porcentaje")) {
    warnings.push("Falta Margen_Porcentaje: el % de margen se muestra como 0.");
  }

  return warnings;
}

export type IngestSalesResult = {
  rows: SalesOrderRow[];
  warnings: string[];
};

const CORPORATE_HINT =
  "Formato corporativo de referencia: ID_Pedido (o Nº Pedido), Estado, Cliente, Pedido Cliente, Valor_Potencial, Valor_Real, Comercial, Tipo_Cliente, Coste_Estimado, Margen_Euros, Margen_Porcentaje, fechas FSC/Prueba/PDF/Muestra, etc.";

/**
 * Parsea filas crudas (CSV o Excel) y devuelve filas tipadas + avisos por columnas ausentes.
 * Lanza SalesParseError si no hay ninguna fila válida pero el archivo sí tenía datos.
 */
export function ingestSalesRecords(records: Record<string, unknown>[]): IngestSalesResult {
  const nonBlank = records.filter((r) => !isBlankRow(r));

  if (nonBlank.length === 0) {
    throw new SalesParseError(
      "El archivo no contiene filas de datos (o todas las celdas están vacías).",
      [],
      CORPORATE_HINT
    );
  }

  const sample = firstDataRow(nonBlank);
  const normalizedKeys = sample ? Object.keys(normalizeSalesRecord(sample)) : [];

  const rows: SalesOrderRow[] = [];
  for (const rec of nonBlank) {
    const row = parseSalesRowRecord(rec);
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    throw new SalesParseError(
      `No se importó ningún pedido válido (${nonBlank.length} filas con datos). ` +
        "Cada fila necesita un identificador de pedido numérico reconocible (por ejemplo ID_Pedido o Nº Pedido).",
      normalizedKeys,
      CORPORATE_HINT
    );
  }

  const warnings = buildColumnWarnings(normalizedKeys);

  return { rows, warnings };
}

/** Solo filas, sin avisos (p. ej. tests); lanza SalesParseError si no hay datos válidos. */
export function parseSalesRowsFromRecords(records: Record<string, unknown>[]): SalesOrderRow[] {
  return ingestSalesRecords(records).rows;
}
