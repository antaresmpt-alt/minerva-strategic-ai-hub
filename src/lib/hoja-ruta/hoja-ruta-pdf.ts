import { jsPDF } from "jspdf";

import type {
  HojaRutaData,
  HojaRutaPaso,
  HojaRutaPausa,
} from "@/lib/hoja-ruta/hoja-ruta-query";
import {
  buildCamposVista,
  fmtDate,
  fmtDateShort,
  fmtCantidad,
  tipoMaquinaLabel,
} from "@/lib/hoja-ruta/hoja-ruta-formatters";

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const AMBER: [number, number, number] = [245, 158, 11];
const EMERALD: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [239, 68, 68];

const MARGIN = { left: 15, right: 15, top: 15, bottom: 15 };

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

function textLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Horas reales a mostrar: usa `horasReales` si es > 0; si no, las deriva de
 * la diferencia entre inicio y fin real. Devuelve null si no hay nada útil.
 */
function resolveHorasReales(ej: {
  horasReales: number | null;
  inicioRealAt: string | null;
  finRealAt: string | null;
}): string | null {
  if (ej.horasReales != null && ej.horasReales > 0) {
    return `${ej.horasReales} h`;
  }
  if (ej.inicioRealAt && ej.finRealAt) {
    const ini = new Date(ej.inicioRealAt).getTime();
    const fin = new Date(ej.finRealAt).getTime();
    if (Number.isFinite(ini) && Number.isFinite(fin) && fin > ini) {
      const horas = (fin - ini) / 3_600_000;
      const formatted = horas >= 1 ? horas.toFixed(2) : (horas * 60).toFixed(0);
      return horas >= 1 ? `${formatted} h` : `${formatted} min`;
    }
  }
  return null;
}

const ESTADO_COLOR: Record<string, [number, number, number]> = {
  pendiente: [203, 213, 225],
  disponible: [147, 197, 253],
  en_marcha: AMBER,
  pausado: [251, 146, 60],
  finalizado: EMERALD,
};

const ESTADO_FILL: Record<string, [number, number, number]> = {
  pendiente: [248, 250, 252],
  disponible: [239, 246, 255],
  en_marcha: [255, 251, 235],
  pausado: [255, 247, 237],
  finalizado: [236, 253, 245],
};

