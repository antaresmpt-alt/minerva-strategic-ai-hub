import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProdReferenciaRow, ArticuloExcelRow } from "@/types/prod-referencias";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseBool(value: unknown): boolean {
  const s = String(value ?? "").trim().toUpperCase();
  return !(s === "NO" || s === "FALSE" || s === "0" || s === "");
}

function parseOptionalNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(value: unknown): number | null {
  const n = parseOptionalNum(value);
  return n != null ? Math.round(n) : null;
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function foldKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizeArticuloCliente(value: string | null | undefined): string | null {
  const cleaned = cleanStr(value);
  if (cleaned == null) return null;
  const key = foldKey(cleaned).replace(/[.,]/g, "");
  if (key.includes("LABORATORIOS ANUR")) return "LABORATORIOS ANUR S.L.";
  return cleaned;
}

/** Genera el siguiente código M-NNNNN libre dado el máximo actual. */
export function nextCodigoMinerva(existing: string[]): string {
  let max = 0;
  for (const c of existing) {
    const m = c.match(/^M-(\d{5})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `M-${String(max + 1).padStart(5, "0")}`;
}

// ─── Parse Excel ──────────────────────────────────────────────────────────────

export type ArticuloImportRow = Omit<
  ProdReferenciaRow,
  "id" | "created_at" | "updated_at" | "ultima_ot_numero" | "ultima_ot_fecha" | "total_repeticiones"
> & {
  __presentFields?: Partial<Record<keyof ArticuloImportDbRow, boolean>>;
};

type ArticuloImportDbRow = Omit<ArticuloImportRow, "__presentFields">;

const IMPORT_DB_FIELDS = [
  "codigo",
  "referencia_cliente",
  "descripcion",
  "cliente",
  "tipo_producto",
  "subtipo",
  "activo",
  "formato_largo_mm",
  "formato_ancho_mm",
  "formato_fondo_mm",
  "material_habitual",
  "poses_habitual",
  "troquel_habitual",
  "tintas_habituales",
  "acabado_habitual",
  "ruta_habitual",
  "notas",
] as const satisfies readonly (keyof ArticuloImportDbRow)[];

function fieldPresent(value: unknown): boolean {
  return cleanStr(value) != null;
}

function setPresentFields(
  row: ArticuloImportRow,
  presentFields: ArticuloImportRow["__presentFields"]
): ArticuloImportRow {
  Object.defineProperty(row, "__presentFields", {
    value: presentFields,
    enumerable: false,
    configurable: true,
  });
  return row;
}

function importRowToDbRow(row: ArticuloImportRow): ArticuloImportDbRow {
  return Object.fromEntries(
    IMPORT_DB_FIELDS.map((field) => [field, row[field]])
  ) as ArticuloImportDbRow;
}

function normalizeImportKey(value: string | null | undefined): string {
  return foldKey(value);
}

function compositeKeyFromValues(
  cliente: string | null | undefined,
  referenciaCliente: string | null | undefined
): string | null {
  const c = normalizeImportKey(cliente);
  const r = normalizeImportKey(referenciaCliente);
  return c && r ? `${c}::${r}` : null;
}

function incomingIdentityKey(row: ArticuloImportRow): string {
  return compositeKeyFromValues(row.cliente, row.referencia_cliente) ?? `codigo:${normalizeImportKey(row.codigo)}`;
}

function hasIncomingField(row: ArticuloImportRow, field: keyof ArticuloImportDbRow): boolean {
  return row.__presentFields?.[field] ?? true;
}

function buildArticuloUpdatePatch(
  incoming: ArticuloImportRow
): Partial<ArticuloImportDbRow> {
  const patch: Partial<ArticuloImportDbRow> = {};
  for (const field of IMPORT_DB_FIELDS) {
    if (field === "codigo") continue;
    if (!hasIncomingField(incoming, field)) continue;
    const value = incoming[field];
    if (value == null) continue;
    patch[field] = value as never;
  }
  return patch;
}

function articuloPatchHasChanges(
  patch: Partial<ArticuloImportDbRow>,
  existing: ProdReferenciaRow
): boolean {
  return Object.entries(patch).some(([field, value]) => {
    const key = field as keyof ProdReferenciaRow;
    return value !== (existing[key] ?? null);
  });
}

function importRowLabel(row: ArticuloImportRow): string {
  return [
    row.codigo,
    row.cliente,
    row.referencia_cliente,
    row.descripcion,
  ]
    .filter((v) => String(v ?? "").trim())
    .join(" · ");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error != null) {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [e.message, e.details, e.hint, e.code ? `code=${e.code}` : null]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  return String(error || "Error desconocido");
}

function isDuplicateKeyError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes("23505") ||
    msg.includes("duplicate key") ||
    msg.includes("prod_referencias_cliente_ref_cliente_uq") ||
    msg.includes("prod_referencias_codigo")
  );
}

/** Supabase devuelve como máximo 1000 filas por petición: hay que paginar. */
async function loadExistingArticuloKeys(
  supabase: SupabaseClient
): Promise<{ codes: Set<string>; composite: Set<string> }> {
  const existingCodes = new Set<string>();
  const existingComposite = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("prod_referencias")
      .select("codigo,cliente,referencia_cliente")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const batch = data ?? [];
    for (const row of batch) {
      const codigo = normalizeImportKey(row.codigo);
      if (codigo) existingCodes.add(codigo);
      const key = compositeKeyFromValues(
        normalizeArticuloCliente(row.cliente),
        row.referencia_cliente
      );
      if (key) existingComposite.add(key);
    }

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { codes: existingCodes, composite: existingComposite };
}

async function insertArticulosWithFallback(
  supabase: SupabaseClient,
  rows: ArticuloImportRow[]
): Promise<{ insertados: number; omitidos: string[]; duplicados: number }> {
  const omitidos: string[] = [];
  let insertados = 0;
  let duplicados = 0;
  const dbRows = rows.map(importRowToDbRow);
  const chunkSize = 50;

  for (let start = 0; start < dbRows.length; start += chunkSize) {
    const chunk = dbRows.slice(start, start + chunkSize);
    const { error } = await supabase.from("prod_referencias").insert(chunk);
    if (!error) {
      insertados += chunk.length;
      continue;
    }

    for (let i = 0; i < chunk.length; i += 1) {
      const row = rows[start + i];
      const { error: rowError } = await supabase
        .from("prod_referencias")
        .insert(chunk[i]);
      if (rowError) {
        if (isDuplicateKeyError(rowError)) {
          duplicados += 1;
        } else {
          omitidos.push(`${importRowLabel(row)} → ${errorMessage(rowError)}`);
        }
      } else {
        insertados += 1;
      }
    }
  }

  return { insertados, omitidos, duplicados };
}

async function filterExistingArticulosBeforeInsert(
  supabase: SupabaseClient,
  rows: ArticuloImportRow[]
): Promise<{ nuevos: ArticuloImportRow[]; duplicados: number }> {
  if (rows.length === 0) return { nuevos: [], duplicados: 0 };

  const { codes, composite: existingComposite } = await loadExistingArticuloKeys(supabase);

  const nuevos: ArticuloImportRow[] = [];
  let duplicados = 0;
  for (const row of rows) {
    const codigo = normalizeImportKey(row.codigo);
    const rowKey = compositeKeyFromValues(row.cliente, row.referencia_cliente);
    if (
      (codigo && codes.has(codigo)) ||
      (rowKey != null && existingComposite.has(rowKey))
    ) {
      duplicados += 1;
      continue;
    }
    nuevos.push(row);
  }

  return { nuevos, duplicados };
}

export async function parseArticulosExcelFile(
  file: File,
  existingCodigos: string[]
): Promise<ArticuloImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { reject(new Error("No se pudo leer el archivo")); return; }

        const wb = XLSX.read(data, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) { reject(new Error("El Excel no contiene ninguna hoja")); return; }

        const ws = wb.Sheets[sheetName];
        const rawRows: ArticuloExcelRow[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null });

        const localCodigos = [...existingCodigos];
        const parsed: ArticuloImportRow[] = rawRows.map((row) => {
          let codigo = cleanStr(row.codigo);
          if (!codigo) {
            codigo = nextCodigoMinerva(localCodigos);
            localCodigos.push(codigo);
          }

          const parsedRow: ArticuloImportRow = {
            codigo,
            referencia_cliente: cleanStr(row.referencia_cliente),
            descripcion: cleanStr(row.descripcion),
            cliente: normalizeArticuloCliente(row.cliente),
            tipo_producto: cleanStr(row.tipo_producto),
            subtipo: cleanStr(row.subtipo),
            activo: row.activo != null ? parseBool(row.activo) : true,
            formato_largo_mm: parseOptionalNum(row.formato_largo_mm),
            formato_ancho_mm: parseOptionalNum(row.formato_ancho_mm),
            formato_fondo_mm: parseOptionalNum(row.formato_fondo_mm),
            material_habitual: cleanStr(row.material_habitual),
            poses_habitual: parseOptionalInt(row.poses_habitual),
            troquel_habitual: cleanStr(row.troquel_habitual),
            tintas_habituales: cleanStr(row.tintas_habituales),
            acabado_habitual: cleanStr(row.acabado_habitual),
            ruta_habitual: cleanStr(row.ruta_habitual),
            notas: cleanStr(row.notas),
          };
          return setPresentFields(parsedRow, {
            codigo: fieldPresent(row.codigo),
            referencia_cliente: fieldPresent(row.referencia_cliente),
            descripcion: fieldPresent(row.descripcion),
            cliente: fieldPresent(row.cliente),
            tipo_producto: fieldPresent(row.tipo_producto),
            subtipo: fieldPresent(row.subtipo),
            activo: fieldPresent(row.activo),
            formato_largo_mm: fieldPresent(row.formato_largo_mm),
            formato_ancho_mm: fieldPresent(row.formato_ancho_mm),
            formato_fondo_mm: fieldPresent(row.formato_fondo_mm),
            material_habitual: fieldPresent(row.material_habitual),
            poses_habitual: fieldPresent(row.poses_habitual),
            troquel_habitual: fieldPresent(row.troquel_habitual),
            tintas_habituales: fieldPresent(row.tintas_habituales),
            acabado_habitual: fieldPresent(row.acabado_habitual),
            ruta_habitual: fieldPresent(row.ruta_habitual),
            notas: fieldPresent(row.notas),
          });
        });

        resolve(parsed);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error procesando Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo el archivo"));
    reader.readAsBinaryString(file);
  });
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export type ArticuloDiffResult = {
  nuevos: ArticuloImportRow[];
  modificados: Array<{ incoming: ArticuloImportRow; existing: ProdReferenciaRow }>;
  sinCambios: ArticuloImportRow[];
};

