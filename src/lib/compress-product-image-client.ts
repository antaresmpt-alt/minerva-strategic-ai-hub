/** Redimensiona y comprime en JPEG para reducir el tamaño del body en API (evita 413 en producción). Solo ejecutar en el navegador. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(new Error("No se pudo leer la imagen comprimida"));
    r.readAsDataURL(blob);
  });
}

export async function compressImageForApi(
  base64: string,
  mime: string
): Promise<{ base64: string; mime: string }> {
  const dataUrl = `data:${mime};base64,${base64}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () =>
      reject(new Error("No se pudo cargar la imagen para comprimir"));
    el.src = dataUrl;
  });

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (!w || !h) {
    throw new Error("Dimensiones de imagen no válidas");
  }

  if (w > MAX_EDGE || h > MAX_EDGE) {
    if (w >= h) {
      h = Math.round((h * MAX_EDGE) / w);
      w = MAX_EDGE;
    } else {
      w = Math.round((w * MAX_EDGE) / h);
      h = MAX_EDGE;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("No se pudo comprimir la imagen");

  const outB64 = await blobToBase64(blob);
  return { base64: outB64, mime: "image/jpeg" };
}
