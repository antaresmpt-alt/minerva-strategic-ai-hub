/**
 * Ficha técnica de un artículo del Maestro — 1 hoja A4 vertical.
 * Incluye identidad, sugerencias habituales y promedios desde histórico.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { buildMaestroPromediosPanel } from "@/lib/maestro-prefill";
import type { DefaultsProcesoMaestro } from "@/types/prod-referencias";
import type { ProdReferenciaRow } from "@/types/prod-referencias";

const NAVY: [number, number, number] = [0, 33, 71];
const GOLD: [number, number, number] = [198, 156, 43];
const SLATE: [number, number, number] = [100, 116, 139];

function txt(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  return s.length > 0 ? s : "—";
}

function fmtMm(row: ProdReferenciaRow): string {
  const L = row.formato_largo_mm;
  const A = row.formato_ancho_mm;
  const F = row.formato_fondo_mm;
  if (L == null && A == null && F == null) return "—";
  return `${L ?? "—"} × ${A ?? "—"} × ${F ?? "—"} mm`;
}

function sectionTitle(doc: jsPDF, label: string, y: number): number {
  doc.setFillColor(...NAVY);
  doc.rect(12, y, 186, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), 14, y + 4.2);
  doc.setTextColor(0, 0, 0);
  return y + 9;
}

function kvTable(
  doc: jsPDF,
  startY: number,
  rows: Array<[string, string]>,
): number {
  autoTable(doc, {
    startY,
    body: rows,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 2 },
      overflow: "linebreak",
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold", textColor: SLATE },
      1: { cellWidth: 144 },
    },
    margin: { left: 12, right: 12 },
    tableWidth: 186,
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? startY;
}

/**
 * Genera y descarga PDF A4 (1 página) de la ficha del artículo.
 */
export function exportArticuloFichaPdf(row: ProdReferenciaRow): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generated = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  // Cabecera
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 22, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 22, 210, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("MINERVA", 12, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Ficha técnica de artículo", 12, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(txt(row.codigo), 198, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(txt(row.referencia_cliente), 198, 17, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 28;

  // Identidad
  y = sectionTitle(doc, "Identidad", y);
  y =
    kvTable(doc, y, [
      ["Código Minerva", txt(row.codigo)],
      ["Ref. cliente", txt(row.referencia_cliente)],
      ["Descripción", txt(row.descripcion)],
      ["Cliente", txt(row.cliente)],
      [
        "Tipo / subtipo",
        [row.tipo_producto, row.subtipo].filter(Boolean).join(" · ") || "—",
      ],
      ["Estado", row.activo ? "Activo" : "Inactivo"],
      ["Dimensiones", fmtMm(row)],
      ["FSC", row.fsc ? `Sí${row.fsc_fecha_validacion ? ` · ${row.fsc_fecha_validacion}` : ""}` : "No"],
      [
        "Histórico OTs",
        row.total_repeticiones > 0
          ? `${row.total_repeticiones} · última ${txt(row.ultima_ot_numero)}`
          : "—",
      ],
    ]) + 4;

  // Sugerencias habituales
  y = sectionTitle(doc, "Sugerencias técnicas (habituales)", y);
  y =
    kvTable(doc, y, [
      ["Material", txt(row.material_habitual)],
      ["Gramaje", row.gramaje_habitual != null ? `${row.gramaje_habitual} g/m²` : "—"],
      ["Troquel", txt(row.troquel_habitual)],
      ["Poses", txt(row.poses_habitual)],
      ["Tintas", txt(row.tintas_habituales)],
      ["Acabado", txt(row.acabado_habitual)],
      ["Engomado", txt(row.tipo_engomado_habitual)],
      ["Caja embalaje", txt(row.caja_embalaje_habitual)],
      [
        "Uds / caja",
        row.unidades_por_embalaje_habitual != null
          ? String(row.unidades_por_embalaje_habitual)
          : "—",
      ],
      ["Ruta habitual", txt(row.ruta_habitual)],
    ]) + 4;

  // Promedios
  const panel = buildMaestroPromediosPanel(row);
  y = sectionTitle(doc, "Promedios desde histórico", y);

  if (!panel.hasData) {
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(
      "Sin promedios calculados. Usa «Actualizar promedios» en el Maestro.",
      14,
      y + 2,
    );
    doc.setTextColor(0, 0, 0);
    y += 8;
  } else {
    if (panel.header) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(panel.header, 14, y);
      y += 4;
    }

    const metaRows: Array<[string, string]> = [];
    for (const line of [...panel.categoricos, ...panel.numericos]) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        metaRows.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
      } else {
        metaRows.push(["", line]);
      }
    }
    if (metaRows.length > 0) {
      y = kvTable(doc, y, metaRows) + 2;
    }

    if (panel.horas.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Proceso", "Prep / horas", "Millar (tiraje)"]],
        body: panel.horas.map((h) => [
          h.proceso,
          h.horas != null
            ? h.horasN != null
              ? `${h.horas} h (n=${h.horasN})${h.modo === "absolutas" ? " abs." : ""}`
              : `${h.horas} h`
            : "—",
          h.modo === "absolutas"
            ? "—"
            : h.millar != null
              ? h.millarN != null
                ? `${h.millar} (n=${h.millarN})`
                : String(h.millar)
              : "—",
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.4 },
        headStyles: {
          fillColor: NAVY,
          textColor: [255, 255, 255],
          fontSize: 7.5,
        },
        columnStyles: {
          0: { cellWidth: 36 },
          1: { cellWidth: 75 },
          2: { cellWidth: 75 },
        },
        margin: { left: 12, right: 12 },
        tableWidth: 186,
      });
      y =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? y;
      y += 4;
    }
  }

  // Defaults proceso (compacto)
  const defs = (row.defaults_proceso ?? {}) as DefaultsProcesoMaestro;
  const ctpKeys = defs.ctp
    ? Object.entries(defs.ctp)
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/^requiere_/, "").replace(/_/g, " "))
    : [];
  const guill = defs.guillotina;
  if (ctpKeys.length > 0 || guill?.patron_corte || guill?.tamano_final) {
    y = sectionTitle(doc, "Defaults por proceso", y);
    const defRows: Array<[string, string]> = [];
    if (ctpKeys.length > 0) {
      defRows.push(["CTP", ctpKeys.join(", ")]);
    }
    if (guill?.patron_corte || guill?.tamano_final) {
      defRows.push([
        "Guillotina",
        [guill.patron_corte, guill.tamano_final].filter(Boolean).join(" · ") ||
          "—",
      ]);
    }
    y = kvTable(doc, defRows.length ? y : y, defRows) + 3;
  }

  // Notas
  if (row.notas?.trim()) {
    if (y > 260) y = 260;
    y = sectionTitle(doc, "Notas", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(row.notas.trim(), 182);
    doc.text(lines.slice(0, 6), 14, y);
  }

  // Pie
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(12, 287, 198, 287);
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(`Generado ${generated} · Minerva Hub · Maestro de artículos`, 12, 291);
  doc.text("1 / 1", 198, 291, { align: "right" });

  const safeCode = String(row.codigo || "articulo")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 40);
  doc.save(`ficha-articulo-${safeCode}.pdf`);
}
