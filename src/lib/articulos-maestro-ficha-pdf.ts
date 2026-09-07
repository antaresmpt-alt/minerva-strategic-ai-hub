/**
 * Ficha técnica de artículo — 1 hoja A4.
 * Modo `minerva` (interno: habituales + promedios) | `cliente` (como Access/Blanxart).
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { buildMaestroPromediosPanel } from "@/lib/maestro-prefill";
import {
  isImageStoragePath,
  isPdfStoragePath,
  REFERENCIAS_ADJUNTOS_BUCKET,
} from "@/lib/prod-referencia-adjuntos";
import { normalizeClienteNombre } from "@/types/prod-cliente-ficha";
import type { ProdClienteFichaRow } from "@/types/prod-cliente-ficha";
import type { DefaultsProcesoMaestro } from "@/types/prod-referencias";
import type { ProdReferenciaRow } from "@/types/prod-referencias";

const NAVY: [number, number, number] = [0, 33, 71];
const GOLD: [number, number, number] = [198, 156, 43];
const SLATE: [number, number, number] = [100, 116, 139];

function publicAdjuntoUrl(storagePath: string): string {
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${REFERENCIAS_ADJUNTOS_BUCKET}/${storagePath.replace(/^\//, "")}`;
}

type PdfImageAsset = { dataUrl: string; format: "JPEG" | "PNG" };

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Convierte BMP/WEBP/GIF/etc. a PNG data URL para jsPDF. */
async function rasterToPngDataUrl(blob: Blob): Promise<string | null> {
  try {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image load failed"));
        el.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      if (canvas.width <= 0 || canvas.height <= 0) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function loadPdfImageAsset(
  pathOrUrl: string | null | undefined,
): Promise<PdfImageAsset | null> {
  const raw = String(pathOrUrl ?? "").trim();
  if (!raw || !isImageStoragePath(raw)) return null;
  try {
    const url = publicAdjuntoUrl(raw);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const isPng = /\.png(\?|$)/i.test(raw) || blob.type === "image/png";
    const isJpeg =
      /\.jpe?g(\?|$)/i.test(raw) ||
      blob.type === "image/jpeg" ||
      blob.type === "image/jpg";
    if (isPng || isJpeg) {
      return {
        dataUrl: await blobToDataUrl(blob),
        format: isPng ? "PNG" : "JPEG",
      };
    }
    const png = await rasterToPngDataUrl(blob);
    if (!png) return null;
    return { dataUrl: png, format: "PNG" };
  } catch {
    return null;
  }
}

export type ArticuloFichaPdfModo = "minerva" | "cliente";

export type ExportArticuloFichaPdfOptions = {
  modo?: ArticuloFichaPdfModo;
  /** Defaults RGS / temp a nivel cliente (modo cliente). */
  clienteFicha?: ProdClienteFichaRow | null;
  /** Si false, no descarga (útil para lote). Default true. */
  save?: boolean;
  /** Nombre de archivo override. */
  filename?: string;
};

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
      0: { cellWidth: 52, fontStyle: "bold", textColor: SLATE },
      1: { cellWidth: 134 },
    },
    margin: { left: 12, right: 12 },
    tableWidth: 186,
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? startY;
}

