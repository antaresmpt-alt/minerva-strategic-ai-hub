const MAX_PDF_BYTES = 12 * 1024 * 1024;

export function assertPdfBuffer(buf: Buffer): void {
  if (buf.length < 8) {
    throw new Error("El archivo está vacío o es demasiado pequeño.");
  }
  const head = buf.slice(0, 4).toString("latin1");
  if (head !== "%PDF") {
    throw new Error("El archivo no es un PDF válido (cabecera %PDF no encontrada).");
  }
  if (buf.length > MAX_PDF_BYTES) {
    throw new Error(
      `El PDF supera el tamaño máximo permitido (${MAX_PDF_BYTES / 1024 / 1024} MB).`
    );
  }
}
