import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type { ProdEtiquetasMaterialCatalogoRow } from "@/types/prod-etiquetas-material-catalogo";

export type EtiquetasMaterialExportFilters = {
  buscar: string;
  marcaLabel: string;
  categoriaLabel: string;
  soloActivos: boolean;
};

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("es-ES", { maximumFractionDigits: 4 });
}

function rowToCells(r: ProdEtiquetasMaterialCatalogoRow): string[] {
  return [
    r.marca,
    r.categoria ?? "—",
    r.item_number,
    r.face_name ?? "—",
    r.adhesive ?? "—",
    r.backing ?? "—",
    fmtPrice(r.price_m2),
    r.ean_code ?? "—",
    r.notes ?? "—",
    r.stock_dimensions ?? "—",
    r.activo ? "Sí" : "No",
  ];
}

const EXCEL_HEADERS = [
  "Marca",
  "Categoría",
  "Código",
  "Face name",
  "Adhesivo",
  "Backing",
  "Precio €/m²",
  "EAN",
  "Notas",
  "Stock / ancho",
  "Activo",
];

export function exportEtiquetasMaterialExcel(
  rows: ProdEtiquetasMaterialCatalogoRow[],
  filters: EtiquetasMaterialExportFilters
): void {
  const tag = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();
  const data = [EXCEL_HEADERS, ...rows.map(rowToCells)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Material");

  const resumen = [
    ["Consulta material — Etiquetas digital"],
    ["Generado", new Date().toLocaleString("es-ES")],
    ["Registros", String(rows.length)],
    ["Búsqueda", filters.buscar || "—"],
    ["Marca", filters.marcaLabel],
    ["Categoría", filters.categoriaLabel],
    ["Solo activos", filters.soloActivos ? "Sí" : "No"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
  XLSX.writeFile(wb, `etiquetas-consulta-material-${tag}.xlsx`);
}

export function exportEtiquetasMaterialPdf(
  rows: ProdEtiquetasMaterialCatalogoRow[],
  filters: EtiquetasMaterialExportFilters
): void {
  const tag = new Date().toISOString().slice(0, 10);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Consulta material — Etiquetas digital", 10, 10);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(10, 13, 277, 18, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `Registros: ${rows.length} · Marca: ${filters.marcaLabel} · Cat.: ${filters.categoriaLabel} · Activos: ${filters.soloActivos ? "sí" : "todos"}`,
    13,
    19
  );
  doc.text(`Búsqueda: ${filters.buscar || "—"}`, 13, 24);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 34,
    head: [EXCEL_HEADERS],
    body: rows.map(rowToCells),
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
  });

  doc.save(`etiquetas-consulta-material-${tag}.pdf`);
}

/** Línea para pegar en correo de pedido. */
export function formatMaterialMailLine(r: ProdEtiquetasMaterialCatalogoRow): string {
  const parts = [
    r.item_number,
    r.face_name,
    r.adhesive,
    r.backing,
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  const ean = r.ean_code?.trim();
  const base = parts.join(" / ");
  return ean ? `${base} · EAN ${ean}` : base;
}
