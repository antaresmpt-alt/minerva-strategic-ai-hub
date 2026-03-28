import { jsPDF } from "jspdf";

const NAVY: [number, number, number] = [0, 33, 71]; // #002147
const GOLD: [number, number, number] = [198, 156, 43]; // accent
const MARGIN = 18;
const LINE_HEIGHT = 6;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MAX_W = PAGE_WIDTH - MARGIN * 2;

function addWrappedText(
  doc: jsPDF,
  text: string,
  y: number,
  fontSize: number
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, MAX_W);
  let cursor = y;
  for (const line of lines) {
    if (cursor > PAGE_HEIGHT - MARGIN - 10) {
      doc.addPage();
      cursor = MARGIN;
    }
    doc.text(line, MARGIN, cursor);
    cursor += LINE_HEIGHT * (fontSize / 11);
  }
  return cursor + 4;
}

function drawHeader(doc: jsPDF, title: string) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("MINERVA STRATEGIC AI HUB", MARGIN, 12);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, 22);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 30, PAGE_WIDTH - MARGIN, 30);
}

/** Placeholder logo area — texto marca (asset gráfico puede sustituirse en public/) */
function drawLogoBar(doc: jsPDF) {
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, 38, 46, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("MINERVA", MARGIN + 6, 47);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

export function exportCleanPdf(opts: {
  title: string;
  body: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, opts.title);
  drawLogoBar(doc);
  addWrappedText(doc, opts.body, 58, 10);
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "MINERVA Strategic AI Hub — Documento generado para uso interno estratégico.",
    MARGIN,
    PAGE_HEIGHT - 10
  );
  doc.save(`minerva-${opts.title.replace(/\s+/g, "-").slice(0, 40)}.pdf`);
}

export function exportSessionPdf(opts: {
  title: string;
  report: string;
  chat: { role: string; content: string }[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, opts.title + " — Sesión completa");
  drawLogoBar(doc);
  let y = 58;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Informe", MARGIN, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  y = addWrappedText(doc, opts.report, y, 10);

  y += 6;
  if (y > PAGE_HEIGHT - 40) {
    doc.addPage();
    y = MARGIN;
  }

  if (y > PAGE_HEIGHT - 50) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Profundización (chat)", MARGIN, y);
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  for (const m of opts.chat) {
    const prefix = m.role === "user" ? "Usuario: " : "Asistente: ";
    const block = prefix + m.content;
    y = addWrappedText(doc, block, y, 9);
    y += 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "Incluye informe y conversación de profundización.",
    MARGIN,
    PAGE_HEIGHT - 10
  );
  doc.save(`minerva-sesion-${opts.title.replace(/\s+/g, "-").slice(0, 32)}.pdf`);
}