function drawHeader(
  doc: jsPDF,
  row: ProdReferenciaRow,
  modo: ArticuloFichaPdfModo,
): number {
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
  doc.text(
    modo === "cliente"
      ? "Ficha técnica · Cliente"
      : "Ficha técnica de artículo · Interno",
    12,
    16,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(txt(row.codigo), 198, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(txt(row.referencia_cliente), 198, 17, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return 28;
}

function drawFooter(doc: jsPDF, modo: ArticuloFichaPdfModo): void {
  const generated = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(12, 287, 198, 287);
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(
    `Generado ${generated} · Minerva Hub · ${modo === "cliente" ? "PDF cliente" : "PDF interno"}`,
    12,
    291,
  );
  doc.text("1 / 1", 198, 291, { align: "right" });
}

/** Huecos / imágenes adjuntas. */
function drawFotoPlaceholders(
  doc: jsPDF,
  row: ProdReferenciaRow,
  y: number,
  assets?: { producto: PdfImageAsset | null; troquel: PdfImageAsset | null },
): number {
  const hasProd = Boolean(row.foto_producto_path?.trim());
  const hasTroq = Boolean(row.foto_troquel_path?.trim());
  doc.setDrawColor(200, 200, 200);
  doc.rect(14, y, 85, 42);
  doc.rect(111, y, 85, 42);
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text("Foto producto", 16, y + 5);
  if (assets?.producto) {
    try {
      doc.addImage(assets.producto.dataUrl, assets.producto.format, 16, y + 7, 80, 32);
    } catch {
      doc.text(hasProd ? "Imagen no embebible" : "Pendiente de cargar", 16, y + 12);
    }
  } else {
    doc.text(
      hasProd
        ? isPdfStoragePath(row.foto_producto_path)
          ? "PDF adjunto (abrir en Hub)"
          : "Pendiente de cargar"
        : "Pendiente de cargar",
      16,
      y + 12,
    );
  }
  doc.text("Perfil / foto troquel", 113, y + 5);
  if (assets?.troquel) {
    try {
      doc.addImage(assets.troquel.dataUrl, assets.troquel.format, 113, y + 7, 80, 32);
    } catch {
      doc.text(hasTroq ? "Imagen no embebible" : "Pendiente de cargar", 113, y + 12);
    }
  } else {
    doc.text(
      hasTroq
        ? isPdfStoragePath(row.foto_troquel_path)
          ? "PDF adjunto (abrir en Hub)"
          : "Pendiente de cargar"
        : "Pendiente de cargar",
      113,
      y + 12,
    );
  }
  doc.setTextColor(0, 0, 0);
  return y + 48;
}

function buildClienteBody(
  doc: jsPDF,
  row: ProdReferenciaRow,
  clienteFicha: ProdClienteFichaRow | null | undefined,
  startY: number,
  assets?: { producto: PdfImageAsset | null; troquel: PdfImageAsset | null },
): number {
  let y = startY;
  y = sectionTitle(doc, "Información general", y);
  y =
    kvTable(doc, y, [
      ["Cliente", txt(row.cliente)],
      ["Tipo producto", txt(row.tipo_producto)],
      ["Código Minerva", txt(row.codigo)],
      ["Código artículo / ref. cliente", txt(row.referencia_cliente)],
      ["Descripción", txt(row.descripcion)],
      ["Material", txt(row.material_habitual)],
      [
        "Gramaje",
        row.gramaje_habitual != null ? `${row.gramaje_habitual} g/m²` : "—",
      ],
      [
        "FSC",
        row.fsc
          ? `Sí${row.fsc_fecha_validacion ? ` · ${row.fsc_fecha_validacion}` : ""}`
          : "No",
      ],
      ["Tintas", txt(row.tintas_habituales)],
      ["Acabados", txt(row.acabado_habitual)],
      ["Medidas (mm)", fmtMm(row)],
      ["Tipo fondo", txt(row.tipo_fondo)],
      ["Troquel (código)", txt(row.troquel_habitual) === "—" ? "Pendiente de cargar" : txt(row.troquel_habitual)],
      [
        "Perfil / foto troquel",
        row.foto_troquel_path?.trim()
          ? row.foto_troquel_path
          : "Pendiente de cargar",
      ],
      ["Engomado (tipo)", txt(row.tipo_engomado_habitual)],
    ]) + 3;

  y = sectionTitle(doc, "Logística", y);
  const rgs = clienteFicha?.registro_sanitario;
  const temp = clienteFicha?.temperatura_conservacion;
  y =
    kvTable(doc, y, [
      ["Temperatura conservación", txt(temp)],
      ["Registro sanitario", txt(rgs)],
      [
        "Peso unitario",
        row.peso_unitario != null
          ? `${row.peso_unitario} g`
          : "Pendiente 1ª producción",
      ],
      ["Ref. / medida embalaje", txt(row.caja_embalaje_habitual)],
      [
        "Unidades por caja",
        row.unidades_por_embalaje_habitual != null
          ? String(row.unidades_por_embalaje_habitual)
          : "—",
      ],
    ]) + 3;

  if (row.notas?.trim()) {
    y = sectionTitle(doc, "Observaciones", y);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(row.notas.trim(), 182);
    doc.text(lines.slice(0, 5), 14, y);
    y += Math.min(lines.length, 5) * 4 + 2;
  }

  y = drawFotoPlaceholders(doc, row, y, assets);
  return y;
}

function buildMinervaBody(
  doc: jsPDF,
  row: ProdReferenciaRow,
  startY: number,
  assets?: { producto: PdfImageAsset | null; troquel: PdfImageAsset | null },
): number {
  let y = startY;
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
      ["Tipo fondo", txt(row.tipo_fondo)],
      [
        "Peso unitario",
        row.peso_unitario != null
          ? `${row.peso_unitario} g`
          : "Pendiente 1ª producción",
      ],
      [
        "FSC",
        row.fsc
          ? `Sí${row.fsc_fecha_validacion ? ` · ${row.fsc_fecha_validacion}` : ""}`
          : "No",
      ],
      [
        "Histórico OTs",
        row.total_repeticiones > 0
          ? `${row.total_repeticiones} · última ${txt(row.ultima_ot_numero)}`
          : "—",
      ],
    ]) + 4;

  y = sectionTitle(doc, "Sugerencias técnicas (habituales)", y);
  y =
    kvTable(doc, y, [
      ["Material", txt(row.material_habitual)],
      [
        "Gramaje",
        row.gramaje_habitual != null ? `${row.gramaje_habitual} g/m²` : "—",
      ],
      ["Troquel (código)", txt(row.troquel_habitual) === "—" ? "Pendiente de cargar" : txt(row.troquel_habitual)],
      [
        "Perfil / foto troquel",
        row.foto_troquel_path?.trim()
          ? row.foto_troquel_path
          : "Pendiente de cargar",
      ],
      ["Poses", txt(row.poses_habitual)],
      ["Tintas", txt(row.tintas_habituales)],
      ["Acabado", txt(row.acabado_habitual)],
      ["Engomado (tipo)", txt(row.tipo_engomado_habitual)],
      ["Caja embalaje", txt(row.caja_embalaje_habitual)],
      [
        "Uds / caja",
        row.unidades_por_embalaje_habitual != null
          ? String(row.unidades_por_embalaje_habitual)
          : "—",
      ],
      ["Ruta habitual", txt(row.ruta_habitual)],
    ]) + 4;

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
    if (metaRows.length > 0) y = kvTable(doc, y, metaRows) + 2;
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
    if (ctpKeys.length > 0) defRows.push(["CTP", ctpKeys.join(", ")]);
    if (guill?.patron_corte || guill?.tamano_final) {
      defRows.push([
        "Guillotina",
        [guill.patron_corte, guill.tamano_final].filter(Boolean).join(" · ") ||
          "—",
      ]);
    }
    y = kvTable(doc, y, defRows) + 3;
  }

  if (row.notas?.trim()) {
    if (y > 250) y = 250;
    y = sectionTitle(doc, "Notas", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(row.notas.trim(), 182);
    doc.text(lines.slice(0, 6), 14, y);
    y += Math.min(lines.length, 6) * 4 + 2;
  }

  if (y < 240) {
    y = sectionTitle(doc, "Fotos / adjuntos", y);
    drawFotoPlaceholders(doc, row, y, assets);
  }
  return y;
}

/**
 * Genera PDF A4. Por defecto modo minerva + descarga.
 * Embebe JPG/PNG de Storage; si el adjunto es PDF, deja nota «abrir en Hub».
 */
export async function exportArticuloFichaPdf(
  row: ProdReferenciaRow,
  options?: ExportArticuloFichaPdfOptions,
): Promise<jsPDF> {
  const modo: ArticuloFichaPdfModo = options?.modo ?? "minerva";
  const [producto, troquel] = await Promise.all([
    loadPdfImageAsset(row.foto_producto_path),
    loadPdfImageAsset(row.foto_troquel_path),
  ]);
  const assets = { producto, troquel };
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = drawHeader(doc, row, modo);
  if (modo === "cliente") {
    buildClienteBody(doc, row, options?.clienteFicha, y, assets);
  } else {
    buildMinervaBody(doc, row, y, assets);
  }
  drawFooter(doc, modo);

  const shouldSave = options?.save !== false;
  if (shouldSave) {
    const safeCode = String(row.codigo || "articulo")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 40);
    const suffix = modo === "cliente" ? "cliente" : "minerva";
    doc.save(
      options?.filename ?? `ficha-${suffix}-${safeCode}.pdf`,
    );
  }
  return doc;
}