function drawHeader(doc: jsPDF, data: HojaRutaData): number {
  let y = MARGIN.top;
  const w = pageW(doc);
  const usable = w - MARGIN.left - MARGIN.right;

  // Banda NAVY
  doc.setFillColor(...NAVY);
  doc.rect(0, y, w, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("HOJA DE RUTA · PRODUCCIÓN", MARGIN.left, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`OT ${data.otNumero}`, MARGIN.left, y + 10);
  doc.text(`Generado: ${fmtNowEs()}`, w - MARGIN.right, y + 10, { align: "right" });
  y += 16;

  // Cabecera de datos
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN.left, y, usable, 20, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  const cliente = data.cliente ?? "—";
  const trabajo = data.trabajo ?? "—";
  const clienteTrabajo = `${cliente} · ${trabajo}`;
  const lines = textLines(doc, clienteTrabajo, usable - 6);
  doc.text(lines[0] ?? "", MARGIN.left + 3, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(`Cantidad: ${fmtCantidad(data.cantidad)}`, MARGIN.left + 3, y + 10);
  doc.text(`Entrega: ${fmtDateShort(data.fechaEntrega)}`, MARGIN.left + 60, y + 10);
  doc.text(`Estado: ${data.estadoOt ?? "—"}`, MARGIN.left + 120, y + 10);

  if (data.despacho) {
    doc.setFontSize(7);
    const d = data.despacho;
    let infoY = y + 15;
    const items: string[] = [];
    if (d.material) items.push(`Material: ${d.material}${d.gramaje ? ` ${d.gramaje}g` : ""}`);
    if (d.tamanoHoja) items.push(`Formato: ${d.tamanoHoja}`);
    if (d.tintas) items.push(`Tintas: ${d.tintas}`);
    if (d.troquel) items.push(`Troquel: ${d.troquel}${d.poses ? ` (${d.poses})` : ""}`);
    if (d.acabadoPral) items.push(`Acabado: ${d.acabadoPral}`);
    doc.text(items.join("  |  "), MARGIN.left + 3, infoY);
  }

  y += 22;
  doc.setTextColor(0, 0, 0);
  return y;
}

function drawRutaBadges(doc: jsPDF, pasos: HojaRutaPaso[], startY: number): number {
  let y = startY;
  const usable = pageW(doc) - MARGIN.left - MARGIN.right;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("ITINERARIO", MARGIN.left, y + 3);
  y += 5;

  let x = MARGIN.left;
  for (const p of pasos) {
    const label = `${p.orden} · ${p.procesoNombre ?? "—"}`;
    const w = doc.getTextWidth(label) + 6;
    if (x + w > MARGIN.left + usable && x > MARGIN.left) {
      x = MARGIN.left;
      y += 7;
    }
    const color = ESTADO_COLOR[p.estado] ?? ESTADO_COLOR.pendiente;
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.roundedRect(x, y, w, 5, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + 3, y + 3.5);
    x += w + 2;
  }
  y += 7;
  return y;
}

function drawProcesoCard(
  doc: jsPDF,
  paso: HojaRutaPaso,
  startY: number,
  maxY: number,
): number {
  let y = startY;
  const usable = pageW(doc) - MARGIN.left - MARGIN.right;
  const campos = buildCamposVista(paso.procesoId, paso.datosProceso);
  const fieldCols = 2;
  const contentX = MARGIN.left + 5;
  const contentW = usable - 8;
  const fieldColW = contentW / fieldCols;
  const fieldRows: { label: string; valor: string; lines: string[] }[][] = [];

  for (let i = 0; i < campos.length; i += fieldCols) {
    fieldRows.push(
      campos.slice(i, i + fieldCols).map((campo) => ({
        ...campo,
        lines: textLines(doc, `${campo.label}: ${campo.valor}`, fieldColW - 3),
      })),
    );
  }

  const sinDatos =
    fieldRows.length === 0 && !paso.ejecucion && !paso.externo;

  let contentH = 14;
  if (fieldRows.length > 0) {
    contentH += 4;
    for (const row of fieldRows) {
      const maxLines = Math.max(...row.map((c) => Math.max(1, c.lines.length)));
      contentH += maxLines * 3 + 1;
    }
    contentH += 1;
  }
  if (paso.ejecucion) {
    contentH += 12;
    if (paso.ejecucion.incidencia) contentH += 4;
    if (paso.ejecucion.accionCorrectiva) contentH += 4;
    if (paso.ejecucion.observaciones) contentH += 4;
  }
  if (paso.externo) contentH += 14;
  if (sinDatos) contentH += 4;

  const cardH = Math.max(24, contentH + 4);

  if (y + cardH > maxY) {
    doc.addPage();
    y = MARGIN.top;
  }

  const accent = ESTADO_COLOR[paso.estado] ?? ESTADO_COLOR.pendiente;
  const headerFill = ESTADO_FILL[paso.estado] ?? ESTADO_FILL.pendiente;
  const cardTop = y;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN.left, cardTop, usable, cardH, 1.5, 1.5, "FD");
  doc.setFillColor(...accent);
  doc.rect(MARGIN.left, cardTop, 2.5, cardH, "F");
  doc.setFillColor(...headerFill);
  doc.rect(MARGIN.left + 2.5, cardTop, usable - 2.5, 10.5, "F");

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(`${paso.orden} · ${paso.procesoNombre ?? "—"}`, contentX, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  const maquina = paso.maquinaNombre
    ? `${paso.maquinaNombre} · ${tipoMaquinaLabel(paso.tipoMaquina)}`
    : "Sin máquina";
  doc.text(maquina, contentX, y + 9);

  if (paso.esExterno) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(37, 99, 235);
    doc.text("EXTERNO", MARGIN.left + usable - 3, y + 5, { align: "right" });
  }

  // Datos del proceso
  y += 13;
  if (fieldRows.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text("Datos del proceso", contentX, y);
    y += 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    for (const row of fieldRows) {
      const rowY = y;
      let rowLines = 1;
      row.forEach((c, col) => {
        const xPos = contentX + col * fieldColW;
        const lines = c.lines.length > 0 ? c.lines : ["—"];
        rowLines = Math.max(rowLines, lines.length);
        doc.text(lines, xPos, rowY);
      });
      y += rowLines * 3 + 1;
    }
    y += 1;
  }

  const execText = (text: string, color: [number, number, number] = SLATE, bold = false) => {
    const lines = textLines(doc, text, contentW - 2);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...color);
    doc.text(lines, contentX, y);
    y += lines.length * 3 + 0.5;
  };

  // Ejecución
  if (paso.ejecucion) {
    const ej = paso.ejecucion;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text("Ejecución", contentX, y);
    y += 3;
    const horasTxt = resolveHorasReales(ej);
    execText(
      `Estado: ${ej.estado}${ej.maquinista ? ` · Maquinista: ${ej.maquinista}` : ""}${horasTxt ? ` · Horas: ${horasTxt}` : ""}${ej.numPausas > 0 ? ` · Pausas: ${ej.numPausas}` : ""}`,
    );
    execText(`Inicio: ${fmtDate(ej.inicioRealAt)} · Fin: ${fmtDate(ej.finRealAt)}`);

    if (ej.incidencia) {
      execText(`Incidencia: ${ej.incidencia}`, RED, true);
    }
    if (ej.accionCorrectiva) {
      execText(`Acción correctiva: ${ej.accionCorrectiva}`);
    }
    if (ej.observaciones) {
      execText(`Obs: ${ej.observaciones}`);
    }
  }

  // Externo
  if (paso.externo) {
    const ext = paso.externo;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text("Externo", contentX, y);
    y += 3;
    execText(
      `Estado: ${ext.estado ?? "—"}${ext.proveedorNombre ? ` · Proveedor: ${ext.proveedorNombre}` : ""}`,
    );
    execText(`Envío: ${fmtDate(ext.fechaEnvio)} · Previsto: ${fmtDate(ext.fechaPrevista)}`);
    if (ext.observaciones) {
      execText(`Obs: ${ext.observaciones}`);
    }
  }

  if (sinDatos) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text("Pendiente de ejecución", contentX, y);
    y += 4;
  }

  return cardTop + cardH + 3;
}