export function computeArticulosDiff(
  incoming: ArticuloImportRow[],
  existing: ProdReferenciaRow[]
): ArticuloDiffResult {
  const byCode = new Map(existing.map((r) => [r.codigo.trim().toUpperCase(), r]));
  const byClienteReferencia = new Map<string, ProdReferenciaRow>();
  for (const row of existing) {
    const key = compositeKeyFromValues(row.cliente, row.referencia_cliente);
    if (key && !byClienteReferencia.has(key)) {
      byClienteReferencia.set(key, row);
    }
  }
  const uniqueIncoming = new Map<string, ArticuloImportRow>();
  for (const row of incoming) {
    uniqueIncoming.set(incomingIdentityKey(row), row);
  }

  const nuevos: ArticuloImportRow[] = [];
  const modificados: ArticuloDiffResult["modificados"] = [];
  const sinCambios: ArticuloImportRow[] = [];

  for (const row of uniqueIncoming.values()) {
    const key = row.codigo.trim().toUpperCase();
    const ex =
      byCode.get(key) ??
      byClienteReferencia.get(
        compositeKeyFromValues(row.cliente, row.referencia_cliente) ?? ""
      );
    if (!ex) {
      nuevos.push(row);
      continue;
    }

    const changed = articuloPatchHasChanges(buildArticuloUpdatePatch(row), ex);

    if (changed) {
      modificados.push({ incoming: row, existing: ex });
    } else {
      sinCambios.push(row);
    }
  }

  return { nuevos, modificados, sinCambios };
}

