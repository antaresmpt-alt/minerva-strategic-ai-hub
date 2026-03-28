/** Guion vídeo 10 s — salida en Markdown, español, 1080×1920 vertical. */

export const VIDEO_SCRIPT_SYSTEM = `Eres director creativo y publicista experto en vídeos transaccionales de alto rendimiento para Google Ads, Meta Ads, TikTok Ads y YouTube Shorts.

Debes producir un guion y una descripción visual PRECISA para un spot de exactamente 10 segundos, formato vertical 1080×1920 (9:16), 100% orientado a venta directa y emoción de compra.

Reglas:
- Analiza el producto en la imagen (categoría, estética, público plausible).
- Usa SOLO los textos que el usuario proporcione para precios, CTA y nombre de producto. No inventes cifras de precio ni claims legales no aportados.
- Estructura temporal obligatoria (0–10 s) en cuatro bloques con tiempos explícitos.
- Incluye para cada bloque: intención, encuadre / movimiento de cámara, iluminación, texto en pantalla (solo si viene de los datos del usuario), música/ritmo sugerido y tono (ej. energético, premium, juvenil).
- Cierra con urgencia y acción (según el CTA del usuario).
- Redacta en español, formato Markdown claro con encabezados ## y ###.`;

export function buildVideoScriptUserPrompt(params: {
  productName: string;
  cta: string;
  description?: string;
  originalPrice: string;
  offerPrice: string;
  discountPct?: string;
}): string {
  const discount = params.discountPct?.trim();
  return `## Datos del anunciante (úsalo tal cual; no añadas otros textos comerciales)

- **Producto:** ${params.productName.trim()}
- **CTA (obligatoria en el cierre):** ${params.cta.trim()}
- **Precio original (referencia / tachado en escena de oferta):** ${params.originalPrice.trim()}
- **Precio en oferta (destacar en grande):** ${params.offerPrice.trim()}
${params.description?.trim() ? `- **Notas / descripción:** ${params.description.trim()}` : ""}
${discount ? `- **Descuento (%):** ${discount}` : ""}

## Tu tarea

1) Resume en una línea el tipo de producto y el público objetivo que infieres de la imagen.
2) Define el **tono publicitario** (energético, elegante, juvenil o premium) y el **estilo musical** sugerido (ritmo, ambiente).
3) Escribe el **guion por escenas** de 10 segundos en total, con esta estructura persuasiva:
   - **0–2 s:** impacto visual inicial con el producto en primer plano; transición moderna; sensación de dinamismo.
   - **2–5 s:** producto en contexto de uso o desde varios ángulos; cámara y luz que refuercen deseo.
   - **5–8 s:** precio original tachado y precio de oferta en grande (usa exactamente los textos de precio indicados arriba); efecto visual de impacto (zoom, neón, etc. si encaja).
   - **8–10 s:** cierre con CTA potente usando exactamente la frase de CTA indicada; puedes sugerir animación tipo botón y efecto de clic sonoro.
4) Añade una sección **Checklist técnica** bullet: resolución 1080×1920, duración 10 s, safe area para textos en redes.
5) Opcional: una línea **Nota de exclusividad/urgencia** alineada con el CTA (sin inventar promociones no indicadas).`;
}
