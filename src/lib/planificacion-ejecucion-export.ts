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

function exportRows(rows: MesaEjecucion[]): string[][] {
  return rows.map((r) => {
    const dev = deviation(r);
    return [
      r.ot,
      r.maquinaNombre,
      `${r.fechaPlanificada ?? "-"} / ${r.turno ?? "-"}`,
      estadoLabel(r.estadoEjecucion),
      fmtDate(r.inicioRealAt),
      fmtDate(r.finRealAt),
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

  autoTable(doc, {
    startY: 20,
    head: [[
      "OT",
      "Máquina",
      "Fecha/Turno",
      "Estado",
      "Inicio",
      "Fin",
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
