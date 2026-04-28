import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
  buildEjecucionEfficiencyReport,
  formatMinutesDuration,
  type PauseDetail,
  type PausesByExecutionId,
} from "@/lib/planificacion-ejecucion-efficiency";
import type { MesaEjecucion } from "@/types/planificacion-mesa";

type ExportFilters = {
  maquina: string;
  estado: string;
};

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(1).replace(/\.0$/, "");
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function pauseDetailRows(details: PauseDetail[]): string[][] {
  return details.map((p) => [
    p.ot,
    fmtDate(p.inicio),
    fmtDate(p.fin),
    p.motivo,
    p.categoria,
    formatMinutesDuration(p.duracionMin),
    p.observaciones ?? "-",
  ]);
}

function estadoLabel(value: string): string {
  if (value === "pendiente_inicio") return "Pendiente inicio";
  if (value === "en_curso") return "En curso";
  if (value === "pausada") return "Pausada";
  if (value === "finalizada") return "Finalizada";
  if (value === "cancelada") return "Cancelada";
  return value;
}

function deviation(r: MesaEjecucion): number | null {
  if (r.horasReales == null || r.horasPlanificadasSnapshot == null) return null;
  return r.horasReales - r.horasPlanificadasSnapshot;
}

function durationHours(r: MesaEjecucion): number | null {
  if (!r.inicioRealAt || !r.finRealAt) return null;
  const start = new Date(r.inicioRealAt).getTime();
  const end = new Date(r.finRealAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return (end - start) / (1000 * 60 * 60);
}

function completionPct(rows: MesaEjecucion[]): number {
  if (!rows.length) return 0;
  const finished = rows.filter((r) => r.estadoEjecucion === "finalizada").length;
  return Math.round((finished / rows.length) * 100);
}

function exportRows(rows: MesaEjecucion[]): string[][] {
  return rows.map((r) => {
    const dev = deviation(r);
    const dur = durationHours(r);
    return [
      r.ot,
      r.maquinaNombre,
      `${r.fechaPlanificada ?? "-"} / ${r.turno ?? "-"}`,
      estadoLabel(r.estadoEjecucion),
      fmtDate(r.inicioRealAt),
      fmtDate(r.finRealAt),
      dur == null ? "-" : fmtHours(dur),
      fmtHours(r.horasPlanificadasSnapshot),
      fmtHours(r.horasReales),
      dev == null ? "-" : fmtHours(dev),
      r.numPausas > 0 ? String(r.numPausas) : "-",
      r.minutosPausadaAcum > 0 ? String(r.minutosPausadaAcum) : "-",
      fmtDate(r.pausaActivaDesde),
      r.motivoPausaActiva ?? "-",
      r.motivoPausaCategoriaActiva ?? "-",
      r.maquinista ?? "-",
      r.incidencia ?? "-",
      r.accionCorrectiva ?? "-",
      r.observaciones ?? "-",
    ];
  });
}

export function exportEjecucionesExcel(
  rows: MesaEjecucion[],
  filters: ExportFilters,
  pausesByExecutionId: PausesByExecutionId = {},
): void {
  const headers = [
    "OT",
    "Máquina",
    "Fecha/Turno",
    "Estado",
    "Inicio real",
    "Fin real",
    "Duración real (h)",
    "Horas plan",
    "Horas reales",
    "Desviación",
    "Nº pausas",
    "Min. pausa acum.",
    "Última pausa",
    "Motivo pausa",
    "Categoría pausa",
    "Maquinista",
    "Incidencia",
    "Acción correctiva",
    "Observaciones",
  ];
  const data = exportRows(rows);
  const efficiency = buildEjecucionEfficiencyReport(rows, pausesByExecutionId);
  const wb = XLSX.utils.book_new();

  const summary = XLSX.utils.aoa_to_sheet([
    ["Parte operativo OTs en ejecución"],
    [],
    ["Generado", fmtDate(new Date().toISOString())],
    ["Máquina", filters.maquina],
    ["Estado", filters.estado],
    ["Registros", rows.length],
    ["% finalizadas", `${completionPct(rows)}%`],
    [],
    ["Resumen de eficiencia del periodo filtrado"],
    ["Tiempo de marcha", formatMinutesDuration(efficiency.tiempoMarchaMin)],
    ["Tiempo de pausa", formatMinutesDuration(efficiency.tiempoPausaMin)],
    ["Eficiencia", `${efficiency.eficienciaPct}%`],
    ["Causa principal", efficiency.causaPrincipal
      ? `${efficiency.causaPrincipal.categoria} · ${efficiency.causaPrincipal.motivo} (${formatMinutesDuration(efficiency.causaPrincipal.minutos)})`
      : "-"],
    ["Estado máquina", efficiency.estadoMaquina.label],
  ]);
  const detail = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const pauseDetail = XLSX.utils.aoa_to_sheet([
    ["OT", "Inicio", "Fin", "Motivo", "Categoría", "Duración", "Observaciones"],
    ...pauseDetailRows(efficiency.pauseDetails),
  ]);
  detail["!freeze"] = { xSplit: 0, ySplit: 1 };
  detail["!cols"] = headers.map((_, i) => ({
    wch: i >= 9 ? 20 : i === 2 ? 18 : 14,
  }));

  XLSX.utils.book_append_sheet(wb, summary, "Resumen");
  XLSX.utils.book_append_sheet(wb, detail, "Ejecuciones");
  XLSX.utils.book_append_sheet(wb, pauseDetail, "Pausas");

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `parte-ejecucion-${dateTag}.xlsx`);
}

