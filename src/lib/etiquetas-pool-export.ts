import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  labelItinerarioEtiquetas,
  type EtiquetasPoolPlanItem,
} from "@/lib/etiquetas-pool-entrada";

const NAVY: [number, number, number] = [0, 33, 71];

function fmtDateEs(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const d = new Date(ymd.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function exportEtiquetasPoolColaPdf(plan: EtiquetasPoolPlanItem[]): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fecha = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Cola de ejecución — Etiquetas digital", 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generado ${fecha} · ${plan.length} OT${plan.length === 1 ? "" : "s"}`, 14, 22);

  const body = plan.map((row, idx) => [
    String(idx + 1),
    row.otNumero,
    row.cliente?.trim() || "—",
    row.trabajo?.trim() || "—",
    row.cantidad != null ? Number(row.cantidad).toLocaleString("es-ES") : "—",
    fmtDateEs(row.fechaEntrega),
    labelItinerarioEtiquetas(row.itinerario),
    row.despachada ? "Sí" : "No",
  ]);

  autoTable(doc, {
    startY: 28,
    head: [["#", "OT", "Cliente", "Trabajo", "Cant.", "Entrega", "I/T/N", "Desp."]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18, fontStyle: "bold" },
      4: { halign: "right" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`cola-etiquetas-${new Date().toISOString().slice(0, 10)}.pdf`);
}
