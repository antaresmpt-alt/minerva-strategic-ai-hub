/**
 * planificacion-qr.ts
 *
 * Genera la URL de trazabilidad y el data-URL del QR (PNG base64) para
 * incrustar en el PDF de la Mesa de Secuenciación de Impresión.
 *
 * Usa QRCode (https://github.com/soldair/node-qrcode) disponible en el
 * navegador como `qrcode` (browser build). Si el paquete no está instalado
 * el sistema graciosamente omite el QR.
 */

import type { ExportMeta } from "@/lib/planificacion-export";

/** Construye la URL completa de trazabilidad para el QR. */
export function buildQrUrl(
  meta: ExportMeta,
  baseUrl = typeof window !== "undefined" ? window.location.origin : "",
): string {
  const params = new URLSearchParams({
    scope: meta.scope,
    maquina_id: meta.maquinaId,
    week_monday: meta.weekMondayKey,
    turno: meta.turno,
    source: meta.fuente,
    plan_version: meta.planId,
  });
  if (meta.dayKey) params.set("day", meta.dayKey);
  return `${baseUrl}/produccion/planificacion/mesa?${params.toString()}`;
}

/**
 * Genera un data-URL PNG del QR (resolución 200×200 px).
 * Devuelve null si la librería qrcode no está disponible.
 */
export async function buildQrDataUrl(url: string): Promise<string | null> {
  try {
    // Dynamic import de qrcode (browser build opcional — si no está instalado, omite el QR)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const QRCode = await import("qrcode" as string).catch(() => null) as any;
    if (!QRCode) return null;
    const dataUrl: string = await QRCode.default?.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: "#002147", light: "#ffffff" },
    }) ?? await QRCode.toDataURL?.(url, {
      width: 200,
      margin: 1,
      color: { dark: "#002147", light: "#ffffff" },
    });
    return typeof dataUrl === "string" ? dataUrl : null;
  } catch {
    return null;
  }
}