export function exportEjecucionesPdf(
  rows: MesaEjecucion[],
  filters: ExportFilters,
  pausesByExecutionId: PausesByExecutionId = {},
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generated = fmtDate(new Date().toISOString());
  const finishedPct = completionPct(rows);
  const efficiency = buildEjecucionEfficiencyReport(rows, pausesByExecutionId);
  const status = efficiency.estadoMaquina;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Parte operativo OTs en ejecución", 10, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generado: ${generated} · Máquina: ${filters.maquina} · Estado: ${filters.estado} · Registros: ${rows.length}`,
    10,
    16,
  );
  doc.text(`OTs finalizadas: ${finishedPct}%`, 10, 21);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, 25, 277, 23, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 33, 71);
  doc.text("Resumen de eficiencia del periodo filtrado", 13, 31);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Marcha: ${formatMinutesDuration(efficiency.tiempoMarchaMin)}`, 13, 38);
  doc.text(`Pausa: ${formatMinutesDuration(efficiency.tiempoPausaMin)}`, 58, 38);
  doc.text(`Eficiencia: ${efficiency.eficienciaPct}%`, 99, 38);
  const causeText = efficiency.causaPrincipal
    ? `${efficiency.causaPrincipal.categoria} · ${efficiency.causaPrincipal.motivo} (${formatMinutesDuration(efficiency.causaPrincipal.minutos)})`
    : "-";
  doc.text(`Causa principal: ${causeText}`, 13, 44);
  doc.setFillColor(...status.color);
  doc.roundedRect(223, 33, 58, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`Estado máquina: ${status.label}`, 252, 38.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 52,
    head: [[
      "OT",
      "Máquina",
      "Fecha/Turno",
      "Estado",
      "Inicio",
      "Fin",
      "Duración",
      "Plan",
      "Real",
      "Desv.",
      "Nº pausas",
      "Min pausa",
      "Última pausa",
      "Motivo pausa",
      "Categoría pausa",
      "Maquinista",
      "Incidencia",
      "Acción",
      "Obs.",
    ]],
    body: exportRows(rows),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
  });

  const pauseRows = pauseDetailRows(efficiency.pauseDetails);
  const startY = lastTableY(doc, 52) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 33, 71);
  doc.text("Histórico Detallado de Pausas", 10, startY);
  autoTable(doc, {
    startY: startY + 3,
    head: [["OT", "Inicio", "Fin", "Motivo", "Categoría", "Duración", "Observaciones"]],
    body: pauseRows.length > 0
      ? pauseRows
      : [["-", "-", "-", "Sin pausas para los filtros actuales", "-", "-", "-"]],
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 42 },
      4: { cellWidth: 28 },
      5: { cellWidth: 20, halign: "right" },
    },
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`parte-ejecucion-${dateTag}.pdf`);
}