// ─── Apply diff ───────────────────────────────────────────────────────────────

export async function aplicarArticulosDiff(
  supabase: SupabaseClient,
  diff: ArticuloDiffResult,
  opts: { incluirModificados: boolean }
): Promise<{
  insertados: number;
  actualizados: number;
  omitidos: string[];
  duplicados: number;
}> {
  let insertados = 0;
  let actualizados = 0;
  const omitidos: string[] = [];
  let duplicados = 0;

  if (diff.nuevos.length > 0) {
    const filtered = await filterExistingArticulosBeforeInsert(supabase, diff.nuevos);
    duplicados += filtered.duplicados;
    const result = await insertArticulosWithFallback(supabase, filtered.nuevos);
    insertados = result.insertados;
    duplicados += result.duplicados;
    omitidos.push(...result.omitidos);
  }

  if (opts.incluirModificados && diff.modificados.length > 0) {
    for (const { incoming, existing } of diff.modificados) {
      const patch = buildArticuloUpdatePatch(incoming);
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase
        .from("prod_referencias")
        .update(patch)
        .eq("id", existing.id);
      if (error) {
        omitidos.push(`${importRowLabel(incoming)} → ${errorMessage(error)}`);
      } else {
        actualizados++;
      }
    }
  }

  return { insertados, actualizados, omitidos, duplicados };
}

