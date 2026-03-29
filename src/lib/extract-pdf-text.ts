let workerConfigured = false;

async function ensurePdfWorker(
  GlobalWorkerOptions: typeof import("pdfjs-dist").GlobalWorkerOptions
): Promise<void> {
  if (typeof window === "undefined" || workerConfigured) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

function textFromContentItem(item: unknown): string {
  if (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string"
  ) {
    return (item as { str: string }).str;
  }
  return "";
}

/** Extrae todo el texto de un PDF en el cliente (sin enviar el binario al servidor). */
export async function extractTextFromPDF(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  await ensurePdfWorker(GlobalWorkerOptions);

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(textFromContentItem)
      .filter(Boolean)
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
}
