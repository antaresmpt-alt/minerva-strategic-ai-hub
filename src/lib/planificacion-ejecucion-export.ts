import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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

function estadoLabel(value: string): string {
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
    "Maquinista",
    "Incidencia",
    "Acción correctiva",
    "Observaciones",
  ];
  const data = exportRows(rows);
  const wb = XLSX.utils.book_new();

  const summary = XLSX.utils.aoa_to_sheet([
    ["Parte operativo OTs en ejecución"],
    [],
    ["Generado", fmtDate(new Date().toISOString())],
    ["Máquina", filters.maquina],
    ["Estado", filters.estado],
    ["Registros", rows.length],
    ["% finalizadas", `${completionPct(rows)}%`],
  ]);
  const detail = XLSX.utils.aoa_to_sheet([headers, ...data]);
  detail["!freeze"] = { xSplit: 0, ySplit: 1 };
  detail["!cols"] = headers.map((_, i) => ({
    wch: i >= 9 ? 20 : i === 2 ? 18 : 14,
  }));

  XLSX.utils.book_append_sheet(wb, summary, "Resumen");
  XLSX.utils.book_append_sheet(wb, detail, "Ejecuciones");

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `parte-ejecucion-${dateTag}.xlsx`);
}

export function exportEjecucionesPdf(
  rows: MesaEjecucion[],
  filters: ExportFilters,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generated = fmtDate(new Date().toISOString());
  const finishedPct = completionPct(rows);

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

  autoTable(doc, {
    startY: 24,
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

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`parte-ejecucion-${dateTag}.pdf`);
}
