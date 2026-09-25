/**
 * Bloque 15.1d — export PDF / Excel de la bandeja filtrada de stock artículos.
 */

import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

import type {
  StockArticuloEstadoDerivado,
  StockArticuloEstadoProceso,
  StockArticuloUnidad,
} from "@/types/prod-stock-articulos";

export type StockArticulosExportRow = {
  cliente: string | null;
  referencia_cliente: string | null;
  referencia_codigo: string;
  referencia_descripcion: string | null;
  estado_proceso: StockArticuloEstadoProceso | string;
  unidad: StockArticuloUnidad | string;
  cantidad_fisica: number;
  cantidad_libre: number;
  cantidad_reservada_total: number;
  bultos: number | null;
  unidades_por_bulto: number | null;
  pico: number | null;
  palets: number | null;
  caja_embalaje: string | null;
  ubicacion_fisica: string | null;
  ot_origen: string | null;
  estado_derivado: StockArticuloEstadoDerivado | string;
  es_critico?: boolean;
};

export type StockArticulosExportMeta = {
  /** Resumen de filtros activos (texto libre). */
  filtrosLabel: string;
  /** Email o identificador del usuario que exporta. */
  usuario: string;
};

const PROCESO_LABEL: Record<string, string> = {
  terminado: "Terminado",
  impreso: "Impreso",
  troquelado: "Troquelado",
  otro: "Otro",
};

const ESTADO_LABEL: Record<string, string> = {
  disponible: "Disponible",
  parcial: "Parcial",
  reservado: "Reservado",
  agotado: "Agotado",
};

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function numEs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("es-ES");
}

function stampFile(): string {
  return new Date().toISOString().slice(0, 10);
}

function excelRows(rows: StockArticulosExportRow[]) {
  return rows.map((r) => ({
    Cliente: r.cliente?.trim() || "",
    "Ref. cliente": r.referencia_cliente?.trim() || "",
    Minerva: r.referencia_codigo,
    Descripción: r.referencia_descripcion?.trim() || "",
    Proceso: PROCESO_LABEL[r.estado_proceso] ?? r.estado_proceso,
    Unidad: r.unidad,
    Físico: r.cantidad_fisica,
    Libre: r.cantidad_libre,
    Reservado: r.cantidad_reservada_total,
    Bultos: r.bultos ?? "",
    "Uds/bulto": r.unidades_por_bulto ?? "",
    Pico: r.pico ?? "",
    Palets: r.palets ?? "",
    Embalaje: r.caja_embalaje?.trim() || "",
    Ubicación: r.ubicacion_fisica?.trim() || "",
    "OT origen": r.ot_origen?.trim() || "",
    Estado: ESTADO_LABEL[r.estado_derivado] ?? r.estado_derivado,
    Crítico: r.es_critico ? "sí" : "",
  }));
}

export function exportStockArticulosExcel(
  rows: StockArticulosExportRow[],
  meta: StockArticulosExportMeta
): void {
  const generacion = new Date().toLocaleString("es-ES");
  const cabecera = [
    { Campo: "Informe", Valor: "Stock de artículos (bandeja filtrada)" },
    { Campo: "Fecha", Valor: generacion },
    { Campo: "Usuario", Valor: meta.usuario || "—" },
    { Campo: "Filtros", Valor: meta.filtrosLabel || "sin filtros" },
    { Campo: "Filas", Valor: rows.length },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cabecera),
    "Cabecera"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(excelRows(rows)),
    "Stock"
  );
  XLSX.writeFile(wb, `stock-articulos-${stampFile()}.xlsx`);
}

export function exportStockArticulosPdf(
  rows: StockArticulosExportRow[],
  meta: StockArticulosExportMeta
): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const generacion = new Date().toLocaleString("es-ES");

  doc.setTextColor(0, 33, 71);
  doc.setFontSize(13);
  doc.text("Stock de artículos — Minerva Hub", 10, 12);
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Bandeja filtrada · ${rows.length} lote(s) · ${generacion}`,
    10,
    18
  );
  doc.text(`Usuario: ${meta.usuario || "—"}`, 10, 23);
  doc.text(`Filtros: ${meta.filtrosLabel || "sin filtros"}`, 10, 28);

  const head = [
    [
      "Cliente",
      "Ref. cli.",
      "Minerva",
      "Descripción",
      "Proceso",
      "Físico",
      "Libre",
      "Reserv.",
      "Bultos",
      "Ubic.",
      "Estado",
    ],
  ];
  const body = rows.map((r) => [
    cell(r.cliente),
    cell(r.referencia_cliente),
    cell(r.referencia_codigo),
    cell(r.referencia_descripcion),
    `${PROCESO_LABEL[r.estado_proceso] ?? r.estado_proceso} · ${r.unidad}`,
    numEs(r.cantidad_fisica),
    numEs(r.cantidad_libre),
    numEs(r.cantidad_reservada_total),
    numEs(r.bultos),
    cell(r.ubicacion_fisica),
    `${ESTADO_LABEL[r.estado_derivado] ?? r.estado_derivado}${
      r.es_critico ? " · crítico" : ""
    }`,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    styles: { fontSize: 6.5, cellPadding: 1, overflow: "linebreak" },
    headStyles: { fontSize: 6.5, fillColor: [0, 33, 71], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { cellWidth: 36 },
      4: { cellWidth: 22 },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 14, halign: "right" },
      8: { cellWidth: 14, halign: "right" },
      9: { cellWidth: 16 },
      10: { cellWidth: 22 },
    },
    margin: { left: 8, right: 8 },
  });

  doc.save(`stock-articulos-${stampFile()}.pdf`);
}
