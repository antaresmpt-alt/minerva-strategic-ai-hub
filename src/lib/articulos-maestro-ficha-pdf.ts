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
import {
  DEFAULT_REGISTRO_SANITARIO_MINERVA,
  normalizeClienteNombre,
  type ProdClienteFichaRow,
} from "@/types/prod-cliente-ficha";
import type { DefaultsProcesoMaestro } from "@/types/prod-referencias";
import {
  calcUdsPorPalet,
  type ProdReferenciaRow,
} from "@/types/prod-referencias";

const NAVY: [number, number, number] = [0, 33, 71];
const GOLD: [number, number, number] = [198, 156, 43];
const SLATE: [number, number, number] = [100, 116, 139];

/** Pie / cabezal como ficha Access (Adobe Scan 7 sep 2026). */
const LETTERHEAD = {
  address: "C/ Cabrera, 13-15 · 08192 Sant Quirze del Vallès (Barcelona) · SPAIN",
  contact: "Tel. 93 711 30 61 · www.minervaglobal.es · minerva@minervaglobal.es",
  /** Logo oficial largo (MINERVA + símbolo + PACKAGING & PRINT CREATORS). */
  logoPath: "/images/brand-minerva-logo-largo.png",
  /** Licencia FSC de Minerva (cabezal ficha). */
  fscLicense: "FSC® C142407",
} as const;

function fmtPeso(row: ProdReferenciaRow): string | null {
  return row.peso_unitario != null ? `${row.peso_unitario} g` : null;
}

function fmtTintasEco(row: ProdReferenciaRow): string {
  return row.tintas_ecologicas ? "Sí" : "No";
}

function fmtUdsPorPalet(row: ProdReferenciaRow): string {
  const n = calcUdsPorPalet(
    row.unidades_por_embalaje_habitual,
    row.bultos_por_palet_habitual,
  );
  return n != null ? String(n) : "—";
}

function fmtBultosPorPalet(row: ProdReferenciaRow): string {
  return row.bultos_por_palet_habitual != null
    ? String(row.bultos_por_palet_habitual)
    : "—";
}

