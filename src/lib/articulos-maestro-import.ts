import * as XLSX from "xlsx";
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
>;

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

          return {
            codigo,
            referencia_cliente: cleanStr(row.referencia_cliente),
            descripcion: cleanStr(row.descripcion),
            cliente: cleanStr(row.cliente),
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

  const nuevos: ArticuloImportRow[] = [];
  const modificados: ArticuloDiffResult["modificados"] = [];
  const sinCambios: ArticuloImportRow[] = [];

  for (const row of incoming) {
    const key = row.codigo.trim().toUpperCase();
    const ex = byCode.get(key);
    if (!ex) {
      nuevos.push(row);
      continue;
    }

    const changed =
      cleanStr(row.referencia_cliente) !== (ex.referencia_cliente ?? null) ||
      cleanStr(row.descripcion) !== (ex.descripcion ?? null) ||
      cleanStr(row.cliente) !== (ex.cliente ?? null) ||
      cleanStr(row.tipo_producto) !== (ex.tipo_producto ?? null) ||
      cleanStr(row.subtipo) !== (ex.subtipo ?? null) ||
      row.activo !== ex.activo ||
      parseOptionalNum(row.formato_largo_mm) !== (ex.formato_largo_mm ?? null) ||
      parseOptionalNum(row.formato_ancho_mm) !== (ex.formato_ancho_mm ?? null) ||
      parseOptionalNum(row.formato_fondo_mm) !== (ex.formato_fondo_mm ?? null) ||
      cleanStr(row.material_habitual) !== (ex.material_habitual ?? null) ||
      parseOptionalInt(row.poses_habitual) !== (ex.poses_habitual ?? null) ||
      cleanStr(row.troquel_habitual) !== (ex.troquel_habitual ?? null) ||
      cleanStr(row.tintas_habituales) !== (ex.tintas_habituales ?? null) ||
      cleanStr(row.acabado_habitual) !== (ex.acabado_habitual ?? null) ||
      cleanStr(row.ruta_habitual) !== (ex.ruta_habitual ?? null) ||
      cleanStr(row.notas) !== (ex.notas ?? null);

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
): Promise<{ insertados: number; actualizados: number }> {
  let insertados = 0;
  let actualizados = 0;

  if (diff.nuevos.length > 0) {
    const { error } = await supabase.from("prod_referencias").insert(diff.nuevos);
    if (error) throw error;
    insertados = diff.nuevos.length;
  }

  if (opts.incluirModificados && diff.modificados.length > 0) {
    for (const { incoming, existing } of diff.modificados) {
      const { error } = await supabase
        .from("prod_referencias")
        .update({
          referencia_cliente: incoming.referencia_cliente,
          descripcion: incoming.descripcion,
          cliente: incoming.cliente,
          tipo_producto: incoming.tipo_producto,
          subtipo: incoming.subtipo,
          activo: incoming.activo,
          formato_largo_mm: incoming.formato_largo_mm,
          formato_ancho_mm: incoming.formato_ancho_mm,
          formato_fondo_mm: incoming.formato_fondo_mm,
          material_habitual: incoming.material_habitual,
          poses_habitual: incoming.poses_habitual,
          troquel_habitual: incoming.troquel_habitual,
          tintas_habituales: incoming.tintas_habituales,
          acabado_habitual: incoming.acabado_habitual,
          ruta_habitual: incoming.ruta_habitual,
          notas: incoming.notas,
        })
        .eq("id", existing.id);
      if (error) throw error;
      actualizados++;
    }
  }

  return { insertados, actualizados };
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
