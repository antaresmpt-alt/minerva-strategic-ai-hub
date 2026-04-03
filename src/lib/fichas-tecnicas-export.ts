import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { formatFechaEsCorta } from "@/lib/produccion-date-format";

/** Filas listas para exportar (compatible con FichaTecnicaRow). */
export type FichaTecnicaExportSource = {
  ot: number;
  cliente: string;
  trabajo: string;
  tipo_material: string | null;
  gramaje: string | null;
  maquinista: string | null;
  fecha: string | null;
  created_at: string;
  densidad_1: number | null;
  densidad_2: number | null;
  densidad_3: number | null;
  densidad_4: number | null;
  densidad_5: number | null;
  densidad_6: number | null;
  densidad_7: number | null;
  densidad_8: number | null;
};

function densidadCell(v: number | null | undefined): string | number {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return String(v);
}

function fechaCorta(row: FichaTecnicaExportSource): string {
  if (row.fecha) {
    return formatFechaEsCorta(`${row.fecha}T12:00:00`);
  }
  return formatFechaEsCorta(row.created_at);
}

const EXCEL_HEADERS = [
  "OT",
  "Cliente",
  "Trabajo",
  "Material",
  "Gramaje",
  "Maquinista",
  "Fecha",
  "Densidad 1",
  "Densidad 2",
  "Densidad 3",
  "Densidad 4",
  "Densidad 5",
  "Densidad 6",
  "Densidad 7",
  "Densidad 8",
] as const;

export function exportFichasTecnicasToExcel(
  rows: FichaTecnicaExportSource[],
  fileBaseName = "fichas-tecnicas"
): void {
  const data = rows.map((r) => ({
    [EXCEL_HEADERS[0]]: r.ot,
    [EXCEL_HEADERS[1]]: r.cliente ?? "",
    [EXCEL_HEADERS[2]]: r.trabajo ?? "",
    [EXCEL_HEADERS[3]]: r.tipo_material ?? "",
    [EXCEL_HEADERS[4]]: r.gramaje ?? "",
    [EXCEL_HEADERS[5]]: r.maquinista ?? "",
    [EXCEL_HEADERS[6]]: fechaCorta(r),
    [EXCEL_HEADERS[7]]: densidadCell(r.densidad_1),
    [EXCEL_HEADERS[8]]: densidadCell(r.densidad_2),
    [EXCEL_HEADERS[9]]: densidadCell(r.densidad_3),
    [EXCEL_HEADERS[10]]: densidadCell(r.densidad_4),
    [EXCEL_HEADERS[11]]: densidadCell(r.densidad_5),
    [EXCEL_HEADERS[12]]: densidadCell(r.densidad_6),
    [EXCEL_HEADERS[13]]: densidadCell(r.densidad_7),
    [EXCEL_HEADERS[14]]: densidadCell(r.densidad_8),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fichas");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileBaseName}-${stamp}.xlsx`);
}

export function exportFichasTecnicasListadoPdf(
  rows: FichaTecnicaExportSource[],
  fileBaseName = "listado-fichas-tecnicas"
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const fechaTitulo = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const title = `Listado de Fichas Técnicas - ${fechaTitulo}`;
  doc.setFontSize(11);
  doc.text(title, 14, 12);

  const head = [["OT", "Cliente", "Trabajo", "Maquinista", "Fecha"]];
  const body = rows.map((r) => [
    String(r.ot),
    String(r.cliente ?? "").trim() || "—",
    String(r.trabajo ?? "").trim() || "—",
    String(r.maquinista ?? "").trim() || "—",
    fechaCorta(r),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 18,
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fontSize: 9, fillColor: [0, 33, 71] },
    margin: { left: 10, right: 10 },
    tableWidth: "auto",
    theme: "striped",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${fileBaseName}-${stamp}.pdf`);
}