function publicAdjuntoUrl(storagePath: string): string {
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${REFERENCIAS_ADJUNTOS_BUCKET}/${storagePath.replace(/^\//, "")}`;
}

type PdfImageAsset = { dataUrl: string; format: "JPEG" | "PNG" };

/** Preview embebido en ficha: ~900px max, JPEG ~0.72 (ligero). */
const PREVIEW_MAX_PX = 900;
const PREVIEW_JPEG_QUALITY = 0.72;

function canvasToJpegAsset(canvas: HTMLCanvasElement): PdfImageAsset | null {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", PREVIEW_JPEG_QUALITY);
    if (!dataUrl || dataUrl.length < 32) return null;
    return { dataUrl, format: "JPEG" };
  } catch {
    return null;
  }
}

function drawScaledToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
): HTMLCanvasElement | null {
  if (srcW <= 0 || srcH <= 0) return null;
  const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(srcW, srcH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Convierte BMP/WEBP/GIF/JPG/PNG a preview JPEG reducido. */
async function rasterizeImageBlob(blob: Blob): Promise<PdfImageAsset | null> {
  try {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image load failed"));
        el.src = objectUrl;
      });
      const canvas = drawScaledToCanvas(
        img,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
      );
      return canvas ? canvasToJpegAsset(canvas) : null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** 1ª página del PDF adjunto → preview JPEG (pdfjs). */
async function rasterizePdfBlob(blob: Blob): Promise<PdfImageAsset | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const data = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.6,
      PREVIEW_MAX_PX / Math.max(base.width, base.height, 1),
    );
    const viewport = page.getViewport({ scale: Math.max(0.6, scale) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvasToJpegAsset(canvas);
  } catch {
    return null;
  }
}

/**
 * Carga adjunto (imagen o PDF) y genera preview embebible en la ficha.
 * PDF → raster 1ª página; imagen → downscale JPEG.
 */
async function loadPdfImageAsset(
  pathOrUrl: string | null | undefined,
): Promise<PdfImageAsset | null> {
  const raw = String(pathOrUrl ?? "").trim();
  if (!raw) return null;
  try {
    const url = publicAdjuntoUrl(raw);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const looksPdf =
      isPdfStoragePath(raw) ||
      blob.type === "application/pdf" ||
      blob.type === "application/x-pdf";
    if (looksPdf) return await rasterizePdfBlob(blob);
    if (
      isImageStoragePath(raw) ||
      blob.type.startsWith("image/")
    ) {
      return await rasterizeImageBlob(blob);
    }
    // MIME raro: intentar PDF y luego imagen
    const asPdf = await rasterizePdfBlob(blob);
    if (asPdf) return asPdf;
    return await rasterizeImageBlob(blob);
  } catch {
    return null;
  }
}

function addImageContain(
  doc: jsPDF,
  asset: PdfImageAsset,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): void {
  const props = doc.getImageProperties(asset.dataUrl);
  const iw = Number(props.width) || maxW;
  const ih = Number(props.height) || maxH;
  const r = Math.min(maxW / iw, maxH / ih);
  const w = Math.max(1, iw * r);
  const h = Math.max(1, ih * r);
  const ox = x + (maxW - w) / 2;
  const oy = y + (maxH - h) / 2;
  doc.addImage(asset.dataUrl, asset.format, ox, oy, w, h);
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

async function loadLogoAsset(): Promise<PdfImageAsset | null> {
  try {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    const url = `${base}${LETTERHEAD.logoPath}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Mantener PNG (mejor para logo con transparencia); downscale suave.
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("logo load failed"));
        el.src = objectUrl;
      });
      const canvas = drawScaledToCanvas(
        img,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
      );
      if (!canvas) return null;
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl.length < 32) return null;
      return { dataUrl, format: "PNG" };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function drawHeader(
  doc: jsPDF,
  row: ProdReferenciaRow,
  modo: ArticuloFichaPdfModo,
  logo: PdfImageAsset | null,
  registroSanitario?: string | null,
): number {
  // Logo oficial largo + estadillo debajo (no franja navy / logo app)
  let y = 8;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo.dataUrl);
      const maxW = 95;
      const maxH = 18;
      const iw = Number(props.width) || maxW;
      const ih = Number(props.height) || maxH;
      const r = Math.min(maxW / iw, maxH / ih);
      const w = Math.max(1, iw * r);
      const h = Math.max(1, ih * r);
      doc.addImage(logo.dataUrl, logo.format, 12, y, w, h);
      y += h + 3;
    } catch {
      y = 12;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text("MINERVA", 12, 14);
    y = 16;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(LETTERHEAD.address, 12, y + 3);
  doc.text(LETTERHEAD.contact, 12, y + 7);

  const rgs =
    registroSanitario?.trim() || DEFAULT_REGISTRO_SANITARIO_MINERVA;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text(`${rgs} - ${LETTERHEAD.fscLicense}`, 12, y + 12);

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    modo === "cliente" ? "FICHA TÉCNICA · CLIENTE" : "FICHA TÉCNICA · INTERNO",
    198,
    y + 3,
    { align: "right" },
  );
  doc.setFontSize(14);
  doc.text(txt(row.codigo), 198, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(txt(row.referencia_cliente), 198, y + 15, { align: "right" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  const lineY = y + 20;
  doc.line(12, lineY, 198, lineY);
  doc.setTextColor(0, 0, 0);
  return lineY + 6;
}

function drawFooter(doc: jsPDF, modo: ArticuloFichaPdfModo): void {
  const generated = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
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
    doc.text(`${p} / ${pageCount}`, 198, 291, { align: "right" });
  }
}

/** Huecos fijos / previews de adjuntos (imagen o 1ª pág. PDF). El marco no crece. */
function drawFotoPlaceholders(
  doc: jsPDF,
  row: ProdReferenciaRow,
  y: number,
  assets?: { producto: PdfImageAsset | null; troquel: PdfImageAsset | null },
  opts?: { includeTroquel?: boolean },
): number {
  const includeTroquel = opts?.includeTroquel !== false;
  const boxW = includeTroquel ? 85 : 182;
  const boxH = includeTroquel ? 42 : 52;
  const labelH = 5;
  const pad = 2;
  const imgX = (baseX: number) => baseX + pad;
  const imgY = y + labelH + 1;
  const imgW = boxW - pad * 2;
  const imgH = boxH - labelH - pad - 1;
  const hasProd = Boolean(row.foto_producto_path?.trim());
  const hasTroq = Boolean(row.foto_troquel_path?.trim());
  doc.setDrawColor(200, 200, 200);
  doc.rect(14, y, boxW, boxH);
  if (includeTroquel) {
    doc.rect(111, y, boxW, boxH);
  }
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text("Foto producto", 16, y + 4);
  if (assets?.producto) {
    try {
      addImageContain(doc, assets.producto, imgX(14), imgY, imgW, imgH);
    } catch {
      doc.text(hasProd ? "Adjunto no embebible" : "Pendiente de cargar", 16, y + 12);
    }
  } else {
    doc.text(
      hasProd ? "Adjunto no embebible" : "Pendiente de cargar",
      16,
      y + 12,
    );
  }
  if (includeTroquel) {
    doc.text("Troquel", 113, y + 4);
    if (assets?.troquel) {
      try {
        addImageContain(doc, assets.troquel, imgX(111), imgY, imgW, imgH);
      } catch {
        doc.text(hasTroq ? "Adjunto no embebible" : "Pendiente de cargar", 113, y + 12);
      }
    } else {
      doc.text(
        hasTroq ? "Adjunto no embebible" : "Pendiente de cargar",
        113,
        y + 12,
      );
    }
  }
  doc.setTextColor(0, 0, 0);
  return y + boxH + 6;
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
  const pesoCliente = fmtPeso(row);
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
      ["Tintas ecológicas", fmtTintasEco(row)],
      ["Acabados", txt(row.acabado_habitual)],
      ["Medidas (mm)", fmtMm(row)],
      ["Tipo fondo", txt(row.tipo_fondo)],
      ["Troquel (código)", txt(row.troquel_habitual) === "—" ? "Pendiente de cargar" : txt(row.troquel_habitual)],
      ["Engomado (tipo)", txt(row.tipo_engomado_habitual)],
      ...(pesoCliente ? ([["Peso", pesoCliente]] as Array<[string, string]>) : []),
    ]) + 3;

  y = sectionTitle(doc, "Logística", y);
  const temp = clienteFicha?.temperatura_conservacion;
  const pesoLog = fmtPeso(row);
  y =
    kvTable(doc, y, [
      ["Temperatura conservación", txt(temp)],
      ...(pesoLog ? ([["Peso", pesoLog]] as Array<[string, string]>) : []),
      ["Ref. / medida embalaje", txt(row.caja_embalaje_habitual)],
      [
        "Unidades por caja",
        row.unidades_por_embalaje_habitual != null
          ? String(row.unidades_por_embalaje_habitual)
          : "—",
      ],
      ["Bultos por palet", fmtBultosPorPalet(row)],
      ["Uds × palet", fmtUdsPorPalet(row)],
    ]) + 3;

  if (row.notas?.trim()) {
    y = sectionTitle(doc, "Observaciones", y);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(row.notas.trim(), 182);
    doc.text(lines.slice(0, 5), 14, y);
    y += Math.min(lines.length, 5) * 4 + 2;
  }

  if (y > 220) {
    doc.addPage();
    y = 18;
  }
  y = drawFotoPlaceholders(doc, row, y, assets, { includeTroquel: false });
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
  const pesoMinerva = fmtPeso(row);
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
      ...(pesoMinerva
        ? ([["Peso", pesoMinerva]] as Array<[string, string]>)
        : []),
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
      ["Poses", txt(row.poses_habitual)],
      ["Tintas", txt(row.tintas_habituales)],
      ["Tintas ecológicas", fmtTintasEco(row)],
      ["Acabado", txt(row.acabado_habitual)],
      ["Engomado (tipo)", txt(row.tipo_engomado_habitual)],
      ["Caja embalaje", txt(row.caja_embalaje_habitual)],
      [
        "Uds / caja",
        row.unidades_por_embalaje_habitual != null
          ? String(row.unidades_por_embalaje_habitual)
          : "—",
      ],
      ["Bultos / palet", fmtBultosPorPalet(row)],
      ["Uds × palet", fmtUdsPorPalet(row)],
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

  if (y > 220) {
    doc.addPage();
    y = 18;
  }
  y = sectionTitle(doc, "Fotos / adjuntos", y);
  drawFotoPlaceholders(doc, row, y, assets, { includeTroquel: true });
  return y;
}

/**
 * Genera PDF A4. Por defecto modo minerva + descarga.
 * Embebe preview de adjuntos (imagen o 1ª página PDF, JPEG reducido).
 */
export async function exportArticuloFichaPdf(
  row: ProdReferenciaRow,
  options?: ExportArticuloFichaPdfOptions,
): Promise<jsPDF> {
  const modo: ArticuloFichaPdfModo = options?.modo ?? "minerva";
  const [producto, troquel, logo] = await Promise.all([
    loadPdfImageAsset(row.foto_producto_path),
    loadPdfImageAsset(row.foto_troquel_path),
    loadLogoAsset(),
  ]);
  const assets = { producto, troquel };
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const rgsHeader = options?.clienteFicha?.registro_sanitario ?? null;
  const y = drawHeader(doc, row, modo, logo, rgsHeader);
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
    const [producto, troquel, logo] = await Promise.all([
      loadPdfImageAsset(row.foto_producto_path),
      loadPdfImageAsset(row.foto_troquel_path),
      loadLogoAsset(),
    ]);
    const y = drawHeader(
      doc,
      row,
      "cliente",
      logo,
      clienteFichaByCliente.get(normalizeClienteNombre(row.cliente))
        ?.registro_sanitario ?? null,
    );
    buildClienteBody(
      doc,
      row,
      clienteFichaByCliente.get(normalizeClienteNombre(row.cliente)) ?? null,
      y,
      { producto, troquel },
    );
  }
  drawFooter(doc, "cliente");
  const safe =
    filename ??
    `fichas-cliente-${(clienteKey || "lote").replace(/[^\w.-]+/g, "_").slice(0, 40)}.pdf`;
  doc.save(safe);
}
