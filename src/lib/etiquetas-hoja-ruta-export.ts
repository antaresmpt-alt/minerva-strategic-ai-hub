import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { entregaPlazoSemaforo, entregaPlazoTitle } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

export type EtiquetasHojaRutaExportFilters = {
  buscar: string;
  papel: string;
  ocultarFinalizadas: boolean;
  ordenLabel: string;
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

function rowToCells(r: ProdEtiquetasHojaRutaRow): string[] {
  return [
    r.ot_numero,
    r.cliente ?? "—",
    r.trabajo ?? "—",
    r.papel ?? "—",
    r.cantidad != null ? String(r.cantidad) : "—",
    fmtDateEs(r.fecha_entrega_ot),
    fmtDateEs(r.fecha_entrada_depto),
    r.urgencia === "urgente" ? "Urgente" : "Normal",
    entregaPlazoSemaforo(r.fecha_entrega_ot),
    entregaPlazoTitle(r.fecha_entrega_ot),
    r.observacion ?? "—",
    boolTxt(r.konica),
    boolTxt(r.troqueladora),
    boolTxt(r.numeradora),
    fmtDateEs(r.fecha_fin_konica),
    fmtDateEs(r.fecha_fin_troqueladora),
    fmtDateEs(r.fecha_fin_numeradora),
    r.troquel_utillaje ?? "—",
    fmtDateEs(r.fecha_inicio_produccion),
    fmtDateEs(r.fecha_fin_produccion),
    r.cajas != null ? String(r.cajas) : "—",
    r.bobinas != null ? String(r.bobinas) : "—",
    r.etiquetas != null ? String(r.etiquetas) : "—",
    r.cajas_restantes ?? "—",
    r.finalizado ? "Sí" : "No",
  ];
}

const EXCEL_HEADERS = [
  "OT",
  "Cliente",
  "Trabajo",
  "Papel",
  "Cantidad",
  "F. entrega OT",
  "F. entrada depto.",
  "Urgencia",
  "Plazo (semáforo)",
  "Plazo (texto)",
  "Observación",
  "Konica",
  "Troqueladora",
  "Numeradora",
  "F. fin Konica",
  "F. fin Troqueladora",
  "F. fin Numeradora",
  "Troquel (utillaje)",
  "F. inicio prod.",
  "F. fin prod.",
  "Cajas",
  "Bobinas",
  "Etiquetas",
  "Cajas restantes",
  "Finalizado",
];

function fmtNowEs(): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

export function exportEtiquetasHojaRutaExcel(
  rows: ProdEtiquetasHojaRutaRow[],
  filters: EtiquetasHojaRutaExportFilters
): void {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["Minerva Global — Etiquetas digital · Hoja de ruta"],
    [],
    ["Generado", fmtNowEs()],
    ["Buscar", filters.buscar.trim() || "—"],
    ["Papel", filters.papel.trim() || "Todos"],
    ["Ocultar finalizadas", filters.ocultarFinalizadas ? "Sí" : "No"],
    ["Orden", filters.ordenLabel],
    ["Registros exportados", rows.length],
    [],
    ["www.minervaglobal.es"],
  ]);
  const data = rows.map(rowToCells);
  const detail = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...data]);
  detail["!freeze"] = { xSplit: 0, ySplit: 1 };
  detail["!cols"] = EXCEL_HEADERS.map((h, i) => ({
    wch:
      i === 8
        ? 28
        : h === "Trabajo" || h === "Cliente"
          ? 22
          : h === "Observación"
            ? 24
            : 12,
  }));
  XLSX.utils.book_append_sheet(wb, summary, "Resumen");
  XLSX.utils.book_append_sheet(wb, detail, "Hoja de ruta");
  const tag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `etiquetas-hoja-ruta-${tag}.xlsx`);
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

export function exportEtiquetasHojaRutaPdf(
  rows: ProdEtiquetasHojaRutaRow[],
  filters: EtiquetasHojaRutaExportFilters
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generated = fmtNowEs();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Hoja de ruta — Etiquetas digital", 10, 10);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(10, 13, 277, 18, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Minerva Global · Generado: ${generated}`, 13, 19);
  doc.text(
    `Filtros: búsqueda «${filters.buscar.trim() || "—"}» · papel: ${filters.papel.trim() || "todos"} · ` +
      `ocultar finalizadas: ${filters.ocultarFinalizadas ? "sí" : "no"} · orden: ${filters.ordenLabel}`,
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
  doc.text("Etiquetas digital — Hoja de ruta", 8, yFoot);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(`Página ${p}/${totalPages}`, 288, 205, { align: "right" });
  }

  const tag = new Date().toISOString().slice(0, 10);
  doc.save(`etiquetas-hoja-ruta-${tag}.pdf`);
}
