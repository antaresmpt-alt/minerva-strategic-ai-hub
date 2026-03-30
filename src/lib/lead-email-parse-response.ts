/**
 * Interpreta la respuesta del modelo con formato ASUNTO: / CUERPO:.
 */
export function parseSalesEmailText(raw: string): {
  subject: string;
  body: string;
} {
  const text = raw.trim();
  if (!text) return { subject: "", body: "" };

  const bodyIdx = text.search(/\n\s*CUERPO:\s*/i);
  if (bodyIdx === -1) {
    return { subject: "", body: text };
  }

  const head = text.slice(0, bodyIdx).trim();
  const tail = text.slice(bodyIdx).replace(/^\s*CUERPO:\s*/i, "").trim();

  const subject = head
    .replace(/^ASUNTO:\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { subject, body: tail };
}