// ─── Export ───────────────────────────────────────────────────────────────────

const EXPORT_COLS = [
  { key: "codigo",             label: "codigo" },
  { key: "referencia_cliente", label: "referencia_cliente" },
  { key: "descripcion",        label: "descripcion" },
  { key: "cliente",            label: "cliente" },
  { key: "tipo_producto",      label: "tipo_producto" },
  { key: "subtipo",            label: "subtipo" },
  { key: "activo",             label: "activo" },
  { key: "formato_largo_mm",   label: "formato_largo_mm" },
  { key: "formato_ancho_mm",   label: "formato_ancho_mm" },
  { key: "formato_fondo_mm",   label: "formato_fondo_mm" },
  { key: "material_habitual",  label: "material_habitual" },
  { key: "poses_habitual",     label: "poses_habitual" },
  { key: "troquel_habitual",   label: "troquel_habitual" },
  { key: "tintas_habituales",  label: "tintas_habituales" },
  { key: "acabado_habitual",   label: "acabado_habitual" },
  { key: "ruta_habitual",      label: "ruta_habitual" },
  { key: "notas",              label: "notas" },
] as const;

export function exportarArticulosAExcel(rows: ProdReferenciaRow[], filename = "maestro_articulos.xlsx"): void {
  const data = rows.map((r) =>
    Object.fromEntries(
      EXPORT_COLS.map(({ key }) => [key, r[key as keyof ProdReferenciaRow] ?? ""])
    )
  );
  const ws = XLSX.utils.json_to_sheet(data, { header: EXPORT_COLS.map((c) => c.key) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "articulos");
  XLSX.writeFile(wb, filename);
}

function fmtPdfText(value: string | number | boolean | null | undefined): string {
  return String(value ?? "").trim() || "-";
}

function fmtPdfFormato(row: ProdReferenciaRow): string {
  const parts = [
    row.formato_largo_mm,
    row.formato_ancho_mm,
    row.formato_fondo_mm,
  ].filter((v) => v != null);
  return parts.length > 0 ? parts.join(" x ") : "-";
}

function fmtPdfPosesTroquel(row: ProdReferenciaRow): string {
  const parts = [
    row.poses_habitual != null ? `${row.poses_habitual} poses` : "",
    row.troquel_habitual ?? "",
  ].filter((v) => String(v).trim());
  return parts.join(" / ") || "-";
}

export function exportarArticulosAPdf(
  rows: ProdReferenciaRow[],
  filename = "maestro_articulos.pdf"
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generated = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Maestro de Articulos", 8, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generado: ${generated} · Registros: ${rows.length}`, 8, 15);

  autoTable(doc, {
    startY: 20,
    head: [[
      "Codigo",
      "Ref. cliente",
      "Descripcion",
      "Cliente",
      "Tipo",
      "Material",
      "Formato",
      "Tintas",
      "Acabado",
      "Poses/Troquel",
    ]],
    body: rows.map((row) => [
      fmtPdfText(row.codigo),
      fmtPdfText(row.referencia_cliente),
      fmtPdfText(row.descripcion),
      fmtPdfText(row.cliente),
      fmtPdfText(row.tipo_producto),
      fmtPdfText(row.material_habitual),
      fmtPdfFormato(row),
      fmtPdfText(row.tintas_habituales),
      fmtPdfText(row.acabado_habitual),
      fmtPdfPosesTroquel(row),
    ]),
    styles: {
      fontSize: 6,
      cellPadding: 0.8,
      overflow: "ellipsize",
      minCellHeight: 4,
    },
    headStyles: {
      fillColor: [0, 33, 71],
      textColor: [255, 255, 255],
      fontSize: 6,
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 20 },
      2: { cellWidth: 48 },
      3: { cellWidth: 36 },
      4: { cellWidth: 16 },
      5: { cellWidth: 34 },
      6: { cellWidth: 18 },
      7: { cellWidth: 28 },
      8: { cellWidth: 32 },
      9: { cellWidth: 28 },
    },
    margin: { left: 8, right: 8 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`Pagina ${page}/${totalPages}`, 288, 205, { align: "right" });
  }

  doc.save(filename);
}

export function descargarPlantillaArticulos(): void {
  const ejemplos = [
    {
      codigo: "M-00001",
      referencia_cliente: "EU858",
      descripcion: "EST BBP PROBIOMIX 10 CAP",
      cliente: "LABORATORIOS ANUR, S.L",
      tipo_producto: "estuche",
      subtipo: "automontable",
      activo: "si",
      formato_largo_mm: 90,
      formato_ancho_mm: 60,
      formato_fondo_mm: 25,
      material_habitual: "Zenith 300g",
      poses_habitual: 4,
      troquel_habitual: "TAG00205",
      tintas_habituales: "4+1",
      acabado_habitual: "Barniz AC brillo",
      ruta_habitual: "impresion+troquelado+engomado",
      notas: "",
    },
    {
      codigo: "M-00002",
      referencia_cliente: "EU1079",
      descripcion: "ESTUCE AQUILEA LIBIPLUS 60 CAPS",
      cliente: "LABORATORIOS ANUR, S.L",
      tipo_producto: "estuche",
      subtipo: "vertical",
      activo: "si",
      formato_largo_mm: 100,
      formato_ancho_mm: 65,
      formato_fondo_mm: 30,
      material_habitual: "Zenith 300g",
      poses_habitual: 4,
      troquel_habitual: "TAG00547",
      tintas_habituales: "4+0",
      acabado_habitual: "Plastificado mate",
      ruta_habitual: "impresion+plastico+troquelado+engomado",
      notas: "",
    },
    {
      codigo: "",
      referencia_cliente: "EU119",
      descripcion: "EST DIELISA VITAE COMPLEX - G1",
      cliente: "LABORATORIOS ANUR, S.L",
      tipo_producto: "estuche",
      subtipo: "",
      activo: "si",
      formato_largo_mm: "",
      formato_ancho_mm: "",
      formato_fondo_mm: "",
      material_habitual: "",
      poses_habitual: "",
      troquel_habitual: "",
      tintas_habituales: "",
      acabado_habitual: "",
      ruta_habitual: "",
      notas: "Fila de ejemplo con codigo vacío: se auto-asigna M-NNNNN al importar",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(ejemplos, {
    header: EXPORT_COLS.map((c) => c.key),
  });

  // Ajustar ancho de columnas
  ws["!cols"] = [
    { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 35 },
    { wch: 14 }, { wch: 16 }, { wch: 8 },
    { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 40 },
    { wch: 50 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "articulos");
  XLSX.writeFile(wb, "plantilla_maestro_articulos.xlsx");
}
