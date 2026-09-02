"use client";

import { ALBARANES_OCR_MAX_PAGES } from "@/lib/albaranes-ocr";

/** Payload que viaja a POST /api/gemini/albaranes-ocr */
export type AlbaranOcrFilePart = {
  filename: string;
  page: number | null;
  mime: "image/jpeg" | "application/pdf";
  data: string;
};

const MAX_PDF_BYTES = 2_400_000;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.62;

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isImage(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x2000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function compressImageFile(file: File): Promise<AlbaranOcrFilePart> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo comprimir la imagen.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG vacío."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
  const data = uint8ToBase64(new Uint8Array(await blob.arrayBuffer()));
  return {
    filename: file.name,
    page: 1,
    mime: "image/jpeg",
    data,
  };
}

async function pdfToParts(file: File): Promise<AlbaranOcrFilePart[]> {
  if (file.size <= MAX_PDF_BYTES) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return [
      {
        filename: file.name,
        page: null,
        mime: "application/pdf",
        data: uint8ToBase64(bytes),
      },
    ];
  }

  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const n = Math.min(doc.numPages, ALBARANES_OCR_MAX_PAGES);
    const parts: AlbaranOcrFilePart[] = [];
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Página PDF vacía."))),
          "image/jpeg",
          JPEG_QUALITY
        );
      });
      parts.push({
        filename: file.name,
        page: i,
        mime: "image/jpeg",
        data: uint8ToBase64(new Uint8Array(await blob.arrayBuffer())),
      });
    }
    if (parts.length === 0) {
      throw new Error("No se pudieron leer páginas del PDF.");
    }
    return parts;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `El PDF es demasiado grande (${Math.round(file.size / 1024)} KB) y no se pudo paginar. Divide el PDF o fotografía cada albarán. ${msg}`
    );
  }
}

export async function filesToAlbaranOcrParts(
  files: File[]
): Promise<AlbaranOcrFilePart[]> {
  const parts: AlbaranOcrFilePart[] = [];
  for (const file of files) {
    if (isPdf(file)) {
      parts.push(...(await pdfToParts(file)));
    } else if (isImage(file)) {
      parts.push(await compressImageFile(file));
    } else {
      throw new Error(
        `Formato no soportado: ${file.name}. Usa PDF, JPG o PNG.`
      );
    }
    if (parts.length >= ALBARANES_OCR_MAX_PAGES) break;
  }
  return parts.slice(0, ALBARANES_OCR_MAX_PAGES);
}
