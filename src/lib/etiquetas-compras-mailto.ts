import type { ProdEtiquetasCompraRow } from "@/types/prod-etiquetas-compras";

/** Separa correos por coma o punto y coma; ignora vacíos. */
export function parseEmailDestinatarios(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildComprasMailtoHref(
  destinatarios: string[],
  subject: string,
  body: string
): string | null {
  const to = destinatarios.join(",");
  if (!to) return null;
  const q = (s: string) => encodeURIComponent(s);
  return `mailto:${to}?subject=${q(subject)}&body=${q(body)}`;
}

function fmtEsDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
  return s;
}

export function buildComprasCorreoBody(rows: ProdEtiquetasCompraRow[]): string {
  const lines: string[] = [
    "Petición / seguimiento compras — Etiquetas digital",
    "",
    "Listado:",
    "",
  ];
  for (const r of rows) {
    lines.push(
      `· ${r.producto} | Ud: ${r.unidad} | ${r.tipo_linea}/${r.marca} | Equipo: ${r.equipo || "—"} | ${r.prioridad} | ${r.propietario} | Pedido: ${fmtEsDate(r.fecha_pedido)} | Llegada: ${fmtEsDate(r.fecha_llegada)} | ${r.recibido ? "Recibido" : "Pendiente"}`
    );
  }
  lines.push("", "—", "Generado desde Minerva Hub");
  return lines.join("\n");
}
