export type CreativoCopy = {
  productName: string;
  cta: string;
  description?: string;
  originalPrice?: string;
  offerPrice?: string;
  discountPct?: string;
};

function priceLines(copy: CreativoCopy): string {
  const lines: string[] = [];
  if (copy.originalPrice?.trim())
    lines.push(`Precio original (solo si lo muestras): "${copy.originalPrice.trim()}"`);
  if (copy.offerPrice?.trim())
    lines.push(`Precio de oferta (destacado): "${copy.offerPrice.trim()}"`);
  if (copy.discountPct?.trim())
    lines.push(`Porcentaje de descuento: "${copy.discountPct.trim()}"`);
  if (lines.length === 0)
    return "No incluyas precios ni porcentajes en el anuncio (el usuario no los indicó).";
  return lines.join("\n");
}

export function buildCreativoSystemRules(
  w: number,
  h: number,
  copy: CreativoCopy
): string {
  const desc = copy.description?.trim();
  return `Eres un director creativo y diseñador gráfico experto en anuncios de alto rendimiento para Google Ads y Meta Ads.

REGLAS DE ORO (incumplimiento inaceptable):
1) PRODUCTO SAGRADO: La foto del producto que adjunto es la fuente de verdad. Conserva el producto reconocible: misma forma, proporción, color e identidad. Puedes cambiar fondo, iluminación de escena, marco, sombras y composición alrededor, pero no sustituyas el producto ni lo redesñes.
2) DIMENSIONES EXACTAS: La imagen final debe ocupar el lienzo completo ${w}×${h} píxeles (ni más ni menos en intención de encuadre).
3) TEXTO PROPIO: Solo puedes usar texto tomado de los siguientes datos (no inventes slogans, marcas ni claims adicionales):
   — Nombre del producto: "${copy.productName.trim()}"
   — Llamada a la acción: "${copy.cta.trim()}"
   ${desc ? `— Descripción (opcional, puedes usar fragmentos): "${desc}"` : "— No hay descripción extra: no añadas párrafos largos salvo nombre y CTA."}
   — Precios (solo si aplican):
${priceLines(copy)}
4) Estilo: moderno, limpio, contraste alto, legible en móvil; composición publicitaria que invite al clic.`;
}

export function buildGenerateUserPrompt(
  w: number,
  h: number,
  copy: CreativoCopy,
  variantHint: string
): string {
  return `${buildCreativoSystemRules(w, h, copy)}

Tarea: crea UN anuncio estático completo (${variantHint}) optimizado para clics y ventas. Incluye tipografía clara y jerarquía visual (nombre, CTA${copy.description?.trim() ? ", detalle breve" : ""}).`;
}

export function buildEditUserPrompt(
  w: number,
  h: number,
  copy: CreativoCopy,
  editInstruction: string
): string {
  return `${buildCreativoSystemRules(w, h, copy)}

Tarea: partiendo de la imagen de anuncio adjunta (última versión), aplica ÚNICAMENTE este cambio del usuario: "${editInstruction.trim()}"

Mantén las reglas 1–3. La salida sigue siendo un anuncio completo ${w}×${h} px.`;
}

export function buildRegenerateUserPrompt(
  w: number,
  h: number,
  copy: CreativoCopy,
  variantHint: string
): string {
  return `${buildCreativoSystemRules(w, h, copy)}

Tarea: genera una NUEVA variación creativa (${variantHint}) desde la foto de producto adjunta (recortada a este formato). Diferente composición o fondo respecto a intentos anteriores, pero mismas reglas estrictas.`;
}