function drawPausasSection(
  doc: jsPDF,
  pasos: HojaRutaPaso[],
  startY: number,
  maxY: number,
): number {
  let y = startY;
  const usable = pageW(doc) - MARGIN.left - MARGIN.right;

  const todasPausas: { paso: HojaRutaPaso; pausa: HojaRutaPausa }[] = [];
  for (const paso of pasos) {
    if (paso.ejecucion && paso.ejecucion.pausas.length > 0) {
      for (const pausa of paso.ejecucion.pausas) {
        todasPausas.push({ paso, pausa });
      }
    }
  }

  if (todasPausas.length === 0) return y;

  if (y + 40 > maxY) {
    doc.addPage();
    y = MARGIN.top;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("PAUSAS E INCIDENCIAS", MARGIN.left, y + 3);
  y += 6;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN.left, y, usable, 6, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...NAVY);
  doc.text("Proceso", MARGIN.left + 2, y + 4);
  doc.text("Motivo", MARGIN.left + 40, y + 4);
  doc.text("Duración", MARGIN.left + 90, y + 4);
  doc.text("Pausa", MARGIN.left + 110, y + 4);
  doc.text("Reanud.", MARGIN.left + 140, y + 4);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...SLATE);
  for (const { paso, pausa } of todasPausas) {
    if (y + 5 > maxY) {
      doc.addPage();
      y = MARGIN.top;
    }
    const proceso = `${paso.orden} · ${paso.procesoNombre ?? "—"}`;
    const motivo = pausa.motivoLabel ?? "—";
    const duracion = pausa.minutosPausa != null ? `${pausa.minutosPausa} min` : "—";
    const pausedAt = pausa.pausedAt ? fmtDate(pausa.pausedAt) : "—";
    const resumedAt = pausa.resumedAt ? fmtDate(pausa.resumedAt) : "—";

    // Punto de color
    if (pausa.motivoColor) {
      const colorHex = pausa.motivoColor.replace("#", "");
      const r = parseInt(colorHex.slice(0, 2), 16);
      const g = parseInt(colorHex.slice(2, 4), 16);
      const b = parseInt(colorHex.slice(4, 6), 16);
      doc.setFillColor(r, g, b);
      doc.circle(MARGIN.left + 35, y - 1, 0.8, "F");
    }

    doc.text(proceso, MARGIN.left + 2, y);
    doc.text(motivo, MARGIN.left + 40, y);
    doc.text(duracion, MARGIN.left + 90, y);
    doc.text(pausedAt, MARGIN.left + 110, y);
    doc.text(resumedAt, MARGIN.left + 140, y);
    y += 4;

    if (pausa.observacionesPausa) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(5.5);
      doc.text(`Obs: ${pausa.observacionesPausa}`, MARGIN.left + 40, y);
      y += 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
    }
  }

  y += 4;
  return y;
}

