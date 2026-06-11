import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  cantidadEtiquetasKpi,
  formatEtiquetasKpi,
  formatMetrosKpi,
  type EtiquetasHojaRutaKpis,
} from "@/lib/etiquetas-hoja-ruta-kpis";
import {
  entregaPlazoSemaforo,
  entregaPlazoTitle,
  type EntregaPlazoSemaforo,
} from "@/lib/etiquetas-hoja-ruta-plazo";
import { resolveTroquelDisplay } from "@/lib/etiquetas-troqueles-display";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type { ProdEtiquetasTroquelRow } from "@/types/prod-etiquetas-troqueles";

export type EtiquetasHojaRutaExportFilters = {
  buscar: string;
  papel: string;
  ocultarFinalizadas: boolean;
  ordenLabel: string;
  selectionLabel?: string;
};

export type EtiquetasHojaRutaExportOptions = {
  /** Vista ampliada (no compacto): incluir bloque KPI en resumen. */
  includeKpis: boolean;
  kpis: EtiquetasHojaRutaKpis;
  troquelesById?: Map<number, ProdEtiquetasTroquelRow>;
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

function fmtDateEsShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const raw = String(iso).trim();
  const d = /^\d{4}-\d{2}-\d{2}/.test(raw)
    ? new Date(raw.slice(0, 10) + "T12:00:00")
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function boolTxt(v: boolean) {
  return v ? "Sí" : "No";
}

function fmtMetros(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} m`;
}

function sumEtiquetasOts(rows: ProdEtiquetasHojaRutaRow[]): number {
  return rows.reduce((total, row) => total + (cantidadEtiquetasKpi(row.cantidad) ?? 0), 0);
}

function rowToCells(
  r: ProdEtiquetasHojaRutaRow,
  troquelesById: Map<number, ProdEtiquetasTroquelRow>
): string[] {
  return [
    r.ot_numero,
    r.cliente ?? "—",
    r.trabajo ?? "—",
    r.papel ?? "—",
    r.cantidad != null ? String(r.cantidad) : "—",
    fmtDateEs(r.fecha_entrega_ot),
    fmtDateEs(r.fecha_entrada_depto),
    r.urgencia === "urgente" ? "Urgente" : "Normal",
    r.finalizado ? "Finalizada" : entregaPlazoSemaforo(r.fecha_entrega_ot),
    r.finalizado ? "Trabajo finalizado" : entregaPlazoTitle(r.fecha_entrega_ot),
    r.observacion ?? "—",
    boolTxt(r.konica),
    boolTxt(r.troqueladora),
    boolTxt(r.numeradora),
    fmtDateEsShort(r.fecha_fin_konica),
    fmtDateEsShort(r.fecha_fin_troqueladora),
    fmtDateEsShort(r.fecha_fin_numeradora),
    fmtMetros(r.metros_impresion),
    resolveTroquelDisplay(r, troquelesById),
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
  "Metros impresión",
  "Troquel (utillaje)",
  "Cajas",
  "Bobinas",
  "Etiquetas",
  "Cajas restantes",
  "Finalizado",
];

const PDF_HEADERS = [
  "OT",
  "Cliente",
  "Trabajo",
  "Papel",
  "Cant.",
  "F.entrega",
  "F.entrada",
  "Urg.",
  "P",
  "Obs.",
  "I",
  "T",
  "N",
  "Troquel",
  "Caj",
  "Bob",
  "Etq",
  "Mts",
  "Resto",
  "Fin.",
] as const;

const PDF_PLAZO_COL = 8;
const PDF_I_COL = 10;
const PDF_T_COL = 11;
const PDF_N_COL = 12;
const PDF_FIN_COL = 19;

const PDF_MARGIN = { left: 8, right: 8 } as const;

/** Pesos relativos; el ancho total se reparte en toda la página. */
const PDF_COL_WEIGHTS: number[] = [
  9, 24, 44, 14, 8, 11, 11, 5, 5, 18, 10, 10, 10, 11, 6, 6, 7, 8, 12, 5,
];

const PDF_COL_WEIGHT_SUM = PDF_COL_WEIGHTS.reduce((a, b) => a + b, 0);

const PDF_CENTER_COLS = new Set([
  PDF_PLAZO_COL,
  PDF_I_COL,
  PDF_T_COL,
  PDF_N_COL,
  PDF_FIN_COL,
  7,
]);

const PLAZO_FILL: Record<EntregaPlazoSemaforo, [number, number, number]> = {
  rojo: [239, 68, 68],
  amarillo: [251, 191, 36],
  verde: [16, 185, 129],
  none: [203, 213, 225],
};

function pdfTxt(s: string | null | undefined): string {
  const t = String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return t || "—";
}

function pdfTableWidth(doc: jsPDF): number {
  const pageW = doc.internal.pageSize.getWidth();
  return pageW - PDF_MARGIN.left - PDF_MARGIN.right;
}

type PdfColStyle = {
  cellWidth: number;
  halign?: "center" | "left" | "right";
  overflow?: "ellipsize" | "linebreak" | "hidden";
};

function pdfColumnStyles(tableWidth: number): Record<number, PdfColStyle> {
  const styles: Record<number, PdfColStyle> = {};
  PDF_COL_WEIGHTS.forEach((w, i) => {
    styles[i] = {
      cellWidth: (tableWidth * w) / PDF_COL_WEIGHT_SUM,
      overflow: "ellipsize",
      halign: PDF_CENTER_COLS.has(i)
        ? "center"
        : i === 4 || (i >= 14 && i <= 17)
          ? "right"
          : "left",
    };
  });
  return styles;
}

function drawPdfCheck(
  doc: jsPDF,
  cx: number,
  cy: number,
  color: [number, number, number] = NAVY,
  lineWidth = 0.22,
  scale = 0.85
): void {
  const s = scale;
  doc.setDrawColor(...color);
  doc.setLineWidth(lineWidth);
  doc.line(cx - s, cy + 0.1, cx - s * 0.25, cy + s * 0.55);
  doc.line(cx - s * 0.25, cy + s * 0.55, cx + s, cy - s * 0.45);
}

/** Fila PDF compacta (sin plazo texto; I/T/N se muestran como fecha corta). */
function rowToPdfBody(
  r: ProdEtiquetasHojaRutaRow,
  troquelesById: Map<number, ProdEtiquetasTroquelRow>
): string[] {
  return [
    r.ot_numero,
    pdfTxt(r.cliente),
    pdfTxt(r.trabajo),
    pdfTxt(r.papel),
    r.cantidad != null ? String(r.cantidad) : "—",
    fmtDateEs(r.fecha_entrega_ot),
    fmtDateEs(r.fecha_entrada_depto),
    r.urgencia === "urgente" ? "!" : "",
    "",
    pdfTxt(r.observacion),
    fmtDateEsShort(r.fecha_fin_konica),
    fmtDateEsShort(r.fecha_fin_troqueladora),
    fmtDateEsShort(r.fecha_fin_numeradora),
    pdfTxt(resolveTroquelDisplay(r, troquelesById)),
    r.cajas != null ? String(r.cajas) : "—",
    r.bobinas != null ? String(r.bobinas) : "—",
    r.etiquetas != null ? String(r.etiquetas) : "—",
    r.metros_impresion != null
      ? r.metros_impresion.toLocaleString("es-ES", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })
      : "—",
    pdfTxt(r.cajas_restantes),
    "",
  ];
}

function fmtNowEs(): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function exportFileTag(includeKpis: boolean): string {
  const date = new Date().toISOString().slice(0, 10);
  return includeKpis
    ? `etiquetas-hoja-ruta-${date}-resumen`
    : `etiquetas-hoja-ruta-${date}`;
}

function buildSummaryAoa(
  filters: EtiquetasHojaRutaExportFilters,
  rows: ProdEtiquetasHojaRutaRow[],
  options: EtiquetasHojaRutaExportOptions
): (string | number)[][] {
  const rowCount = rows.length;
  const etiquetasOts = sumEtiquetasOts(rows);
  const base: (string | number)[][] = [
    ["Minerva Global — Etiquetas digital · Hoja de ruta"],
    [],
    ["Generado", fmtNowEs()],
    ["Buscar", filters.buscar.trim() || "—"],
    ["Papel", filters.papel.trim() || "Todos"],
    ["Ocultar finalizadas", filters.ocultarFinalizadas ? "Sí" : "No"],
    ["Orden", filters.ordenLabel],
    ["Selección", filters.selectionLabel?.trim() || "Según filtros aplicados"],
    ["Registros exportados (filtros)", rowCount],
  ];

  if (options.includeKpis) {
    const k = options.kpis;
    base.push(
      [],
      ["Indicadores"],
      [
        "Nota",
        "Etiquetas OTs respeta la selección exportada; el resto de KPIs son globales.",
      ],
      ["Etiquetas OTs (cantidad, selección)", formatEtiquetasKpi(etiquetasOts)],
      ["Metros hoy (Konica)", formatMetrosKpi(k.metrosHoy)],
      ["Metros este mes (Konica)", formatMetrosKpi(k.metrosMes)],
      ["Cola Konica (OTs)", k.colaKonica],
      ["Plazo ≤ 4 días (OTs activas)", k.plazoCritico]
    );
  }

  base.push([], ["www.minervaglobal.es"]);
  return base;
}

/** Dibuja los KPIs en fila; devuelve Y donde puede empezar la tabla. */
function drawKpisBlock(
  doc: jsPDF,
  kpis: EtiquetasHojaRutaKpis,
  rows: ProdEtiquetasHojaRutaRow[],
  startY: number
): number {
  const margin = PDF_MARGIN.left;
  const usable = pdfTableWidth(doc);
  const gap = 3;
  const cols = 5;
  const boxW = (usable - gap * (cols - 1)) / cols;
  const boxH = 14;
  const etiquetasOts = sumEtiquetasOts(rows);

  const items: { label: string; value: string; fill: [number, number, number] }[] = [
    {
      label: "Etiquetas OTs",
      value: formatEtiquetasKpi(etiquetasOts),
      fill: LIGHT_BG,
    },
    {
      label: "Metros hoy",
      value: formatMetrosKpi(kpis.metrosHoy),
      fill: [220, 252, 231],
    },
    {
      label: "Metros este mes",
      value: formatMetrosKpi(kpis.metrosMes),
      fill: [209, 250, 229],
    },
    {
      label: "Cola Konica",
      value: String(kpis.colaKonica),
      fill: [255, 251, 235],
    },
    {
      label: "Plazo <= 4 dias",
      value: String(kpis.plazoCritico),
      fill: [254, 242, 242],
    },
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("Indicadores", margin, startY + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text(
    "Etiquetas OTs respeta la selección exportada; el resto de KPIs son globales.",
    margin,
    startY + 7
  );

  const y0 = startY + 9;
  items.forEach((item, i) => {
    const x = margin + i * (boxW + gap);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(...item.fill);
    doc.roundedRect(x, y0, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text(item.label, x + 2, y0 + 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(item.value, x + 2, y0 + 10.5);
  });

  doc.setTextColor(0, 0, 0);
  return y0 + boxH + 4;
}

export function exportEtiquetasHojaRutaExcel(
  rows: ProdEtiquetasHojaRutaRow[],
  filters: EtiquetasHojaRutaExportFilters,
  options: EtiquetasHojaRutaExportOptions
): void {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(
    buildSummaryAoa(filters, rows, options)
  );
  summary["!cols"] = [{ wch: 36 }, { wch: 28 }];
  const troquelesById = options.troquelesById ?? new Map();
  const data = rows.map((row) => rowToCells(row, troquelesById));
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
  XLSX.writeFile(wb, `${exportFileTag(options.includeKpis)}.xlsx`);
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

export function exportEtiquetasHojaRutaPdf(
  rows: ProdEtiquetasHojaRutaRow[],
  filters: EtiquetasHojaRutaExportFilters,
  options: EtiquetasHojaRutaExportOptions
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generated = fmtNowEs();
  const titleSuffix = options.includeKpis ? " (con indicadores)" : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  const headerX = PDF_MARGIN.left;
  const tableW = pdfTableWidth(doc);

  doc.text(`Hoja de ruta — Etiquetas digital${titleSuffix}`, headerX, 10);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(headerX, 13, tableW, 22, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Minerva Global · Generado: ${generated}`, headerX + 3, 19);
  doc.text(
    `Filtros: busqueda «${filters.buscar.trim() || "—"}» · papel: ${filters.papel.trim() || "todos"} · ` +
      `ocultar finalizadas: ${filters.ocultarFinalizadas ? "si" : "no"} · orden: ${filters.ordenLabel}`,
    headerX + 3,
    24
  );
  doc.text(
    `Selección: ${filters.selectionLabel?.trim() || "Según filtros aplicados"}`,
    headerX + 3,
    29
  );
  doc.text(`Registros en listado: ${rows.length}`, headerX + 3, 34);
  doc.setFontSize(7);
  doc.text(
    "P = plazo; finalizadas = check verde  |  I / T / N = fechas Kon / Troq / Num",
    headerX + tableW,
    34,
    { align: "right" }
  );
  doc.setTextColor(0, 0, 0);

  let tableStartY = 40;
  if (options.includeKpis) {
    tableStartY = drawKpisBlock(doc, options.kpis, rows, 38);
  }

  const troquelesById = options.troquelesById ?? new Map();
  const pdfRows = rows.map((row) => rowToPdfBody(row, troquelesById));

  autoTable(doc, {
    startY: tableStartY,
    tableWidth: tableW,
    head: [[...PDF_HEADERS]],
    body: pdfRows,
    styles: {
      fontSize: 6,
      cellPadding: 0.85,
      overflow: "ellipsize",
      minCellHeight: 4.8,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontSize: 5.8,
      cellPadding: 0.9,
    },
    columnStyles: pdfColumnStyles(tableW),
    margin: { ...PDF_MARGIN },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const idx = hook.column.index;
      if (
        idx === PDF_PLAZO_COL ||
        idx === PDF_FIN_COL
      ) {
        hook.cell.text = [];
      }
    },
    didDrawCell: (hook) => {
      if (hook.section !== "body") return;
      const idx = hook.column.index;
      const row = rows[hook.row.index];
      if (!row) return;

      const cx = hook.cell.x + hook.cell.width / 2;
      const cy = hook.cell.y + hook.cell.height / 2;

      if (idx === PDF_PLAZO_COL) {
        if (row.finalizado) {
          drawPdfCheck(doc, cx, cy, [16, 185, 129], 0.38, 1.15);
          return;
        }
        const nivel = entregaPlazoSemaforo(row.fecha_entrega_ot);
        doc.setFillColor(...PLAZO_FILL[nivel]);
        doc.circle(cx, cy, 1.05, "F");
        if (row.urgencia === "urgente" && nivel !== "rojo") {
          doc.setDrawColor(239, 68, 68);
          doc.setLineWidth(0.25);
          doc.circle(cx, cy, 1.35, "S");
        }
        return;
      }

      if (idx === PDF_FIN_COL && row.finalizado) {
        drawPdfCheck(doc, cx, cy);
      }
    },
  });

  const yFoot = Math.min(lastTableY(doc, tableStartY) + 10, 198);
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

  doc.save(`${exportFileTag(options.includeKpis)}.pdf`);
}
