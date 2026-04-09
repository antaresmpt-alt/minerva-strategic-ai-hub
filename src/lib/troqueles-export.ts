import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { formatFechaEsCorta } from "@/lib/produccion-date-format";

export type TroquelExportSource = {
  num_troquel: string;
  proveedor: string | null;
  ref_proveedor: string | null;
  cliente: string | null;
  descripcion: string | null;
  tipo_producto: string | null;
  mides: string | null;
  num_figuras: string | null;
  material: string | null;
  formato_papel: string | null;
  figuras_hoja: string | null;
  pinza: string | null;
  plancha_hendidos: string | null;
  expulsion: string | null;
  num_expulsion: string | null;
  taco: string | null;
  relieve_seco: string | null;
  caucho_acrilico: string | null;
  maquina: string | null;
  fecha_ultima_fab: string | null;
  notas: string | null;
};

function cell(v: string | null | undefined): string {
  if (v == null) return "";
  const t = String(v).trim();
  return t || "";
}

function fechaCorta(v: string | null | undefined): string {
  if (!v) return "";
  return formatFechaEsCorta(`${v}T12:00:00`);
}

const EXCEL_HEADERS = [
  "Nº troquel",
  "Proveedor",
  "Ref. proveedor",
  "Cliente",
  "Descripción",
  "Tipo producto",
  "Mides",
  "Nº figuras",
  "Material",
  "Formato papel",
  "Figuras / hoja",
  "Pinza",
  "Plancha hendidos",
  "Expulsión",
  "Nº expulsión",
  "Taco",
  "Relieve seco",
  "Caucho acrílico",
  "Máquina",
  "Fecha última fab.",
  "Notas",
] as const;

export function exportTroquelesToExcel(
  rows: TroquelExportSource[],
  fileBaseName = "troqueles"
): void {
  const data = rows.map((r) => ({
    [EXCEL_HEADERS[0]]: cell(r.num_troquel),
    [EXCEL_HEADERS[1]]: cell(r.proveedor),
    [EXCEL_HEADERS[2]]: cell(r.ref_proveedor),
    [EXCEL_HEADERS[3]]: cell(r.cliente),
    [EXCEL_HEADERS[4]]: cell(r.descripcion),
    [EXCEL_HEADERS[5]]: cell(r.tipo_producto),
    [EXCEL_HEADERS[6]]: cell(r.mides),
    [EXCEL_HEADERS[7]]: cell(r.num_figuras),
    [EXCEL_HEADERS[8]]: cell(r.material),
    [EXCEL_HEADERS[9]]: cell(r.formato_papel),
    [EXCEL_HEADERS[10]]: cell(r.figuras_hoja),
    [EXCEL_HEADERS[11]]: cell(r.pinza),
    [EXCEL_HEADERS[12]]: cell(r.plancha_hendidos),
    [EXCEL_HEADERS[13]]: cell(r.expulsion),
    [EXCEL_HEADERS[14]]: cell(r.num_expulsion),
    [EXCEL_HEADERS[15]]: cell(r.taco),
    [EXCEL_HEADERS[16]]: cell(r.relieve_seco),
    [EXCEL_HEADERS[17]]: cell(r.caucho_acrilico),
    [EXCEL_HEADERS[18]]: cell(r.maquina),
    [EXCEL_HEADERS[19]]: fechaCorta(r.fecha_ultima_fab),
    [EXCEL_HEADERS[20]]: cell(r.notas),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Troqueles");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileBaseName}-${stamp}.xlsx`);
}

export function exportTroquelesListadoPdf(
  rows: TroquelExportSource[],
  fileBaseName = "listado-troqueles"
): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const fechaTitulo = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.setFontSize(11);
  doc.text(`Listado de troqueles — ${fechaTitulo}`, 14, 12);

  const head = [
    [
      "Nº",
      "Cliente",
      "Descripción",
      "Mides",
      "Material",
      "Máquina",
      "Expulsión",
      "Fecha fab.",
    ],
  ];
  const body = rows.map((r) => [
    cell(r.num_troquel) || "—",
    cell(r.cliente) || "—",
    cell(r.descripcion) || "—",
    cell(r.mides) || "—",
    cell(r.material) || "—",
    cell(r.maquina) || "—",
    cell(r.expulsion) || "—",
    fechaCorta(r.fecha_ultima_fab) || "—",
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 18,
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fontSize: 7, fillColor: [0, 33, 71] },
    margin: { left: 10, right: 10 },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${fileBaseName}-${stamp}.pdf`);
}
