/**
 * pdfjs (usado por pdf-parse) espera APIs del navegador. En Node/Vercel no existen
 * por defecto; sin esto, el módulo revienta al cargarse con ReferenceError: DOMMatrix is not defined.
 */
import CSSMatrix from "dommatrix";

if (typeof globalThis.DOMMatrix === "undefined") {
  Object.assign(globalThis, {
    DOMMatrix: CSSMatrix,
  });
}
