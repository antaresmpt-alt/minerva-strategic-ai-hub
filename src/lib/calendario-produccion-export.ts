import { jsPDF } from "jspdf";

import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import {
  diasLaborablesCabecera,
  mesAnioLabel,
} from "@/lib/etiquetas-calendario-mensual";
import type { CalendarioSemanaLaboral } from "@/lib/etiquetas-calendario-mensual";

const NAVY: [number, number, number] = [0, 33, 71];
const WHITE: [number, number, number] = [255, 255, 255];
const SLATE: [number, number, number] = [71, 85, 105];
const BORDER: [number, number, number] = [203, 213, 225];

const MARGIN = 8;
const HEADER_H = 20;
const COL_HEADER_H = 6;

function pageW(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}
function pageH(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

function fmtNowEs(): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

export function exportCalendarioProduccionMensualPdf(params: {
  year: number;
  monthIndex: number;
  semanas: CalendarioSemanaLaboral[];
  entradasByDay: Map<string, CalendarioProduccionLinea[]>;
  includeSaturday?: boolean;
  filtroTexto?: string;
}): void {
  const {
    year,
    monthIndex,
    semanas,
    entradasByDay,
    includeSaturday = false,
    filtroTexto = "",
  } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = pageW(doc);
  const h = pageH(doc);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, HEADER_H, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Calendario Producción", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(mesAnioLabel(year, monthIndex), MARGIN, 15);
  const filtroLabel = filtroTexto.trim()
    ? `Filtro: ${filtroTexto.trim()}`
    : "Sin filtro";
  doc.text(filtroLabel, MARGIN, 19);
  doc.text(`Generado: ${fmtNowEs()}`, w - MARGIN, 15, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let y = HEADER_H + 2;
  const dias = diasLaborablesCabecera(includeSaturday);
  const usable = w - MARGIN * 2;
  const colW = usable / dias.length;

  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, usable, COL_HEADER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  dias.forEach((d, i) => {
    doc.text(d, MARGIN + i * colW + colW / 2, y + 4.2, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  y += COL_HEADER_H;

  const footerReserve = 10;
  const gridH = h - y - footerReserve;
  const rowH = semanas.length > 0 ? gridH / semanas.length : gridH;

  for (let r = 0; r < semanas.length; r++) {
    const semana = semanas[r]!;
    const rowY = y + r * rowH;
    for (let c = 0; c < dias.length; c++) {
      const celda = semana[c];
      const x = MARGIN + c * colW;
      doc.setDrawColor(...BORDER);
      doc.setFillColor(255, 255, 255);
      doc.rect(x, rowY, colW, rowH, "FD");

      if (!celda) continue;

      doc.setFillColor(...NAVY);
      doc.rect(x, rowY, colW, 5, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(String(celda.dayNum), x + colW - 2, rowY + 3.6, {
        align: "right",
      });
      doc.setTextColor(0, 0, 0);

      const lines = (entradasByDay.get(celda.ymd) ?? []).map((e) => e.label);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(...SLATE);
      let ty = rowY + 7.5;
      const maxY = rowY + rowH - 1.5;
      for (const line of lines) {
        if (ty > maxY) {
          doc.text("…", x + 1.5, ty);
          break;
        }
        const wrapped = doc.splitTextToSize(line, colW - 3);
        for (const part of wrapped) {
          if (ty > maxY) break;
          doc.text(String(part), x + 1.5, ty);
          ty += 2.4;
        }
      }
      doc.setTextColor(0, 0, 0);
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text("Minerva · Calendario Producción", MARGIN, h - 4);
  doc.save(
    `calendario-produccion-${year}-${String(monthIndex + 1).padStart(2, "0")}.pdf`,
  );
}

export function exportCalendarioProduccionDiaPdf(params: {
  ymd: string;
  tituloDia: string;
  lineas: CalendarioProduccionLinea[];
}): void {
  const { ymd, tituloDia, lineas } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = pageW(doc);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 18, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Calendario Producción — Día", MARGIN, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(tituloDia, MARGIN, 14);
  doc.text(`Generado: ${fmtNowEs()}`, w - MARGIN, 14, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let y = 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${lineas.length} OT${lineas.length === 1 ? "" : "s"}`, MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (lineas.length === 0) {
    doc.setTextColor(...SLATE);
    doc.text("Sin OTs en este día.", MARGIN, y);
  } else {
    for (const l of lineas) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.text(l.otNumero, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const trabajo = l.trabajo?.trim() || "—";
      const wrapped = doc.splitTextToSize(trabajo, w - MARGIN * 2 - 28);
      doc.text(wrapped, MARGIN + 26, y);
      y += Math.max(6, wrapped.length * 4.5);
    }
  }

  doc.save(`calendario-produccion-${ymd}.pdf`);
}
