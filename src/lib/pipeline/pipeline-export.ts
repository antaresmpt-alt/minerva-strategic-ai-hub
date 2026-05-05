import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { PipelineRowView } from "@/lib/pipeline/pipeline-data";

type PipelinePdfMode = "listado" | "analitica" | "ambas";

type PipelineExportOptions = {
  rows: PipelineRowView[];
  mode: PipelinePdfMode;
  generatedAtIso?: string;
  filtrosLabel: string;
  wipRows: Array<{ seccion: string; enCurso: number; enCola: number }>;
  bottleneckRows: Array<{
    seccion: string;
    enCola: number;
    bloqueadas: number;
    riesgo: number;
    score: number;
  }>;
};

const NAVY: [number, number, number] = [0, 33, 71];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtHours(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}h`;
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

function listRows(rows: PipelineRowView): string[] {
  return [
    rows.otNumero,
    rows.cliente ?? "—",
    rows.trabajo ?? "—",
    rows.pasoActual?.procesoNombre ?? "—",
    rows.siguientePaso?.procesoNombre ?? "—",
    rows.pasos.length > 0
      ? rows.pasos
          .slice(0, 6)
          .map((p) => `${p.orden}:${p.procesoNombre ?? "—"}`)
          .join(" · ")
      : "—",
    rows.riesgo,
    rows.badges.join(", ") || "—",
  ];
}

function analyticsRows(rows: PipelineRowView): string[] {
  return [
    rows.otNumero,
    fmtHours(rows.analytics.horasPlanificadasTotal),
    fmtHours(rows.analytics.horasRealesTotal),
    rows.analytics.desviacionHoras != null
      ? `${rows.analytics.desviacionHoras > 0 ? "+" : ""}${rows.analytics.desviacionHoras.toFixed(1)}h`
      : "—",
    fmtDate(rows.analytics.etaPrevista),
    rows.analytics.slaStatus,
    rows.riesgo,
  ];
}

export function exportPipelinePdf(options: PipelineExportOptions): void {
  const generatedAt = fmtDate(options.generatedAtIso ?? new Date().toISOString());
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const addHeader = (title: string, subtitle: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text(title, 10, 10);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(10, 13, 277, 15, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    doc.text(`${subtitle} · Generado: ${generatedAt}`, 13, 19);
    doc.text(`Filtros: ${options.filtrosLabel || "sin filtros"}`, 13, 24);
    doc.setTextColor(0, 0, 0);
  };

  if (options.mode === "listado" || options.mode === "ambas") {
    addHeader("Pipeline OT - Listado Operativo", `Registros: ${options.rows.length}`);
    autoTable(doc, {
      startY: 32,
      head: [[
        "OT",
        "Cliente",
        "Trabajo",
        "Paso actual",
        "Siguiente",
        "Timeline",
        "Riesgo",
        "Badges",
      ]],
      body: options.rows.map((r) => listRows(r)),
      styles: { fontSize: 7, cellPadding: 1.6 },
      headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
      margin: { left: 8, right: 8 },
    });
  }

  if (options.mode === "analitica" || options.mode === "ambas") {
    if (options.mode === "ambas") doc.addPage("a4", "landscape");
    addHeader("Pipeline OT - Resumen Analítico", `Registros: ${options.rows.length}`);

    autoTable(doc, {
      startY: 32,
      head: [["OT", "Plan", "Real", "Desv.", "ETA", "SLA", "Riesgo"]],
      body: options.rows.map((r) => analyticsRows(r)),
      styles: { fontSize: 7, cellPadding: 1.6 },
      headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255] },
      margin: { left: 8, right: 8 },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 3) {
          const raw = String(data.cell.raw ?? "");
          if (raw.startsWith("+")) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.column.index === 5) {
          const raw = String(data.cell.raw ?? "");
          if (raw === "late") {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          } else if (raw === "at_risk") {
            data.cell.styles.textColor = [146, 64, 14];
          } else if (raw === "on_track") {
            data.cell.styles.textColor = [21, 128, 61];
          }
        }
      },
    });

    const afterMain = lastTableY(doc, 32) + 6;

    autoTable(doc, {
      startY: afterMain,
      head: [["WIP por sección", "En curso", "En cola"]],
      body:
        options.wipRows.length > 0
          ? options.wipRows.map((r) => [
              r.seccion,
              String(r.enCurso),
              String(r.enCola),
            ])
          : [["Sin datos", "-", "-"]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      margin: { left: 8, right: 150 },
    });

    autoTable(doc, {
      startY: afterMain,
      head: [["Top cuellos", "Cola", "Bloq", "Riesgo", "Score"]],
      body:
        options.bottleneckRows.length > 0
          ? options.bottleneckRows.map((r) => [
              r.seccion,
              String(r.enCola),
              String(r.bloqueadas),
              String(r.riesgo),
              String(r.score),
            ])
          : [["Sin datos", "-", "-", "-", "-"]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      margin: { left: 150, right: 8 },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text("Parte operativo pipeline OTs", 8, 205);
    doc.text(`Página ${page}/${totalPages}`, 288, 205, { align: "right" });
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`pipeline-ot-${dateTag}.pdf`);
}

export type { PipelinePdfMode };