/** Exporta varias fichas cliente en un único PDF multipágina. */
export async function exportArticulosFichaClienteLote(
  rows: readonly ProdReferenciaRow[],
  clienteFichaByCliente: Map<string, ProdClienteFichaRow>,
  filename?: string,
): Promise<void> {
  if (rows.length === 0) throw new Error("No hay artículos para exportar.");
  const first = rows[0]!;
  const clienteKey = normalizeClienteNombre(first.cliente);
  const doc = await exportArticuloFichaPdf(first, {
    modo: "cliente",
    clienteFicha: clienteFichaByCliente.get(clienteKey) ?? null,
    save: false,
  });
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    doc.addPage();
    const [producto, troquel] = await Promise.all([
      loadPdfImageAsset(row.foto_producto_path),
      loadPdfImageAsset(row.foto_troquel_path),
    ]);
    const y = drawHeader(doc, row, "cliente");
    buildClienteBody(
      doc,
      row,
      clienteFichaByCliente.get(normalizeClienteNombre(row.cliente)) ?? null,
      y,
      { producto, troquel },
    );
    drawFooter(doc, "cliente");
  }
  const safe =
    filename ??
    `fichas-cliente-${(clienteKey || "lote").replace(/[^\w.-]+/g, "_").slice(0, 40)}.pdf`;
  doc.save(safe);
}
