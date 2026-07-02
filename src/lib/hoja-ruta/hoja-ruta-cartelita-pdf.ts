import { jsPDF } from "jspdf";

import { fmtDateShort } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type { HojaRutaData } from "@/lib/hoja-ruta/hoja-ruta-query";

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const ORANGE: [number, number, number] = [194, 65, 12];

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

export type HojaRutaCartelitaComponente = {
  referencia_codigo: string;
  referencia_descripcion: string | null;
  poses_en_forma: number;
  cantidad_objetivo: number;
};

export type HojaRutaCartelitaHijaResumen = {
  otNumero: string;
  label: string;
  netas: number;
  refs: string;
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
  /** Portada del barco contenedor (sin casillas de firma). */
  esPortadaBarco?: boolean;
  hijasResumen?: HojaRutaCartelitaHijaResumen[];
  /** Hoja de ejecución por forma/hija. */
  formaLabel?: string | null;
  hojasNetas?: number | null;
  hojasBrutas?: number | null;
  componentes?: HojaRutaCartelitaComponente[];
  avisoNoMezclar?: boolean;
};

export type HojaRutaCartelitaPack = {
  portada: HojaRutaCartelitaInput | null;
  hijas: HojaRutaCartelitaInput[];
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

function drawMetaBox(
  doc: jsPDF,
  data: HojaRutaCartelitaInput,
  yStart: number,
): number {
  const w = pageWidth(doc);
  const usable = w - MARGIN.left - MARGIN.right;
  let y = yStart;

  const metaBoxH = data.formaLabel || data.hojasNetas != null ? 24 : 18;
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

  if (data.formaLabel || data.hojasNetas != null) {
    const formaParts: string[] = [];
    if (data.formaLabel?.trim()) formaParts.push(data.formaLabel.trim());
    if (data.hojasNetas != null && data.hojasNetas > 0) {
      formaParts.push(`${data.hojasNetas.toLocaleString("es-ES")} netas`);
    }
    if (data.hojasBrutas != null && data.hojasBrutas > 0) {
      formaParts.push(`${data.hojasBrutas.toLocaleString("es-ES")} brutas`);
    }
    if (formaParts.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(truncate(doc, formaParts.join(" · "), usable - 4), MARGIN.left + 2, y + 19);
    }
  }

  return y + metaBoxH + 4;
}

function drawComponentesBlock(
  doc: jsPDF,
  data: HojaRutaCartelitaInput,
  yStart: number,
): number {
  const comps = data.componentes ?? [];
  if (comps.length === 0) return yStart;

  const w = pageWidth(doc);
  const usable = w - MARGIN.left - MARGIN.right;
  let y = yStart;

  if (data.avisoNoMezclar) {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(...ORANGE);
    doc.roundedRect(MARGIN.left, y, usable, 6 + comps.length * 4, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...ORANGE);
    doc.text("⚠ FORMA CON VARIAS REFERENCIAS — NO MEZCLAR", MARGIN.left + 2, y + 4);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    for (const c of comps) {
      const desc = c.referencia_descripcion?.trim();
      const line = `${c.poses_en_forma}p → ${c.referencia_codigo}${desc ? ` (${desc})` : ""} · ${c.cantidad_objetivo.toLocaleString("es-ES")} u`;
      doc.text(truncate(doc, line, usable - 4), MARGIN.left + 2, y + 3);
      y += 4;
    }
    return y + 3;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("Referencias en forma:", MARGIN.left, y + 2);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  for (const c of comps) {
    const line = `${c.referencia_codigo} · ${c.poses_en_forma}p → ${c.cantidad_objetivo.toLocaleString("es-ES")} u`;
    doc.text(truncate(doc, line, usable - 2), MARGIN.left + 2, y + 2);
    y += 4;
  }
  return y + 2;
}

function drawItinerarioFirmas(
  doc: jsPDF,
  data: HojaRutaCartelitaInput,
  yStart: number,
): number {
  const w = pageWidth(doc);
  const usable = w - MARGIN.left - MARGIN.right;
  let y = yStart;

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
  return y;
}

function drawFooter(doc: jsPDF): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `Minerva Global · ${BANNER_TITLE} · ${fmtNowEs()}`,
    MARGIN.left,
    PAGE_H - MARGIN.bottom + 2,
  );
}

