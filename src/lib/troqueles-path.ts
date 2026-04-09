/**
 * Ruta plana: [base]\[num].pdf
 */
export function troquelPdfFullPath(pdfPath: string, numTroquel: string): string {
  const base = pdfPath.trim().replace(/[/\\]+$/, "");
  const file = `${String(numTroquel).trim()}.pdf`;
  if (!base) return file;
  if (base.startsWith("\\\\")) {
    return `${base}\\${file}`;
  }
  if (base.includes("/") && !/^[A-Za-z]:/.test(base)) {
    return `${base.replace(/\/+$/, "")}/${file}`;
  }
  return `${base}\\${file}`;
}

/**
 * Ruta típica en red: carpeta por troquel + PDF con el mismo nombre.
 * [base]\[num]\[num].pdf
 */
export function troquelPdfNestedPath(pdfPath: string, numTroquel: string): string {
  const base = pdfPath.trim().replace(/[/\\]+$/, "");
  const n = String(numTroquel).trim();
  const file = `${n}.pdf`;
  if (!base) return file;
  if (base.startsWith("\\\\")) {
    return `${base}\\${n}\\${file}`;
  }
  if (base.includes("/") && !/^[A-Za-z]:/.test(base)) {
    return `${base.replace(/\/+$/, "")}/${n}/${file}`;
  }
  return `${base}\\${n}\\${file}`;
}

/**
 * Patrón para búsqueda en el Explorador de Windows / red (comodines visibles).
 * [PATH]\[num]*\[num]*.pdf
 */
export function troquelPdfFuzzySearchPattern(
  pdfPath: string,
  numTroquel: string
): string {
  const base = pdfPath.trim().replace(/[/\\]+$/, "");
  const n = String(numTroquel).trim();
  if (!base) return `${n}*\\${n}*.pdf`;
  if (base.startsWith("\\\\")) {
    return `${base}\\${n}*\\${n}*.pdf`;
  }
  if (base.includes("/") && !/^[A-Za-z]:/.test(base)) {
    return `${base.replace(/\/+$/, "")}/${n}*/${n}*.pdf`;
  }
  return `${base}\\${n}*\\${n}*.pdf`;
}

/**
 * Misma lógica que el PDF pero para Adobe Illustrator (`.ai`).
 * Ej. `TAG00025*.ai` en carpeta del número o raíz.
 */
export function troquelAiFuzzySearchPattern(
  pdfPath: string,
  numTroquel: string
): string {
  const base = pdfPath.trim().replace(/[/\\]+$/, "");
  const n = String(numTroquel).trim();
  if (!base) return `${n}*\\${n}*.ai`;
  if (base.startsWith("\\\\")) {
    return `${base}\\${n}*\\${n}*.ai`;
  }
  if (base.includes("/") && !/^[A-Za-z]:/.test(base)) {
    return `${base.replace(/\/+$/, "")}/${n}*/${n}*.ai`;
  }
  return `${base}\\${n}*\\${n}*.ai`;
}

/** Ruta plana `[base]\\[num].ai` */
export function troquelAiFullPath(basePath: string, numTroquel: string): string {
  return troquelPdfFullPath(basePath, numTroquel).replace(/\.pdf$/i, ".ai");
}

/** Ruta anidada `[base]\\[num]\\[num].ai` */
export function troquelAiNestedPath(basePath: string, numTroquel: string): string {
  return troquelPdfNestedPath(basePath, numTroquel).replace(/\.pdf$/i, ".ai");
}

/**
 * URL file:// para intentar abrir desde el navegador (puede estar bloqueada).
 * Convierte ruta Windows (G:\a\b) a file:///G:/a/b
 */
export function troquelPdfFileUrlFromWindowsPath(absolutePath: string): string {
  const t = absolutePath.trim();
  if (!t) return "";
  let s = t.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(s)) {
    return `file:///${s}`;
  }
  if (s.startsWith("//")) {
    return `file:${s}`;
  }
  return `file:///${s}`;
}
