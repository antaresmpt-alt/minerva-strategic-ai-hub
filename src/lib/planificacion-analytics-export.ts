import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  formatMinutesDuration,
  type EjecucionEfficiencyReport,
} from "@/lib/planificacion-ejecucion-efficiency";
import type { AnaliticaPlantaEjecucion } from "@/lib/planificacion-analytics-query";

type ExecutivePdfOptions = {
  title: string;
  dateRangeLabel: string;
  procesoLabel: string;
  maquinaLabel: string;
  estadoLabel: string;
};

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  calidad: [124, 58, 237],
  suministros: [37, 99, 235],
  tecnicos: [220, 38, 38],
  operativos: [100, 116, 139],
};

const CATEGORY_LABELS: Record<string, string> = {
  calidad: "Calidad",
  suministros: "Suministros",
  tecnicos: "Técnicos",
  operativos: "Operativos",
};

function fmtDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function rowByExecutionId(rows: AnaliticaPlantaEjecucion[]): Map<string, AnaliticaPlantaEjecucion> {
  return new Map(rows.map((r) => [r.id, r] as const));
}

export function exportAnaliticaPlantaExecutivePdf(
  rows: AnaliticaPlantaEjecucion[],
  report: EjecucionEfficiencyReport,
  options: ExecutivePdfOptions,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generatedAt = new Date();
  const rowsById = rowByExecutionId(rows);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 33, 71);
  doc.text("Informe Ejecutivo de Rendimiento", 10, 12);
  doc.setFontSize(11);
  doc.text(options.title, 10, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Generado: ${fmtDate(generatedAt)} · Periodo: ${options.dateRangeLabel} · Proceso: ${options.procesoLabel} · Máquina: ${options.maquinaLabel} · Estado: ${options.estadoLabel}`,
    10,
    25,
  );

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, 31, 277, 28, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 33, 71);
  doc.text("KPIs principales", 14, 38);

  const kpis = [
    ["Eficiencia operativa", `${report.eficienciaPct}% (${report.estadoMaquina.label})`],
    ["Tiempo de marcha", formatMinutesDuration(report.tiempoMarchaMin)],
    ["Tiempo de pausa", formatMinutesDuration(report.tiempoPausaMin)],
    [
      "Causa principal",
      report.causaPrincipal
        ? `${report.causaPrincipal.motivo} · ${formatMinutesDuration(report.causaPrincipal.minutos)}`
        : "Sin pausas",
    ],
  ];
  doc.setFontSize(8);
  kpis.forEach(([label, value], index) => {
    const x = 14 + index * 68;
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(label, x, 46);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(value, x, 52, { maxWidth: 62 });
  });

  autoTable(doc, {
    startY: 66,
    head: [["Top motivos de pausa", "Categoría", "Tiempo perdido"]],
    body:
      report.topMotivosPausa.length > 0
        ? report.topMotivosPausa
            .slice(0, 8)
            .map((r) => [r.motivo, categoryLabel(r.categoria), formatMinutesDuration(r.minutos)])
        : [["Sin pausas registradas", "-", "-"]],
    styles: { fontSize: 8, cellPadding: 1.7 },
    headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
    margin: { left: 10, right: 155 },
    columnStyles: { 2: { halign: "right" } },
  });

  autoTable(doc, {
    startY: 66,
    head: [["Categoría", "Tiempo", "Peso"]],
    body:
      report.distribucionCategorias.length > 0
        ? report.distribucionCategorias.map((r) => [
            categoryLabel(r.categoria),
            formatMinutesDuration(r.minutos),
            report.tiempoPausaMin > 0
              ? `${Math.round((r.minutos / report.tiempoPausaMin) * 100)}%`
              : "0%",
          ])
        : [["Sin pausas", "-", "-"]],
    styles: { fontSize: 8, cellPadding: 1.7 },
    headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
    margin: { left: 152, right: 10 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const source = report.distribucionCategorias[data.row.index];
      if (!source) return;
      data.cell.styles.textColor = CATEGORY_COLORS[source.categoria] ?? [15, 23, 42];
      data.cell.styles.fontStyle = "bold";
    },
  });

  const startY = Math.max(lastTableY(doc, 66), 104) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 33, 71);
  doc.text("Top 5 OTs con peor eficiencia", 10, startY);

  autoTable(doc, {
    startY: startY + 4,
    head: [["OT", "Cliente", "Máquina", "Ocupación", "Pausa", "Eficiencia", "Causa principal"]],
    body:
      report.worstPerformingRows.length > 0
        ? report.worstPerformingRows.map((metric) => {
            const row = rowsById.get(metric.executionId);
            return [
              metric.ot,
              row?.cliente ?? "-",
              row?.maquinaNombre ?? "-",
              formatMinutesDuration(metric.tiempoTotalMin),
              formatMinutesDuration(metric.tiempoPausaMin),
              `${metric.eficienciaPct}%`,
              metric.causaPrincipal
                ? `${metric.causaPrincipal.motivo} · ${formatMinutesDuration(metric.causaPrincipal.minutos)}`
                : "-",
            ];
          })
        : [["Sin ejecuciones con ocupación", "-", "-", "-", "-", "-", "-"]],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
    margin: { left: 10, right: 10 },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
  });

  const noteY = lastTableY(doc, startY + 4) + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Nota metodológica: Eficiencia operativa = tiempo de marcha / tiempo total de ocupación. Los tiempos se calculan por solape real con el periodo filtrado.",
    10,
    noteY,
    { maxWidth: 277 },
  );

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`informe-rendimiento-planta-${dateTag}.pdf`);
}
