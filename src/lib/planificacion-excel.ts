/**
 * planificacion-excel.ts
 *
 * Genera el Excel operativo/analítico de la Mesa de Secuenciación de
 * Impresión. Usa la librería `xlsx` ya instalada en el proyecto (misma que
 * otros módulos de exportación del repo).
 */

import * as XLSX from "xlsx";

import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { PrintPayload } from "@/lib/planificacion-export";

// ── Helpers ────────────────────────────────────────────────────────────────

function setCellStyle(
  ws: XLSX.WorkSheet,
  addr: string,
  style: Record<string, unknown>,
) {
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  (ws[addr] as Record<string, unknown>).s = style;
}

function autoWidths(ws: XLSX.WorkSheet, rows: unknown[][]): void {
  if (!rows.length) return;
  const widths = (rows[0] as unknown[]).map((_, ci) => {
    return rows.reduce((max, row) => {
      const cell = (row as unknown[])[ci];
      const len = cell != null ? String(cell).length : 0;
      return Math.max(max, len);
    }, 10);
  });
  ws["!cols"] = widths.map((w) => ({ wch: Math.min(w + 2, 50) }));
}

// ── Hoja Resumen ───────────────────────────────────────────────────────────

function buildResumenSheet(payload: PrintPayload): XLSX.WorkSheet {
  const { meta } = payload;

  const fuenteLabel =
    meta.fuente === "oficial"
      ? meta.fuenteFallback
        ? "Oficial (fallback a borrador)"
        : "Oficial (confirmado)"
      : meta.fuente === "borrador"
        ? "Borrador"
        : "Visible actual";

  const rows: unknown[][] = [
    ["MINERVA STRATEGIC AI HUB — Plan de Producción Impresión"],
    [],
    ["Plan ID", meta.planId],
    ["Máquina", meta.maquinaNombre],
    ["Semana", meta.weekMondayKey],
    ["Día exportado", meta.dayKey ?? "Semana completa"],
    ["Turno", meta.turno === "ambos" ? "Mañana + Tarde" : meta.turno === "manana" ? "Mañana" : "Tarde"],
    ["Fuente datos", fuenteLabel],
    ["Generado por", meta.generadoPor],
    [
      "Generado el",
      format(new Date(meta.generadoAt), "dd/MM/yyyy HH:mm", { locale: es }),
    ],
    [],
    ["Resumen de carga"],
    ["Día", "Turno", "Trabajos", "Horas planificadas", "Capacidad (h)", "Carga (%)"],
    ...payload.blocks.map((b) => [
      b.fechaLabel,
      b.turnoLabel,
      b.rows.length,
      b.totalHoras,
      b.capacidadHoras,
      b.pctCarga,
    ]),
    [],
    [
      "TOTALES",
      "",
      payload.blocks.reduce((s, b) => s + b.rows.length, 0),
      payload.totalHorasGlobal,
      payload.totalCapacidadGlobal,
      payload.totalCapacidadGlobal > 0
        ? Math.round((payload.totalHorasGlobal / payload.totalCapacidadGlobal) * 100)
        : 0,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

  ws["!cols"] = [
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
  ];

  // Estilo cabecera principal
  if (ws["A1"]) {
    (ws["A1"] as Record<string, unknown>).s = {
      font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002147" } },
      alignment: { horizontal: "center" },
    };
  }

  return ws;
}

// ── Hoja Plan ──────────────────────────────────────────────────────────────

function buildPlanSheet(payload: PrintPayload): XLSX.WorkSheet {
  const headers = [
    "Fecha",
    "Turno",
    "Orden",
    "OT",
    "Cliente / Trabajo",
    "Tintas",
    "Barniz / Acabado",
    "Papel",
    "Hojas aprox.",
    "Horas plan.",
    "Incidencia",
    "Acción correctiva",
  ];

  const dataRows: unknown[][] = [];
  for (const block of payload.blocks) {
    for (const row of block.rows) {
      dataRows.push([
        row.fecha,
        row.turnoLabel,
        row.orden,
        row.ot,
        row.clienteTrabajo,
        row.tintas,
        row.barniz,
        row.papel,
        row.hojas > 0 ? row.hojas : "—",
        row.horas > 0 ? row.horas : "—",
        "",
        "",
      ]);
    }
    // Subtotal por turno
    if (block.rows.length > 0) {
      dataRows.push([
        `Subtotal ${block.fechaLabel} · ${block.turnoLabel}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        block.totalHoras,
        "",
        "",
      ]);
    }
  }

  dataRows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    payload.totalHorasGlobal,
    "",
    "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  autoWidths(ws, [headers, ...dataRows]);

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Negrita en cabecera (estilos inline — xlsx open formats)
  for (let ci = 0; ci < headers.length; ci++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    setCellStyle(ws, addr, {
      font: { bold: true, color: { rgb: "FFFFFF" } as Record<string,unknown> },
      fill: { fgColor: { rgb: "002147" } as Record<string,unknown> },
      alignment: { horizontal: "center" },
    });
  }

  return ws;
}

// ── Hoja Capacidades ───────────────────────────────────────────────────────

function buildCapacidadesSheet(payload: PrintPayload): XLSX.WorkSheet {
  const headers = ["Fecha", "Turno", "Capacidad (h)", "Horas planificadas", "Libre (h)", "Carga (%)"];
  const rows: unknown[][] = payload.blocks.map((b) => [
    b.fecha,
    b.turnoLabel,
    b.capacidadHoras,
    b.totalHoras,
    Math.max(0, b.capacidadHoras - b.totalHoras),
    b.pctCarga,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  autoWidths(ws, [headers, ...rows]);
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  return ws;
}

// ============================================================
// Función principal
// ============================================================

/**
 * Genera y descarga el Excel de planificación.
 *
 * @param payload Resultado de buildPrintPayload()
 */
export function exportPlanificacionExcel(payload: PrintPayload): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildResumenSheet(payload), "Resumen");
  XLSX.utils.book_append_sheet(wb, buildPlanSheet(payload), "Plan");
  XLSX.utils.book_append_sheet(wb, buildCapacidadesSheet(payload), "Capacidades");

  const { meta } = payload;
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

  XLSX.writeFile(wb, `plan-impresion-${tipo}-${dateStr}-${mq}-${src}.xlsx`);
}
