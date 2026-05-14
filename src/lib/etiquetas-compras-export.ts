import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type { ProdEtiquetasCompraRow } from "@/types/prod-etiquetas-compras";

export type EtiquetasComprasExportFilters = {
  buscar: string;
  propietarioLabel: string;
  prioridadLabel: string;
  soloPendientes: boolean;
};

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

function fmtDateEs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const raw = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw.slice(0, 10) + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function boolTxt(v: boolean) {
  return v ? "Sí" : "No";
}

function prioridadLabel(p: ProdEtiquetasCompraRow["prioridad"]): string {
  if (p === "ALTA") return "Alta";
  if (p === "BAJA") return "Baja";
  return "Media";
}

function rowToCells(r: ProdEtiquetasCompraRow): string[] {
  return [
    r.producto,
    String(r.unidad),
    boolTxt(r.recibido),
    boolTxt(r.enviado),
    r.propietario === "RITA" ? "Rita" : "Hugo",
    fmtDateEs(r.fecha_pedido),
    fmtDateEs(r.fecha_llegada),
    r.equipo || "—",
    r.tipo_linea,
    r.marca,
    prioridadLabel(r.prioridad),
    r.enviado_at ? fmtDateEs(r.enviado_at) : "—",
  ];
}

const EXCEL_HEADERS = [
  "Producto",
  "Ud.",
  "Recibido",
  "Enviado (correo)",
  "Prop.",
  "F. pedido",
  "F. llegada",
  "Equipo",
  "Tipo",
  "Marca",
  "Prioridad",
  "F. envío correo",
];

function fmtNowEs(): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

export function exportEtiquetasComprasExcel(
  rows: ProdEtiquetasCompraRow[],
  filters: EtiquetasComprasExportFilters
): void {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["Minerva Global — Etiquetas digital · Compras"],
    [],
    ["Generado", fmtNowEs()],
    ["Buscar", filters.buscar.trim() || "—"],
    ["Propietario", filters.propietarioLabel],
    ["Prioridad", filters.prioridadLabel],
    ["Solo pendientes (recibido)", filters.soloPendientes ? "Sí" : "No"],
    ["Registros exportados", rows.length],
    [],
    ["www.minervaglobal.es"],
  ]);
  const data = rows.map(rowToCells);
  const detail = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...data]);
  detail["!freeze"] = { xSplit: 0, ySplit: 1 };
  detail["!cols"] = EXCEL_HEADERS.map((h) => ({
    wch:
      h === "Producto"
        ? 28
        : h === "Equipo" || h === "Marca"
          ? 16
          : 12,
  }));
  XLSX.utils.book_append_sheet(wb, summary, "Resumen");
  XLSX.utils.book_append_sheet(wb, detail, "Compras");
  const tag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `etiquetas-compras-${tag}.xlsx`);
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

export function exportEtiquetasComprasPdf(
  rows: ProdEtiquetasCompraRow[],
  filters: EtiquetasComprasExportFilters
): void {
  if (rows.length === 0) return;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const generated = fmtNowEs();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Compras — Etiquetas digital", 10, 10);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(10, 13, 277, 20, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Minerva Global · Generado: ${generated}`, 13, 19);
  doc.text(
    `Filtros: búsqueda «${filters.buscar.trim() || "—"}» · propietario: ${filters.propietarioLabel} · ` +
      `prioridad: ${filters.prioridadLabel} · solo pendientes: ${filters.soloPendientes ? "sí" : "no"}`,
    13,
    24
  );
  doc.text(`Registros: ${rows.length}`, 13, 29);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 36,
    head: [EXCEL_HEADERS],
    body: rows.map(rowToCells),
    styles: { fontSize: 6.2, cellPadding: 1.2 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
  });

  const yFoot = Math.min(lastTableY(doc, 36) + 10, 198);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text("Etiquetas digital — Compras", 8, yFoot);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(`Página ${p}/${totalPages}`, 288, 205, { align: "right" });
  }

  const tag = new Date().toISOString().slice(0, 10);
  doc.save(`etiquetas-compras-${tag}.pdf`);
}
