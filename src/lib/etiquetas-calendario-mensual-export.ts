import { jsPDF } from "jspdf";

import {
  labelFiltrosCalendario,
  type CalendarioFiltros,
  type CalendarioResumenMes,
} from "@/lib/etiquetas-calendario-filters";
import { formatEtiquetasKpi } from "@/lib/etiquetas-hoja-ruta-kpis";
import type {
  CalendarioEventoAuto,
  CalendarioSemanaLaboral,
} from "@/lib/etiquetas-calendario-mensual";
import {
  diasLaborablesCabecera,
  mesAnioLabel,
} from "@/lib/etiquetas-calendario-mensual";
import type { ProdCalendarioFestivoRow } from "@/types/prod-calendario-festivo";
import type { ProdEtiquetasCalendarioApunteRow } from "@/types/prod-etiquetas-calendario-apunte";

const NAVY: [number, number, number] = [0, 33, 71];
const WHITE: [number, number, number] = [255, 255, 255];
const SLATE: [number, number, number] = [71, 85, 105];
const BORDER: [number, number, number] = [203, 213, 225];
const FESTIVO_BG: [number, number, number] = [226, 232, 240];
const FESTIVO_HEADER: [number, number, number] = [100, 116, 139];

const MARGIN = 8;
const HEADER_H = 22;
const COL_HEADER_H = 6;
const FOOTER_H = 14;
const TWO_COL_MIN_LINES = 4;

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

function lineasDia(
  eventos: CalendarioEventoAuto[],
  apuntes: ProdEtiquetasCalendarioApunteRow[],
  festivoNombres: string[]
): string[] {
  const out: string[] = [];
  for (const n of festivoNombres) out.push(`[Festivo] ${n}`);
  for (const ev of eventos) out.push(ev.label);
  for (const a of apuntes) {
    const t = String(a.texto ?? "").trim();
    if (t) out.push(t);
  }
  return out;
}

function drawMonthHeader(
  doc: jsPDF,
  year: number,
  monthIndex: number,
  filtros: CalendarioFiltros
): number {
  const w = pageW(doc);
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, HEADER_H, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Calendario mensual — Etiquetas digital", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(mesAnioLabel(year, monthIndex), MARGIN, 15);
  doc.text(`Filtros: ${labelFiltrosCalendario(filtros)}`, MARGIN, 19);
  doc.text(`Generado: ${fmtNowEs()}`, w - MARGIN, 15, {
    align: "right",
  });
  doc.setTextColor(0, 0, 0);
  return HEADER_H + 2;
}

