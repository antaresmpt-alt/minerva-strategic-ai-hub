/**
 * planificacion-pdf.ts
 *
 * Genera el PDF operativo de la Mesa de Secuenciación de Impresión.
 * Usa jspdf + jspdf-autotable (ya instalados en el proyecto).
 *
 * Exporta:
 *  - exportPlanificacionPdf(payload)
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { PrintBlock, PrintPayload } from "@/lib/planificacion-export";

// ── Paleta corporativa ─────────────────────────────────────────────────────
const NAVY: [number, number, number] = [0, 33, 71]; // #002147
const GOLD: [number, number, number] = [198, 156, 43];
const LIGHT_GRAY: [number, number, number] = [245, 246, 248];
const MID_GRAY: [number, number, number] = [120, 120, 120];
const WHITE: [number, number, number] = [255, 255, 255];
const AMBER_TEXT: [number, number, number] = [146, 64, 14]; // amber-800
const RUNNING_GREEN: [number, number, number] = [5, 150, 105]; // emerald-600

const MARGIN = 12;

// ── Helpers internos ───────────────────────────────────────────────────────

function pageW(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}
function pageH(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

function addPageNumber(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...MID_GRAY);
    doc.text(
      `Pág. ${i} / ${total}`,
      pageW(doc) - MARGIN,
      pageH(doc) - 5,
      { align: "right" },
    );
  }
}

/** Cabecera corporativa reutilizable en cada hoja. */
function drawHeader(
  doc: jsPDF,
  meta: PrintPayload["meta"],
  isBorrador: boolean,
) {
  const w = pageW(doc);

  // Franja azul
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 26, "F");

  // Título
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("MINERVA · PLANIFICACIÓN IMPRESIÓN", MARGIN, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Hoja operativa de máquina", MARGIN, 18);

  // Info compacta a la derecha
  const infoX = w - MARGIN;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text(`Máquina: ${meta.maquinaNombre}`, infoX, 8, { align: "right" });
  doc.text(`Semana: ${meta.weekMondayKey}`, infoX, 13, { align: "right" });
  const fuenteLabel =
    meta.fuente === "oficial"
      ? meta.fuenteFallback
        ? "FALLBACK BORRADOR"
        : "OFICIAL"
      : meta.fuente === "borrador"
        ? "BORRADOR"
        : "VISIBLE ACTUAL";
  doc.text(`Fuente: ${fuenteLabel}`, infoX, 18, { align: "right" });
  doc.text(
    `Generado: ${format(new Date(meta.generadoAt), "dd/MM/yyyy HH:mm", { locale: es })} · ${meta.generadoPor}`,
    infoX,
    23,
    { align: "right" },
  );

  // Línea dorada
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 27, w - MARGIN, 27);

  // Plan ID
  let cursor = 30;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`Plan ID: ${meta.planId}`, MARGIN, cursor + 4);

  cursor += 8;

  // Watermark borrador
  if (isBorrador) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...AMBER_TEXT);
    doc.text("⚠ BORRADOR – NO OFICIAL", MARGIN, cursor);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    cursor += 5;
  }

  return cursor + 2;
}

/** Dibuja un bloque (turno) con autoTable. */
function drawBlock(
  doc: jsPDF,
  block: PrintBlock,
  startY: number,
  isDaily: boolean,
): number {
  const w = pageW(doc);

  // Sub-cabecera turno
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(MARGIN, startY, w - MARGIN * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(
    `${block.fechaLabel.toUpperCase()}  ·  ${block.turnoLabel.toUpperCase()}`,
    MARGIN + 2,
    startY + 5,
  );
  // Carga
  const cargaTxt = `${block.totalHoras.toFixed(1)}h / ${block.capacidadHoras}h  (${block.pctCarga}%)`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MID_GRAY);
  doc.text(cargaTxt, w - MARGIN - 2, startY + 5, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let tableEndY = startY + 10;

  if (block.rows.length === 0) {
    doc.setFontSize(7);
    doc.setTextColor(...MID_GRAY);
    doc.text("Sin trabajos planificados para este turno.", MARGIN + 2, tableEndY + 4);
    doc.setTextColor(0, 0, 0);
    return tableEndY + 10;
  }

  const head = [
    [
      "#",
      "OT",
      "Cliente / Trabajo",
      "Tintas",
      "Barniz/Acabado",
      "Papel",
      "Hojas",
      "Horas",
      "Incidencia",
      "Acción correctiva",
    ],
  ];

  const body = block.rows.map((r) => [
    String(r.orden),
    r.ot,
    r.clienteTrabajo,
    r.tintas,
    r.barniz,
    r.papel,
    r.hojas > 0 ? r.hojas.toLocaleString("es-ES") : "—",
    r.horas > 0 ? `${r.horas}h` : "—",
    "",
    "",
  ]);
  const estadoByOt = new Map(block.rows.map((r) => [r.ot, r.estadoMesa] as const));

  autoTable(doc, {
    head,
    body,
    startY: tableEndY,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 7, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: isDaily
      ? {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 14 },
          2: { cellWidth: 40 },
          3: { cellWidth: 16 },
          4: { cellWidth: 20 },
          5: { cellWidth: 18 },
          6: { cellWidth: 12, halign: "right" },
          7: { cellWidth: 10, halign: "right" },
          8: { cellWidth: 28 },
          9: { cellWidth: 28 },
        }
      : {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 16 },
          2: { cellWidth: 30 },
          3: { cellWidth: 20 },
          4: { cellWidth: 24 },
          5: { cellWidth: 24 },
          6: { cellWidth: 14, halign: "right" },
          7: { cellWidth: 12, halign: "right" },
          8: { cellWidth: 24 },
          9: { cellWidth: 24 },
        },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      if (hook.column.index !== 1) return; // columna OT
      const ot = String(hook.cell.raw ?? "").trim();
      const estado = estadoByOt.get(ot);
      if (estado === "en_ejecucion") {
        hook.cell.styles.textColor = RUNNING_GREEN;
        hook.cell.styles.fontStyle = "bold";
      } else if (estado === "finalizada") {
        hook.cell.styles.textColor = MID_GRAY;
      }
    },
    didDrawPage: () => {
      // Repite cabecera en cada página extra
    },
  });

  tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable?.finalY ?? tableEndY;

  // Subtotal turno
  tableEndY += 2;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(
    `Subtotal ${block.turnoLabel}: ${block.totalHoras.toFixed(1)}h de ${block.capacidadHoras}h  —  Carga: ${block.pctCarga}%`,
    MARGIN,
    tableEndY + 4,
  );
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  return tableEndY + 10;
}

