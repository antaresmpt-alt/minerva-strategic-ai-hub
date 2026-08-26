import { jsPDF } from "jspdf";

import type { CalendarioProduccionLinea } from "@/lib/calendario-produccion";
import { CALENDARIO_AMBITO_LETRA } from "@/lib/calendario-produccion-ambito";
import type { ProdCalendarioProduccionNotaRow } from "@/types/prod-calendario-produccion-nota";
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

function otPdfLabel(l: CalendarioProduccionLinea): string {
  const letra = l.ambito ? CALENDARIO_AMBITO_LETRA[l.ambito] : "";
  const base = letra ? `${letra}·${l.otNumero}` : l.otNumero;
  const hecha = Boolean(l.hechoVisual ?? l.marcadoHecho);
  return hecha ? `✓ ${base}` : base;
}

function lineaHechaPdf(l: CalendarioProduccionLinea): boolean {
  return Boolean(l.hechoVisual ?? l.marcadoHecho);
}

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

function notaPreview(n: ProdCalendarioProduccionNotaRow): string {
  return `📝 ${String(n.texto ?? "").trim()}`;
}

/** Escala tipografía/interlineado para que quepan N ítems en altura disponible (sin «…»). */
function fitLineMetrics(itemCount: number, usableH: number): {
  lineH: number;
  otSize: number;
  trabajoSize: number;
  startPad: number;
} {
  const n = Math.max(1, itemCount);
  const startPad = 1.2;
  const raw = (usableH - startPad) / n;
  const lineH = Math.min(2.6, Math.max(1.55, raw));
  const otSize = Math.min(6.5, Math.max(3.8, lineH * 2.2));
  const trabajoSize = Math.min(5.5, Math.max(3.2, lineH * 1.9));
  return { lineH, otSize, trabajoSize, startPad };
}

