import { jsPDF } from "jspdf";

import { fmtDateShort } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type { HojaRutaData } from "@/lib/hoja-ruta/hoja-ruta-query";

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

/** DIN A5 vertical (mm). */
const PAGE_H = 210;
const MARGIN = { left: 10, right: 10, top: 8, bottom: 8 };
const ROW_H = 8;
const CHECK_SIZE = 3.5;
const BANNER_TITLE = "HOJA DE RUTA SIMPLIFICADA";

export type HojaRutaCartelitaPaso = {
  orden: number;
  nombre: string;
};

export type HojaRutaCartelitaInput = {
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  cantidad: string | null;
  fechaEntrega: string | null;
  material?: string | null;
  tamanoHoja?: string | null;
  tintas?: string | null;
  troquel?: string | null;
  pasos: HojaRutaCartelitaPaso[];
};

function fmtNowEs(): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

function truncate(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function drawEmptyCheckbox(doc: jsPDF, x: number, y: number): void {
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.3);
  doc.rect(x, y - CHECK_SIZE + 0.6, CHECK_SIZE, CHECK_SIZE);
}

function renderCartelita(doc: jsPDF, data: HojaRutaCartelitaInput): void {
  const w = pageWidth(doc);
  const usable = w - MARGIN.left - MARGIN.right;
  let y = MARGIN.top;

  doc.setFillColor(...NAVY);
  doc.rect(0, y, w, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(BANNER_TITLE, MARGIN.left, y + 4.5);
  doc.setFontSize(14);
  doc.text(`OT ${data.otNumero}`, w - MARGIN.right, y + 8, { align: "right" });
  y += 14;

  const metaBoxH = 18;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN.left, y, usable, metaBoxH, 1.2, 1.2, "FD");

  const cliente = (data.cliente ?? "—").trim();
  const trabajo = (data.trabajo ?? "—").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(
    truncate(doc, `${cliente} · ${trabajo}`, usable - 4),
    MARGIN.left + 2,
    y + 5,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  const cantidad = (data.cantidad ?? "—").trim() || "—";
  const entrega = fmtDateShort(data.fechaEntrega);
  doc.text(`Cantidad: ${cantidad}`, MARGIN.left + 2, y + 9.5);
  doc.text(`Entrega: ${entrega}`, MARGIN.left + 38, y + 9.5);

  const tech: string[] = [];
  if (data.material?.trim()) tech.push(data.material.trim());
  if (data.tamanoHoja?.trim()) tech.push(data.tamanoHoja.trim());
  if (data.tintas?.trim()) tech.push(`Tintas: ${data.tintas.trim()}`);
  if (data.troquel?.trim()) tech.push(`Troquel: ${data.troquel.trim()}`);
  if (tech.length > 0) {
    doc.text(truncate(doc, tech.join("  ·  "), usable - 4), MARGIN.left + 2, y + 14);
  }

  y += metaBoxH + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("ITINERARIO — firma al pasar por cada proceso", MARGIN.left, y + 2);
  y += 6;

  const labelMaxW = usable * 0.42;
  const checkX = MARGIN.left + labelMaxW + 3;
  const lineX = checkX + CHECK_SIZE + 3;
  const lineEndX = w - MARGIN.right;

  for (const paso of data.pasos) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    const label = `${paso.orden} · ${paso.nombre}`;
    doc.text(truncate(doc, label, labelMaxW), MARGIN.left, y + 2);

    drawEmptyCheckbox(doc, checkX, y + 2);

    doc.setDrawColor(...SLATE);
    doc.setLineWidth(0.25);
    const lineY = y + 1.8;
    if (lineEndX > lineX + 8) {
      doc.line(lineX, lineY, lineEndX, lineY);
    }

    y += ROW_H;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `Minerva Global · ${BANNER_TITLE} · ${fmtNowEs()}`,
    MARGIN.left,
    PAGE_H - MARGIN.bottom + 2,
  );
}

function createCartelitaDoc(data: HojaRutaCartelitaInput): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });
  renderCartelita(doc, data);
  return doc;
}

export function cartelitaInputFromHojaRuta(data: HojaRutaData): HojaRutaCartelitaInput {
  return {
    otNumero: data.otNumero,
    cliente: data.cliente,
    trabajo: data.trabajo,
    cantidad: data.cantidad != null ? String(data.cantidad) : null,
    fechaEntrega: data.fechaEntrega,
    material: data.despacho?.material ?? null,
    tamanoHoja: data.despacho?.tamanoHoja ?? null,
    tintas: data.despacho?.tintas ?? null,
    troquel: data.despacho?.troquel ?? null,
    pasos: data.pasos.map((p) => ({
      orden: p.orden,
      nombre: p.procesoNombre ?? "—",
    })),
  };
}

/** Descarga PDF A5 vertical — hoja de ruta simplificada. */
export function exportHojaRutaCartelitaPdf(data: HojaRutaCartelitaInput): void {
  const doc = createCartelitaDoc(data);
  const tag = data.otNumero.replace(/[^\w\-]/g, "_");
  doc.save(`hoja-ruta-simplificada-${tag}.pdf`);
}

/** Abre diálogo de impresión del navegador. */
export function printHojaRutaCartelitaPdf(data: HojaRutaCartelitaInput): void {
  const doc = createCartelitaDoc(data);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  const w = window.open(blobUrl, "_blank");
  if (!w) {
    exportHojaRutaCartelitaPdf(data);
  }
}
