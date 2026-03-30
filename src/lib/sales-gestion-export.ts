import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

import { escapeCsvField } from "@/lib/sales-delivery-timing";
import {
  formatPedidoId,
  getGestionCategoria,
} from "@/lib/sales-gestion-status";
import type { SalesOrderRow } from "@/types/sales";

const NAVY: [number, number, number] = [0, 33, 71];

export function estadoGestionLabel(row: SalesOrderRow): string {
  const cat = getGestionCategoria(row);
  if (cat === "retrasado") return "Retrasado";
  if (cat === "en_curso") return "En curso";
  if (cat === "no_empezado") return "No empezado";
  return "Cerrado";
}

export type GestionExportRecord = {
  ID_Pedido: number;
  Pedido_Cliente: string;
  Cliente: string;
  Comercial: string;
  Fecha_Prevista: string;
  Estado_ERP: string;
  Estado_Gestion: string;
};

export function rowsToGestionExportRecords(
  rows: SalesOrderRow[]
): GestionExportRecord[] {
  return rows.map((row) => ({
    ID_Pedido: row.idPedido,
    Pedido_Cliente: formatPedidoId(row),
    Cliente: row.cliente ?? "",
    Comercial: row.comercial ?? "",
    Fecha_Prevista: row.fechaEntrega ?? "",
    Estado_ERP: row.estado ?? "",
    Estado_Gestion: estadoGestionLabel(row),
  }));
}

/** CSV con las mismas columnas que Excel/PDF. */
export function buildGestionCsv(rows: SalesOrderRow[]): string {
  const header = [
    "ID_Pedido",
    "Pedido_Cliente",
    "Cliente",
    "Comercial",
    "Fecha_Prevista",
    "Estado_ERP",
    "Estado_Gestion",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const line = [
      String(row.idPedido ?? ""),
      escapeCsvField(formatPedidoId(row)),
      escapeCsvField(row.cliente ?? ""),
      escapeCsvField(row.comercial ?? ""),
      escapeCsvField(row.fechaEntrega ?? ""),
      escapeCsvField(row.estado ?? ""),
      escapeCsvField(estadoGestionLabel(row)),
    ];
    lines.push(line.join(","));
  }
  return lines.join("\r\n");
}

export function buildGestionXlsxBlob(rows: SalesOrderRow[]): Blob {
  const records = rowsToGestionExportRecords(rows);
  const ws =
    records.length > 0
      ? XLSX.utils.json_to_sheet(records)
      : XLSX.utils.aoa_to_sheet([
          [
            "ID_Pedido",
            "Pedido_Cliente",
            "Cliente",
            "Comercial",
            "Fecha_Prevista",
            "Estado_ERP",
            "Estado_Gestion",
          ],
        ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
  const buf = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function truncateCell(s: string, maxChars: number): string {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * Tabla en PDF horizontal (A4 landscape), tipografía compacta.
 */
export function buildGestionPdfBlob(rows: SalesOrderRow[]): Blob {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageW = 297;
  const pageH = 210;
  const margin = 10;
  let y = margin;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Minerva · Gestión de pedidos", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Generado ${new Date().toLocaleString("es-ES")} · ${rows.length} registro(s)`,
    margin,
    16
  );
  doc.setTextColor(0, 0, 0);

  y = 24;
  const rowH = 5.2;
  const fontSize = 7;
  const cols = {
    pedido: { x: margin, w: 22 },
    cliente: { x: 34, w: 78 },
    comercial: { x: 116, w: 32 },
    fecha: { x: 151, w: 24 },
    gestion: { x: 178, w: 28 },
    erp: { x: 208, w: pageW - margin - 208 },
  };

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 4, pageW - margin * 2, rowH, "F");
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
  doc.text("Nº Pedido", cols.pedido.x, y);
  doc.text("Cliente", cols.cliente.x, y);
  doc.text("Comercial", cols.comercial.x, y);
  doc.text("F. prevista", cols.fecha.x, y);
  doc.text("Estado", cols.gestion.x, y);
  doc.text("Estado ERP", cols.erp.x, y);
  doc.setFont("helvetica", "normal");
  y += rowH + 1;

  const drawRow = (row: SalesOrderRow) => {
    if (y > pageH - margin - rowH) {
      doc.addPage();
      y = margin;
    }
    const pedido = truncateCell(formatPedidoId(row), 14);
    const cliente = truncateCell(row.cliente ?? "", 48);
    const comercial = truncateCell(row.comercial ?? "", 22);
    const fecha = truncateCell(row.fechaEntrega ?? "", 14);
    const gestion = truncateCell(estadoGestionLabel(row), 16);
    const erp = truncateCell(row.estado ?? "", 42);

    doc.setFontSize(fontSize);
    doc.text(pedido, cols.pedido.x, y, { maxWidth: cols.pedido.w });
    doc.text(cliente, cols.cliente.x, y, { maxWidth: cols.cliente.w });
    doc.text(comercial, cols.comercial.x, y, { maxWidth: cols.comercial.w });
    doc.text(fecha, cols.fecha.x, y, { maxWidth: cols.fecha.w });
    doc.text(gestion, cols.gestion.x, y, { maxWidth: cols.gestion.w });
    doc.text(erp, cols.erp.x, y, { maxWidth: cols.erp.w });
    y += rowH;
  };

  for (const row of rows) {
    drawRow(row);
  }

  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "MINERVA Strategic AI Hub · Uso interno",
    margin,
    pageH - 6
  );

  const out = doc.output("blob");
  return out;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function gestionExportBasename(): string {
  return `minerva-gestion-pedidos-${new Date().toISOString().slice(0, 10)}`;
}
