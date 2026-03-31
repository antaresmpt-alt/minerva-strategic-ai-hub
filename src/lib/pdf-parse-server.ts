import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PDFParse } from "pdf-parse";

let workerReady = false;

/**
 * El worker debe ser **la misma versión** que el `pdfjs-dist` que usa `pdf-parse`
 * (p. ej. 5.4.x anidado en `pdf-parse/node_modules`). Si apuntamos al
 * `pdfjs-dist` raíz del proyecto (p. ej. 5.5.x), falla: API y Worker no coinciden.
 */
function resolvePdfWorkerPath(): string {
  const nested = path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );
  const hoisted = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );
  if (fs.existsSync(nested)) return nested;
  return hoisted;
}

/**
 * Apunta pdf.js al worker en disco. Sin esto, el bundler resuelve mal la ruta.
 */
export function ensurePdfParseWorker(): void {
  if (workerReady) return;
  const workerPath = resolvePdfWorkerPath();
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerReady = true;
}
