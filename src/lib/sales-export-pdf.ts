import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import {
  patchWindowGCSForHtml2Canvas,
  prepareClonedDocumentForPdfCapture,
} from "@/lib/html2canvas-pdf-fix";

export type SalesPdfExportMode = "dashboard" | "full";

function addCanvasSliced(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  opts: {
    x: number;
    y0: number;
    renderW: number;
    renderH: number;
    pageW: number;
    pageH: number;
    margin: number;
  }
): void {
  const { x, y0, renderW, renderH, pageW, pageH, margin } = opts;
  const usableHPage1 = pageH - y0 - margin;
  const usableHOther = pageH - 2 * margin;
  const pxPerMmY = canvas.height / renderH;

  let srcYPx = 0;
  let heightLeftMm = renderH;
  let pageIndex = 0;

  while (heightLeftMm > 0.5) {
    const usableMm = pageIndex === 0 ? usableHPage1 : usableHOther;
    const sliceMmH = Math.min(usableMm, heightLeftMm);
    const slicePxH = Math.max(1, Math.round(sliceMmH * pxPerMmY));

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(slicePxH, canvas.height - Math.round(srcYPx));
    if (slice.height < 1) break;

    const sliceCtx = slice.getContext("2d");
    if (!sliceCtx) break;
    sliceCtx.drawImage(
      canvas,
      0,
      Math.round(srcYPx),
      canvas.width,
      slice.height,
      0,
      0,
      canvas.width,
      slice.height
    );

    const data = slice.toDataURL("image/png", 1.0);
    const yPos = pageIndex === 0 ? y0 : margin;
    const sliceDisplayMmH = slice.height / pxPerMmY;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(data, "PNG", x, yPos, renderW, sliceDisplayMmH);

    srcYPx += slice.height;
    heightLeftMm -= sliceDisplayMmH;
    pageIndex++;
  }
}

export async function exportSalesReportPdf(opts: {
  element: HTMLElement;
  mode: SalesPdfExportMode;
  title: string;
  filename: string;
}): Promise<void> {
  // Give React one more frame to finish any pending renders
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 200));

  // Patch window.getComputedStyle BEFORE html2canvas runs (it uses the global window)
  const restoreGCS = patchWindowGCSForHtml2Canvas();

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(opts.element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: 1200,
      width: opts.element.scrollWidth,
      onclone: (docClone, el) => {
        prepareClonedDocumentForPdfCapture(docClone);
        (el as HTMLElement).style.cssText =
          "width:1200px;max-width:none;padding:16px;background:#fff;box-sizing:border-box";
      },
    });
  } finally {
    restoreGCS();
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Header
  pdf.setFontSize(11);
  pdf.setTextColor(0, 33, 71);
  pdf.setFont("helvetica", "bold");
  pdf.text(opts.title, margin, margin + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.text(
    opts.mode === "dashboard"
      ? "Resumen gráficos (sin tabla operativa)"
      : "Informe completo con tabla operativa",
    margin,
    margin + 10
  );

  const contentTop = margin + 14;
  const imgW = pageW - 2 * margin;
  const imgH = (canvas.height / canvas.width) * imgW;

  addCanvasSliced(pdf, canvas, {
    x: margin,
    y0: contentTop,
    renderW: imgW,
    renderH: imgH,
    pageW,
    pageH,
    margin,
  });

  pdf.save(opts.filename);
}