export function exportCalendarioProduccionMensualPdf(params: {
  year: number;
  monthIndex: number;
  semanas: CalendarioSemanaLaboral[];
  entradasByDay: Map<string, CalendarioProduccionLinea[]>;
  notasByDay: Map<string, ProdCalendarioProduccionNotaRow[]>;
  includeSaturday?: boolean;
  filtroTexto?: string;
}): void {
  const {
    year,
    monthIndex,
    semanas,
    entradasByDay,
    notasByDay,
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
  const dayHeaderH = 5;
  const bodyUsableH = Math.max(4, rowH - dayHeaderH - 1.5);

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
      doc.rect(x, rowY, colW, dayHeaderH, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(String(celda.dayNum), x + colW - 2, rowY + 3.6, {
        align: "right",
      });
      doc.setTextColor(0, 0, 0);

      const lines = entradasByDay.get(celda.ymd) ?? [];
      const notas = notasByDay.get(celda.ymd) ?? [];
      const items = [...notas.map(notaPreview), ...lines];
      const { lineH, otSize, trabajoSize, startPad } = fitLineMetrics(
        items.length,
        bodyUsableH,
      );
      let ty = rowY + dayHeaderH + startPad;

      for (const item of items) {
        if (typeof item === "string") {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120, 53, 15);
          doc.setFontSize(Math.max(3.2, trabajoSize));
          const wrapped = doc.splitTextToSize(item, colW - 3);
          doc.text(String(wrapped[0] ?? item), x + 1.5, ty + lineH * 0.75);
          ty += lineH;
          continue;
        }
        const l = item;
        const otLabel = otPdfLabel(l);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        doc.setFontSize(otSize);
        if (lineaHechaPdf(l)) doc.setTextColor(100, 116, 139);
        doc.text(otLabel, x + 1.5, ty + lineH * 0.75);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...SLATE);
        doc.setFontSize(trabajoSize);
        const otW = Math.min(22, Math.max(12, colW * 0.32));
        const trabajo = (l.trabajo?.trim() || "—").slice(0, 100);
        const rest = doc.splitTextToSize(trabajo, colW - otW - 2);
        doc.text(String(rest[0] ?? ""), x + otW, ty + lineH * 0.75);
        ty += lineH;
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
  notas: ProdCalendarioProduccionNotaRow[];
}): void {
  const { ymd, tituloDia, lineas, notas } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = pageW(doc);
  const h = pageH(doc);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, HEADER_H, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Calendario Producción — Día", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(tituloDia, MARGIN, 15);
  doc.text(`Generado: ${fmtNowEs()}`, w - MARGIN, 15, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let y = HEADER_H + 6;
  for (const n of notas) {
    if (y > h - 14) {
      doc.addPage();
      y = 16;
    }
    doc.setTextColor(...SLATE);
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(notaPreview(n), w - MARGIN * 2 - 8);
    doc.text(wrapped, MARGIN + 8, y);
    y += Math.max(6, wrapped.length * 4.5);
  }
  for (const l of lineas) {
    if (y > h - 14) {
      doc.addPage();
      y = 16;
    }
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(otPdfLabel(l), MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const wrapped = doc.splitTextToSize(l.trabajo?.trim() || "—", w - MARGIN * 2 - 26);
    doc.text(wrapped, MARGIN + 26, y);
    y += Math.max(6, wrapped.length * 4.5);
  }

  doc.save(`calendario-produccion-dia-${ymd}.pdf`);
}

/** PDF de una semana laboral (Lun–Vie o +Sáb), 1 OT por línea. Sin truncar con «…». */
export function exportCalendarioProduccionSemanaPdf(params: {
  weekMonday: Date;
  semana: Array<{ ymd: string; dayNum: number } | null>;
  entradasByDay: Map<string, CalendarioProduccionLinea[]>;
  notasByDay: Map<string, ProdCalendarioProduccionNotaRow[]>;
  includeSaturday?: boolean;
  filtroTexto?: string;
  tituloSemana: string;
}): void {
  const {
    weekMonday,
    semana,
    entradasByDay,
    notasByDay,
    includeSaturday = false,
    filtroTexto = "",
    tituloSemana,
  } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = pageW(doc);
  const h = pageH(doc);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, HEADER_H, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Calendario Producción — Semana", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(tituloSemana, MARGIN, 15);
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
    const celda = semana[i];
    const label = celda ? `${d} ${celda.dayNum}` : d;
    doc.text(label, MARGIN + i * colW + colW / 2, y + 4.2, {
      align: "center",
    });
  });
  doc.setTextColor(0, 0, 0);
  y += COL_HEADER_H;

  const footerReserve = 10;
  const bodyH = h - y - footerReserve;

  let maxItems = 1;
  for (let c = 0; c < dias.length; c++) {
    const celda = semana[c];
    if (!celda) continue;
    const n =
      (entradasByDay.get(celda.ymd) ?? []).length +
      (notasByDay.get(celda.ymd) ?? []).length;
    if (n > maxItems) maxItems = n;
  }
  const { lineH, otSize, trabajoSize, startPad } = fitLineMetrics(
    maxItems,
    bodyH - 2,
  );

  for (let c = 0; c < dias.length; c++) {
    const celda = semana[c];
    const x = MARGIN + c * colW;
    doc.setDrawColor(...BORDER);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, colW, bodyH, "FD");

    if (!celda) continue;

    const lines = entradasByDay.get(celda.ymd) ?? [];
    const notas = notasByDay.get(celda.ymd) ?? [];
    let ty = y + startPad;

    for (const n of notas) {
      doc.setTextColor(120, 53, 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(trabajoSize);
      const wrapped = doc.splitTextToSize(notaPreview(n), colW - 3);
      doc.text(String(wrapped[0] ?? "—"), x + 1.5, ty + lineH * 0.75);
      ty += lineH;
    }
    for (const l of lines) {
      doc.setTextColor(...NAVY);
      if (lineaHechaPdf(l)) doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(otSize);
      const otW = Math.min(18, colW * 0.28);
      doc.text(otPdfLabel(l), x + 1.5, ty + lineH * 0.75);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...SLATE);
      doc.setFontSize(trabajoSize);
      const trabajo = (l.trabajo?.trim() || "—").slice(0, 80);
      const wrapped = doc.splitTextToSize(trabajo, colW - otW - 3);
      doc.text(String(wrapped[0] ?? "—"), x + otW, ty + lineH * 0.75);
      ty += lineH;
    }
    if (lines.length === 0 && notas.length === 0) {
      doc.setTextColor(...SLATE);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text("—", x + colW / 2, y + 8, { align: "center" });
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text("Minerva · Calendario Producción", MARGIN, h - 4);

  const ymd = `${weekMonday.getFullYear()}-${String(weekMonday.getMonth() + 1).padStart(2, "0")}-${String(weekMonday.getDate()).padStart(2, "0")}`;
  doc.save(`calendario-produccion-semana-${ymd}.pdf`);
}

export type CalendarioListadoDia = {
  ymd: string;
  titulo: string;
};

/**
 * PDF listado vertical por día (legible en papel).
 * Omite días sin OTs. Portrait A4.
 */
export function exportCalendarioProduccionListadoPdf(params: {
  titulo: string;
  subtitulo: string;
  dias: CalendarioListadoDia[];
  entradasByDay: Map<string, CalendarioProduccionLinea[]>;
  notasByDay: Map<string, ProdCalendarioProduccionNotaRow[]>;
  filtroTexto?: string;
  filenameStem: string;
}): void {
  const {
    titulo,
    subtitulo,
    dias,
    entradasByDay,
    notasByDay,
    filtroTexto = "",
    filenameStem,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = pageW(doc);
  const h = pageH(doc);
  const usable = w - MARGIN * 2;

  const drawHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, w, 18, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(titulo, MARGIN, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitulo, MARGIN, 14);
    const filtroLabel = filtroTexto.trim()
      ? `Filtro: ${filtroTexto.trim()}`
      : "Sin filtro";
    doc.text(filtroLabel, w - MARGIN, 8, { align: "right" });
    doc.text(`Generado: ${fmtNowEs()}`, w - MARGIN, 14, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  drawHeader();
  let y = 26;

  const diasConContenido = dias.filter(
    (d) =>
      (entradasByDay.get(d.ymd) ?? []).length > 0 ||
      (notasByDay.get(d.ymd) ?? []).length > 0,
  );

  if (diasConContenido.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text("Sin OTs ni notas en el periodo.", MARGIN, y);
    doc.save(`${filenameStem}-listado.pdf`);
    return;
  }

  for (const dia of diasConContenido) {
    const lineas = entradasByDay.get(dia.ymd) ?? [];
    const notas = notasByDay.get(dia.ymd) ?? [];
    const blockH = 8 + (lineas.length + notas.length) * 6.5 + 4;
    if (y + Math.min(blockH, 20) > h - 12) {
      doc.addPage();
      drawHeader();
      y = 26;
    }

    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN, y - 4, usable, 7, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `${dia.titulo}  ·  ${lineas.length} OT${lineas.length === 1 ? "" : "s"} · ${notas.length} nota${notas.length === 1 ? "" : "s"}`,
      MARGIN + 2.5,
      y,
    );
    doc.setTextColor(0, 0, 0);
    y += 7;

    for (const n of notas) {
      if (y > h - 14) {
        doc.addPage();
        drawHeader();
        y = 26;
      }
      doc.setDrawColor(253, 230, 138);
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(MARGIN, y - 3.5, usable, 6, 0.8, 0.8, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 53, 15);
      const wrapped = doc.splitTextToSize(notaPreview(n), usable - 4);
      doc.text(String(wrapped[0] ?? "—"), MARGIN + 2, y);
      y += 6.5;
    }

    for (const l of lineas) {
      if (y > h - 14) {
        doc.addPage();
        drawHeader();
        y = 26;
      }
      doc.setDrawColor(...BORDER);
      doc.setFillColor(
        lineaHechaPdf(l) ? 241 : 248,
        lineaHechaPdf(l) ? 245 : 250,
        lineaHechaPdf(l) ? 249 : 252,
      );
      doc.roundedRect(MARGIN, y - 3.5, usable, 6, 0.8, 0.8, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      if (lineaHechaPdf(l)) doc.setTextColor(100, 116, 139);
      doc.text(otPdfLabel(l), MARGIN + 2, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const trabajo = l.trabajo?.trim() || "—";
      const wrapped = doc.splitTextToSize(trabajo, usable - 28);
      doc.text(String(wrapped[0] ?? "—"), MARGIN + 24, y);
      y += 6.5;
    }
    y += 3;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text("Minerva · Calendario Producción · Listado por día", MARGIN, h - 5);
  doc.save(`${filenameStem}-listado.pdf`);
}