function renderPortadaBarco(doc: jsPDF, data: HojaRutaCartelitaInput): void {
  const w = pageWidth(doc);
  const usable = w - MARGIN.left - MARGIN.right;
  let y = MARGIN.top;

  doc.setFillColor(...NAVY);
  doc.rect(0, y, w, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("HOJA DE RUTA SIMPLIFICADA · BARCO", MARGIN.left, y + 4.5);
  doc.setFontSize(14);
  doc.text(`OT ${data.otNumero}`, w - MARGIN.right, y + 8, { align: "right" });
  y += 14;

  y = drawMetaBox(doc, data, y);

  const hijas = data.hijasResumen ?? [];
  if (hijas.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(`FORMAS / HIJAS (${hijas.length}) — referencia logística`, MARGIN.left, y + 2);
    y += 6;

    for (const h of hijas) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(
        truncate(
          doc,
          `${h.otNumero} · ${h.label} — ${h.netas.toLocaleString("es-ES")} netas`,
          usable,
        ),
        MARGIN.left,
        y + 2,
      );
      y += 4;
      if (h.refs.trim()) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...SLATE);
        doc.text(truncate(doc, h.refs, usable - 2), MARGIN.left + 2, y + 2);
        y += 5;
      } else {
        y += 2;
      }
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...SLATE);
    doc.text(
      "Las hojas siguientes (1 por forma) llevan el itinerario con firmas.",
      MARGIN.left,
      y + 2,
    );
  }

  drawFooter(doc);
}

function renderCartelitaHija(doc: jsPDF, data: HojaRutaCartelitaInput): void {
  const w = pageWidth(doc);
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

  y = drawMetaBox(doc, data, y);
  y = drawComponentesBlock(doc, data, y);
  drawItinerarioFirmas(doc, data, y);
  drawFooter(doc);
}

function renderCartelita(doc: jsPDF, data: HojaRutaCartelitaInput): void {
  if (data.esPortadaBarco) {
    renderPortadaBarco(doc, data);
    return;
  }
  renderCartelitaHija(doc, data);
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

function createCartelitaPackDoc(pack: HojaRutaCartelitaPack): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });

  if (pack.portada) {
    renderCartelita(doc, pack.portada);
  }

  for (let i = 0; i < pack.hijas.length; i++) {
    if (pack.portada || i > 0) doc.addPage("a5", "portrait");
    renderCartelita(doc, pack.hijas[i]!);
  }

  return doc;
}

function normalizePack(
  data: HojaRutaCartelitaInput | HojaRutaCartelitaPack,
): HojaRutaCartelitaPack {
  if ("hijas" in data) return data;
  return { portada: null, hijas: [data] };
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

/** Descarga PDF A5 vertical — hoja(s) de ruta simplificada. */
export function exportHojaRutaCartelitaPdf(
  data: HojaRutaCartelitaInput | HojaRutaCartelitaPack,
): void {
  const pack = normalizePack(data);
  const doc = createCartelitaPackDoc(pack);
  const tag = (
    pack.portada?.otNumero ??
    pack.hijas[0]?.otNumero ??
    "ot"
  ).replace(/[^\w\-]/g, "_");
  doc.save(`hoja-ruta-simplificada-${tag}.pdf`);
}

/** Abre diálogo de impresión del navegador. */
export function printHojaRutaCartelitaPdf(
  data: HojaRutaCartelitaInput | HojaRutaCartelitaPack,
): void {
  const pack = normalizePack(data);
  const doc = createCartelitaPackDoc(pack);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  const w = window.open(blobUrl, "_blank");
  if (!w) {
    exportHojaRutaCartelitaPdf(pack);
  }
}
