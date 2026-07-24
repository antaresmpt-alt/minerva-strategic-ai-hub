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
  return letra ? `${letra}·${l.otNumero}` : l.otNumero;
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
      const notas = (notasByDay.get(celda.ymd) ?? []).map(notaPreview);
      const items = [...notas, ...lines];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...SLATE);
      let ty = rowY + 7.5;
      const maxY = rowY + rowH - 1.5;
      for (const line of items) {
        if (ty > maxY) {
          doc.text("…", x + 1.5, ty);
          break;
        }
        // OT en negrita + trabajo truncado (más legible que label único)
        const isNota = line.startsWith("📝 ");
        const otMatch = isNota ? null : /^(\S+)\s*[·-]\s*(.*)$/.exec(line);
        if (otMatch) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...NAVY);
          doc.setFontSize(6.5);
          doc.text(otMatch[1]!, x + 1.5, ty);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...SLATE);
          doc.setFontSize(5.5);
          const rest = doc.splitTextToSize(otMatch[2] || "—", colW - 16);
          doc.text(String(rest[0] ?? ""), x + 14, ty);
        } else {
          if (isNota) {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(120, 53, 15);
            doc.setFontSize(5.8);
            const wrapped = doc.splitTextToSize(line, colW - 3);
            doc.text(String(wrapped[0] ?? line), x + 1.5, ty);
            ty += 2.8;
            continue;
          }
          const wrapped = doc.splitTextToSize(line, colW - 3);
          doc.text(String(wrapped[0] ?? line), x + 1.5, ty);
        }
        ty += 2.6;
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
  doc.text(
    `${lineas.length} OT${lineas.length === 1 ? "" : "s"} · ${notas.length} nota${notas.length === 1 ? "" : "s"}`,
    MARGIN,
    y,
  );
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (lineas.length === 0 && notas.length === 0) {
    doc.setTextColor(...SLATE);
    doc.text("Sin OTs ni notas en este día.", MARGIN, y);
  } else {
    for (const n of notas) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(120, 53, 15);
      doc.setFont("helvetica", "bold");
      doc.text("📝", MARGIN, y);
      doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(
        String(n.texto ?? "").trim() || "—",
        w - MARGIN * 2 - 10,
      );
      doc.text(wrapped, MARGIN + 8, y);
      y += Math.max(6, wrapped.length * 4.5);
    }
    for (const l of lineas) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.text(otPdfLabel(l), MARGIN, y);

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

/** PDF de una semana laboral (Lun–Vie o +Sáb), 1 OT por línea. */
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
  const maxLinesPerCol = Math.max(8, Math.floor((bodyH - 4) / 4.2));

  for (let c = 0; c < dias.length; c++) {
    const celda = semana[c];
    const x = MARGIN + c * colW;
    doc.setDrawColor(...BORDER);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, colW, bodyH, "FD");

    if (!celda) continue;

    const lines = entradasByDay.get(celda.ymd) ?? [];
    const notas = notasByDay.get(celda.ymd) ?? [];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    let ty = y + 4;
    let shown = 0;
    const total = notas.length + lines.length;
    for (const n of notas) {
      if (shown >= maxLinesPerCol - 1 && total > maxLinesPerCol) {
        doc.setTextColor(...SLATE);
        doc.text(`… +${total - shown} más`, x + 1.5, ty);
        break;
      }
      doc.setTextColor(120, 53, 15);
      doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(notaPreview(n), colW - 3);
      doc.text(String(wrapped[0] ?? "—"), x + 1.5, ty);
      ty += 4.2;
      shown += 1;
      if (ty > y + bodyH - 3) break;
    }
    for (const l of lines) {
      if (shown >= maxLinesPerCol - 1 && total > maxLinesPerCol) {
        doc.setTextColor(...SLATE);
        doc.text(`… +${total - shown} más`, x + 1.5, ty);
        break;
      }
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      const otW = Math.min(18, colW * 0.28);
      doc.text(otPdfLabel(l), x + 1.5, ty);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...SLATE);
      const trabajo = (l.trabajo?.trim() || "—").slice(0, 80);
      const wrapped = doc.splitTextToSize(trabajo, colW - otW - 3);
      doc.text(String(wrapped[0] ?? "—"), x + otW, ty);
      ty += 4.2;
      shown += 1;
      if (ty > y + bodyH - 3) break;
    }
    if (total === 0) {
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
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(MARGIN, y - 3.5, usable, 6, 0.8, 0.8, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
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