function drawPvistoRealChart(
  doc: jsPDF,
  pasos: HojaRutaPaso[],
  startY: number,
  maxY: number,
): number {
  let y = startY;
  const usable = pageW(doc) - MARGIN.left - MARGIN.right;
  const n = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const rows: {
    label: string;
    previsto: number;
    real: number;
    merma: number;
  }[] = [];

  for (const paso of pasos) {
    const dp = paso.datosProceso;
    if (!dp) continue;
    const hojasBrutas = n(dp.hojas_brutas);
    const hojasNetas = n(dp.hojas_netas);
    const hojasTroquelar = n(dp.hojas_troquelar);
    const hojasImpresas = n(dp.hojas_impresas);
    const hojasTroqueladas = n(dp.hojas_troqueladas);
    const hojasMerma = n(dp.hojas_merma);

    const previsto = hojasTroquelar || hojasNetas || hojasBrutas;
    const real = hojasTroqueladas || hojasImpresas;
    if (previsto > 0 || real > 0) {
      rows.push({
        label: `${paso.orden} · ${paso.procesoNombre ?? "Proceso"}`,
        previsto,
        real,
        merma: hojasMerma,
      });
    }
  }

  const requiredH = 18 + Math.max(1, rows.length) * 12 + 12;
  if (y + requiredH > maxY) {
    doc.addPage();
    y = MARGIN.top;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("PREVISTO vs REAL POR PROCESO", MARGIN.left, y + 3);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...SLATE);
  doc.text("Azul = previsto · Verde = real · Rojo = merma real", MARGIN.left, y);
  y += 5;

  const barX = MARGIN.left + 45;
  const barW = usable - 86;
  const barH = 5;

  if (rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text("Sin datos de cantidades previsto/real para graficar.", MARGIN.left, y);
    y += 8;
  }

  for (const row of rows) {
    if (y + 11 > maxY) {
      doc.addPage();
      y = MARGIN.top;
    }
    const max = Math.max(row.previsto, row.real, 1);
    const prevW = (row.previsto / max) * barW;
    const realW = (row.real / max) * barW;
    const cumplimiento =
      row.previsto > 0 ? `${((row.real / row.previsto) * 100).toFixed(1)}%` : "—";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...NAVY);
    doc.text(textLines(doc, row.label, 40), MARGIN.left, y + 3);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(226, 232, 240);
    doc.rect(barX, y, barW, barH, "FD");
    doc.setFillColor(147, 197, 253);
    doc.rect(barX, y, prevW, barH / 2, "F");
    doc.setFillColor(...EMERALD);
    doc.rect(barX, y + barH / 2, realW, barH / 2, "F");

    if (row.merma > 0) {
      doc.setFillColor(...RED);
      doc.circle(barX + barW + 5, y + 2.5, 1.2, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Prev ${fmtCantidad(row.previsto)} · Real ${fmtCantidad(row.real)} · ${cumplimiento} · Merma ${fmtCantidad(row.merma)}`,
      barX,
      y + 8.5,
    );
    y += 12;
  }

  y += 2;

  // Nota de funciones en desarrollo
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.setTextColor(...SLATE);
  doc.text(
    "Recalcular presupuesto: Proximamente enlazado con FSC y cartelas de recepcion de material.",
    MARGIN.left,
    y,
  );
  y += 3.5;
  doc.text(
    "Ficha tecnica: Proximamente vinculado a la pestana de Fichas Tecnicas.",
    MARGIN.left,
    y,
  );
  y += 6;

  return y;
}

function drawFooter(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const y = pageH(doc) - 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text("Minerva Global — Hoja de Ruta", MARGIN.left, y);
    doc.text(`Página ${p}/${totalPages}`, pageW(doc) - MARGIN.right, y, { align: "right" });
  }
}

export function exportHojaRutaPdf(data: HojaRutaData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = drawHeader(doc, data);
  y = drawRutaBadges(doc, data.pasos, y);
  y += 3;

  const maxY = pageH(doc) - MARGIN.bottom - 10;

  // Tarjetas de procesos
  for (const paso of data.pasos) {
    y = drawProcesoCard(doc, paso, y, maxY);
  }

  y += 5;
  y = drawPausasSection(doc, data.pasos, y, maxY);
  y += 5;
  y = drawPvistoRealChart(doc, data.pasos, y, maxY);

  drawFooter(doc);

  const tag = data.otNumero.replace(/[^\w\-]/g, "_");
  doc.save(`hoja-ruta-${tag}.pdf`);
}