/** Zona firma maquinista (al final de la hoja o tras los bloques). */
function drawFirmaSection(doc: jsPDF, startY: number): number {
  const w = pageW(doc);
  let y = startY + 4;

  if (y > pageH(doc) - 55) {
    doc.addPage();
    y = MARGIN + 4;
  }

  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, w - MARGIN * 2, 48, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text("CONFIRMACIÓN MAQUINISTA", MARGIN + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  const col1 = MARGIN + 4;
  const col2 = MARGIN + (w - MARGIN * 2) / 2 + 4;

  const lineRow = (label: string, x: number, yl: number) => {
    doc.text(label, x, yl);
    doc.setDrawColor(...MID_GRAY);
    doc.setLineWidth(0.2);
    doc.line(x + 32, yl, x + 82, yl);
  };

  lineRow("Recibido (✓):", col1, y + 15);
  lineRow("Maquinista:", col2, y + 15);
  lineRow("Hora inicio turno:", col1, y + 25);
  lineRow("Hora fin turno:", col2, y + 25);

  // Área incidencias
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Incidencias / Observaciones:", col1, y + 35);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(...MID_GRAY);
  doc.setLineWidth(0.15);
  for (let i = 0; i < 2; i++) {
    doc.line(col1, y + 40 + i * 6, w - MARGIN - 4, y + 40 + i * 6);
  }

  // Zona firma
  doc.setFont("helvetica", "bold");
  doc.text("Firma:", col2, y + 35);
  doc.setDrawColor(...MID_GRAY);
  doc.setLineWidth(0.2);
  doc.rect(col2, y + 38, 62, 9);

  return y + 52;
}

/** Pie de página con totales globales. */
function drawFooter(doc: jsPDF, payload: PrintPayload) {
  const h = pageH(doc);
  const w = pageW(doc);
  doc.setPage(doc.getNumberOfPages());

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, h - 15, w - MARGIN, h - 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  const pct =
    payload.totalCapacidadGlobal > 0
      ? Math.round(
          (payload.totalHorasGlobal / payload.totalCapacidadGlobal) * 100,
        )
      : 0;
  doc.text(
    `${payload.meta.dayKey ? "TOTAL DÍA" : "TOTAL SEMANA"}: ${payload.totalHorasGlobal.toFixed(1)}h / ${payload.totalCapacidadGlobal}h (capacidad teórica) · Carga: ${pct}%`,
    MARGIN,
    h - 10,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MID_GRAY);
  doc.text("MINERVA Strategic AI Hub — Documento operativo interno.", w - MARGIN, h - 10, {
    align: "right",
  });
}

// ============================================================
// Función principal
// ============================================================

/**
 * Genera y descarga el PDF operativo de planificación.
 *
 * @param payload   Resultado de buildPrintPayload()
 */
export function exportPlanificacionPdf(payload: PrintPayload): void {
  const { meta, blocks } = payload;

  const isBorrador =
    meta.fuente === "borrador" || meta.fuenteFallback;

  // Diaria → vertical | Semanal → horizontal
  const orientation =
    blocks.length <= 2 ? "portrait" : "landscape";

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  let cursor = drawHeader(doc, meta, isBorrador);

  // Bloques de turnos
  for (const block of blocks) {
    // Si no cabe la sub-cabecera + al menos 2 filas, nueva página
    if (cursor > pageH(doc) - 55) {
      doc.addPage();
      cursor = MARGIN;
    }
    cursor = drawBlock(doc, block, cursor, Boolean(meta.dayKey));
  }

  // Zona firma maquinista (solo en hoja diaria)
  if (meta.dayKey) {
    cursor = drawFirmaSection(doc, cursor);
  }

  drawFooter(doc, payload);
  addPageNumber(doc);

  // Watermark diagonal si borrador
  if (isBorrador) {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(50);
      doc.setTextColor(220, 150, 0);
      doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.07 }));
      doc.text(
        "BORRADOR",
        pageW(doc) / 2,
        pageH(doc) / 2,
        { align: "center", angle: 45 },
      );
      doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }));
    }
  }

  // Nombre archivo
  const dateStr = (meta.dayKey ?? meta.weekMondayKey).replace(/-/g, "");
  const mq = meta.maquinaNombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase()
    .slice(0, 16);
  const tipo = meta.dayKey ? "diario" : "semanal";
  const src =
    meta.fuente === "oficial"
      ? meta.fuenteFallback
        ? "fallback"
        : "oficial"
      : meta.fuente === "borrador"
        ? "borrador"
        : "visible";
  doc.save(`plan-impresion-${tipo}-${dateStr}-${mq}-${src}.pdf`);
}