function drawColHeaders(
  doc: jsPDF,
  startY: number,
  includeSaturday: boolean
): number {
  const dias = diasLaborablesCabecera(includeSaturday);
  const w = pageW(doc);
  const usable = w - MARGIN * 2;
  const colW = usable / dias.length;
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, startY, usable, COL_HEADER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  dias.forEach((d, i) => {
    const x = MARGIN + i * colW + colW / 2;
    doc.text(d, x, startY + 4.2, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  return startY + COL_HEADER_H;
}

function drawDayCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  dayNum: number | null,
  eventos: CalendarioEventoAuto[],
  apuntes: ProdEtiquetasCalendarioApunteRow[],
  festivos: ProdCalendarioFestivoRow[]
): void {
  if (dayNum == null) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.rect(x, y, w, h);
    doc.setFillColor(248, 250, 252);
    doc.rect(x, y, w, h, "F");
    return;
  }

  const esFestivo = festivos.length > 0;
  const headerH = 5.5;
  const padX = 1.5;
  const padBottom = 1.2;
  const padTopContent = 3.2;

  if (esFestivo) {
    doc.setFillColor(...FESTIVO_HEADER);
  } else {
    doc.setFillColor(...NAVY);
  }
  doc.rect(x, y, w, headerH, "F");

  const bodyY = y + headerH;
  const bodyH = h - headerH;
  if (esFestivo) {
    doc.setFillColor(...FESTIVO_BG);
  } else {
    doc.setFillColor(255, 255, 255);
  }
  doc.rect(x, bodyY, w, bodyH, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(String(dayNum), x + w - 1.5, y + 4, { align: "right" });

  const lines = lineasDia(
    eventos,
    apuntes,
    festivos.map((f) => f.nombre)
  );
  const innerX = x + padX;
  const innerW = w - padX * 2;
  const innerH = bodyH - padTopContent - padBottom;
  const fontSize = 6.5;
  const lineH = 3.1;

  doc.setFontSize(fontSize);

  const renderColumn = (items: string[], colX: number, colW: number) => {
    let cy = bodyY + padTopContent;
    for (const line of items) {
      if (cy > bodyY + padTopContent + innerH - lineH) break;
      const isOt = /^[ITN]-/.test(line);
      const isFest = line.startsWith("[Festivo]");
      doc.setFont("helvetica", isOt || isFest ? "bold" : "normal");
      if (isOt && line.startsWith("I-")) {
        doc.setTextColor(...NAVY);
      } else if (isFest) {
        doc.setTextColor(...FESTIVO_HEADER);
      } else {
        doc.setTextColor(51, 65, 85);
      }
      const wrapped = doc.splitTextToSize(line, colW) as string[];
      for (const wl of wrapped) {
        if (cy > bodyY + padTopContent + innerH - lineH) break;
        doc.text(wl, colX, cy);
        cy += lineH;
      }
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  };

  if (lines.length >= TWO_COL_MIN_LINES) {
    const mid = Math.ceil(lines.length / 2);
    const gap = 1;
    const colW = (innerW - gap) / 2;
    renderColumn(lines.slice(0, mid), innerX, colW);
    renderColumn(lines.slice(mid), innerX + colW + gap, colW);
  } else {
    renderColumn(lines, innerX, innerW);
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.15);
  doc.rect(x, y, w, h);
}

function drawResumenFooter(
  doc: jsPDF,
  y: number,
  resumen: CalendarioResumenMes
): void {
  const w = pageW(doc);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  const diaMax =
    resumen.diaMaxYmd && resumen.diaMaxTotal > 0
      ? ` · Día más cargado: ${resumen.diaMaxYmd.slice(8, 10)}/${resumen.diaMaxYmd.slice(5, 7)} (${resumen.diaMaxTotal})`
      : "";
  doc.text(
    `Resumen: I=${resumen.totalI} T=${resumen.totalT} N=${resumen.totalN} · Etiquetas OTs=${formatEtiquetasKpi(resumen.totalEtiquetas)} · Apuntes=${resumen.totalApuntes} · Días con actividad=${resumen.diasConActividad} · Festivos=${resumen.festivosEnMes}${diaMax}`,
    MARGIN,
    y
  );
  doc.text("Minerva Global — Etiquetas digital", w - MARGIN, y, {
    align: "right",
  });
}

export function exportEtiquetasCalendarioMensualPdf(params: {
  year: number;
  monthIndex: number;
  includeSaturday: boolean;
  semanas: CalendarioSemanaLaboral[];
  eventosMap: Map<string, CalendarioEventoAuto[]>;
  apuntesMap: Map<string, ProdEtiquetasCalendarioApunteRow[]>;
  festivosMap: Map<string, ProdCalendarioFestivoRow[]>;
  filtros: CalendarioFiltros;
  resumen: CalendarioResumenMes;
}): void {
  const {
    year,
    monthIndex,
    includeSaturday,
    semanas,
    eventosMap,
    apuntesMap,
    festivosMap,
    filtros,
    resumen,
  } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const dias = diasLaborablesCabecera(includeSaturday);

  let gridTop = drawMonthHeader(doc, year, monthIndex, filtros);
  gridTop = drawColHeaders(doc, gridTop, includeSaturday);

  const w = pageW(doc);
  const h = pageH(doc);
  const usableW = w - MARGIN * 2;
  const colW = usableW / dias.length;
  const gridBottom = h - FOOTER_H;
  const availableH = gridBottom - gridTop;
  const rowH = semanas.length > 0 ? availableH / semanas.length : availableH;

  semanas.forEach((semana, wi) => {
    const y = gridTop + wi * rowH;
    semana.forEach((dia, di) => {
      const x = MARGIN + di * colW;
      if (dia) {
        drawDayCell(
          doc,
          x,
          y,
          colW,
          rowH,
          dia.dayNum,
          eventosMap.get(dia.ymd) ?? [],
          apuntesMap.get(dia.ymd) ?? [],
          festivosMap.get(dia.ymd) ?? []
        );
      } else {
        drawDayCell(doc, x, y, colW, rowH, null, [], [], []);
      }
    });
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(
    "I/T/N desde hoja de ruta · Apuntes del calendario · Festivos según capas activas",
    MARGIN,
    h - 8
  );
  drawResumenFooter(doc, h - 4, resumen);

  const tag = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  doc.save(`etiquetas-calendario-${tag}.pdf`);
}
