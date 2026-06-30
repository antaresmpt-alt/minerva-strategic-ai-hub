import { jsPDF } from "jspdf";

import { fmtDateShort } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type { HojaRutaData } from "@/lib/hoja-ruta/hoja-ruta-query";

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

/** Ancho A4 (mm). Alto mínimo ≈ 1/3 de A4 vertical. */
const PAGE_W = 210;
const MIN_PAGE_H = 99;
const MARGIN = { left: 8, right: 8, top: 6, bottom: 6 };
const ROW_H = 7.2;
const CHECK_SIZE = 3.2;

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
  doc.setLineWidth(0.25);
  doc.rect(x, y - CHECK_SIZE + 0.5, CHECK_SIZE, CHECK_SIZE);
}

function computePageHeight(pasoCount: number): number {
  const header = 36;
  const rows = pasoCount * ROW_H;
  const footer = 4;
  return Math.max(MIN_PAGE_H, MARGIN.top + header + rows + footer + MARGIN.bottom);
}

function renderCartelita(doc: jsPDF, data: HojaRutaCartelitaInput): void {
  const usable = PAGE_W - MARGIN.left - MARGIN.right;
  let y = MARGIN.top;

  doc.setFillColor(...NAVY);
  doc.rect(0, y, PAGE_W, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("HOJA VIAJERA · PRODUCCIÓN", MARGIN.left, y + 4.2);
  doc.setFontSize(16);
  doc.text(`OT ${data.otNumero}`, PAGE_W - MARGIN.right, y + 7.5, {
    align: "right",
  });
  y += 13;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN.left, y, usable, 14, 1.2, 1.2, "FD");

  const cliente = (data.cliente ?? "—").trim();
  const trabajo = (data.trabajo ?? "—").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(truncate(doc, `${cliente} · ${trabajo}`, usable - 6), MARGIN.left + 2.5, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  const cantidad = (data.cantidad ?? "—").trim() || "—";
  const entrega = fmtDateShort(data.fechaEntrega);
  doc.text(`Cantidad: ${cantidad}`, MARGIN.left + 2.5, y + 9);
  doc.text(`Entrega: ${entrega}`, MARGIN.left + 42, y + 9);
  doc.text(`Despacho: ${fmtNowEs()}`, PAGE_W - MARGIN.right - 2.5, y + 9, {
    align: "right",
  });

  const tech: string[] = [];
  if (data.material?.trim()) tech.push(data.material.trim());
  if (data.tamanoHoja?.trim()) tech.push(data.tamanoHoja.trim());
  if (data.tintas?.trim()) tech.push(`Tintas: ${data.tintas.trim()}`);
  if (data.troquel?.trim()) tech.push(`Troquel: ${data.troquel.trim()}`);
  if (tech.length > 0) {
    doc.setFontSize(7);
    doc.text(truncate(doc, tech.join("  ·  "), usable - 6), MARGIN.left + 2.5, y + 12.5);
  }

  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("ITINERARIO — firma al pasar por cada proceso", MARGIN.left, y + 2);
  y += 5;

  const labelW = usable * 0.38;
  const checkX = MARGIN.left + labelW + 2;
  const lineX = checkX + CHECK_SIZE + 2.5;
  const lineW = PAGE_W - MARGIN.right - lineX;

  for (const paso of data.pasos) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    const label = `${paso.orden} · ${paso.nombre}`;
    doc.text(truncate(doc, label, labelW), MARGIN.left, y + 1.5);

    drawEmptyCheckbox(doc, checkX, y + 1.5);

    doc.setDrawColor(...SLATE);
    doc.setLineWidth(0.2);
    const lineY = y + 1.2;
    doc.line(lineX, lineY, lineX + lineW, lineY);

    y += ROW_H;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...SLATE);
  doc.text(
    "Minerva Global · Cartelita de acompañamiento entre departamentos",
    MARGIN.left,
    doc.internal.pageSize.getHeight() - 3,
  );
}

function createCartelitaDoc(data: HojaRutaCartelitaInput): jsPDF {
  const h = computePageHeight(data.pasos.length);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PAGE_W, h],
  });
  renderCartelita(doc, data);
  return doc;
}

export function cartelitaInputFromHojaRuta(data: HojaRutaData): HojaRutaCartelitaInput {
  return {
    otNumero: data.otNumero,
    cliente: data.cliente,
    trabajo: data.trabajo,
    cantidad:
      data.cantidad != null ? String(data.cantidad) : null,
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

/** Descarga PDF cartelita (ancho A4, alto ~1/3 o más si hay muchos pasos). */
export function exportHojaRutaCartelitaPdf(data: HojaRutaCartelitaInput): void {
  const doc = createCartelitaDoc(data);
  const tag = data.otNumero.replace(/[^\w\-]/g, "_");
  doc.save(`cartelita-ruta-${tag}.pdf`);
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
