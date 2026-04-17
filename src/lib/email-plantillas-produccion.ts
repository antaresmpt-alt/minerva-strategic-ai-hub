import type { SupabaseClient } from "@supabase/supabase-js";

import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";

export const TABLE_PROD_CONFIGURACION = "prod_configuracion";

export const TEMPLATE_EXTERNOS_SUBJECT = "template_externos_subject";
export const TEMPLATE_EXTERNOS_HEADER = "template_externos_header";
export const TEMPLATE_EXTERNOS_DETAIL = "template_externos_detail";
export const TEMPLATE_EXTERNOS_FOOTER = "template_externos_footer";

export const TEMPLATE_COMPRAS_SUBJECT = "template_compras_subject";
export const TEMPLATE_COMPRAS_HEADER = "template_compras_header";
export const TEMPLATE_COMPRAS_DETAIL = "template_compras_detail";
export const TEMPLATE_COMPRAS_FOOTER = "template_compras_footer";

const EXTERNO_KEYS = [
  TEMPLATE_EXTERNOS_SUBJECT,
  TEMPLATE_EXTERNOS_HEADER,
  TEMPLATE_EXTERNOS_DETAIL,
  TEMPLATE_EXTERNOS_FOOTER,
] as const;

const COMPRAS_KEYS = [
  TEMPLATE_COMPRAS_SUBJECT,
  TEMPLATE_COMPRAS_HEADER,
  TEMPLATE_COMPRAS_DETAIL,
  TEMPLATE_COMPRAS_FOOTER,
] as const;

export const ALL_EMAIL_TEMPLATE_KEYS = [
  ...EXTERNO_KEYS,
  ...COMPRAS_KEYS,
] as const;

export type EmailPlantillaBloques = {
  subject: string;
  header: string;
  detail: string;
  footer: string;
};

export const DEFAULT_EMAIL_PLANTILLA_EXTERNOS: EmailPlantillaBloques = {
  subject: "Envío de trabajos Minerva — {proveedor}",
  header:
    "Hola {proveedor},\n\nTe adjuntamos el detalle de los trabajos enviados. Confírmanos la recepción y las fechas previstas:",
  detail:
    "OT: {ot} · {trabajo} · Cant.: {cantidad} · Entrega OT: {entrega}",
  footer:
    "Quedamos a la espera de tus noticias para organizar la logística.\n\nSaludos cordiales,",
};

export const DEFAULT_EMAIL_PLANTILLA_COMPRAS: EmailPlantillaBloques = {
  subject: "Solicitud de material — {proveedor}",
  header:
    "Estimados,\n\nPor la presente les solicitamos presupuesto y confirmación de plazo para el siguiente material:",
  detail:
    "OT {ot_asociada} · {material} · Gramaje {gramaje} · Formato {formato} · Brutas: {cantidad}",
  footer:
    "Quedamos a la espera de su confirmación para proceder con el pedido.\n\nSaludos cordiales,",
};

function nonEmpty(s: string | null | undefined): boolean {
  return String(s ?? "").trim().length > 0;
}

/** Sustituye {clave} por valores; claves sin valor quedan como cadena vacía en el placeholder. */
export function sustituirVariablesPlantilla(
  plantilla: string,
  vars: Record<string, string>
): string {
  return plantilla.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? vars[k]! : ""
  );
}

function mergeBloque(
  remoto: string | undefined,
  defecto: string
): string {
  return nonEmpty(remoto) ? String(remoto).trim() : defecto;
}

export function mergePlantillaExternos(
  map: Map<string, string>
): EmailPlantillaBloques {
  return {
    subject: mergeBloque(map.get(TEMPLATE_EXTERNOS_SUBJECT), DEFAULT_EMAIL_PLANTILLA_EXTERNOS.subject),
    header: mergeBloque(map.get(TEMPLATE_EXTERNOS_HEADER), DEFAULT_EMAIL_PLANTILLA_EXTERNOS.header),
    detail: mergeBloque(map.get(TEMPLATE_EXTERNOS_DETAIL), DEFAULT_EMAIL_PLANTILLA_EXTERNOS.detail),
    footer: mergeBloque(map.get(TEMPLATE_EXTERNOS_FOOTER), DEFAULT_EMAIL_PLANTILLA_EXTERNOS.footer),
  };
}

export function mergePlantillaCompras(
  map: Map<string, string>
): EmailPlantillaBloques {
  return {
    subject: mergeBloque(map.get(TEMPLATE_COMPRAS_SUBJECT), DEFAULT_EMAIL_PLANTILLA_COMPRAS.subject),
    header: mergeBloque(map.get(TEMPLATE_COMPRAS_HEADER), DEFAULT_EMAIL_PLANTILLA_COMPRAS.header),
    detail: mergeBloque(map.get(TEMPLATE_COMPRAS_DETAIL), DEFAULT_EMAIL_PLANTILLA_COMPRAS.detail),
    footer: mergeBloque(map.get(TEMPLATE_COMPRAS_FOOTER), DEFAULT_EMAIL_PLANTILLA_COMPRAS.footer),
  };
}

export async function fetchEmailPlantillasProduccion(
  supabase: SupabaseClient
): Promise<{ externos: EmailPlantillaBloques; compras: EmailPlantillaBloques }> {
  const map = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from(TABLE_PROD_CONFIGURACION)
      .select("clave, valor")
      .in("clave", [...ALL_EMAIL_TEMPLATE_KEYS]);
    if (error) throw error;
    for (const row of data ?? []) {
      const r = row as { clave?: string; valor?: string | null };
      if (r.clave) map.set(r.clave, String(r.valor ?? ""));
    }
  } catch {
    /* defaults */
  }
  return {
    externos: mergePlantillaExternos(map),
    compras: mergePlantillaCompras(map),
  };
}

export type ExternosFilaParaMail = {
  OT?: string | null;
  id_pedido: number;
  trabajo_titulo: string;
  unidades?: number | null;
  f_entrega_ot?: string | null;
  fecha_prevista?: string | null;
};

export function otDisplayExternoMail(row: ExternosFilaParaMail): string {
  const o = row.OT != null && String(row.OT).trim() !== "" ? String(row.OT).trim() : "";
  if (o) return o;
  return String(row.id_pedido);
}

function entregaExternoDisplay(row: ExternosFilaParaMail): string {
  const fe = formatFechaEsCorta(row.f_entrega_ot);
  if (fe && fe !== "—") return fe;
  return formatFechaEsCorta(row.fecha_prevista) || "—";
}

function varsExternoFila(
  row: ExternosFilaParaMail,
  nombreProveedor: string
): Record<string, string> {
  const ud = row.unidades != null && Number.isFinite(row.unidades) ? String(row.unidades) : "—";
  return {
    proveedor: nombreProveedor.trim() || "—",
    ot: otDisplayExternoMail(row),
    trabajo: (row.trabajo_titulo ?? "").trim() || "—",
    cantidad: ud,
    entrega: entregaExternoDisplay(row),
  };
}

function varsExternoAgregadas(
  rows: ExternosFilaParaMail[],
  nombreProveedor: string
): Record<string, string> {
  const ots = rows.map((r) => otDisplayExternoMail(r)).join(", ");
  const trabajos = rows.map((r) => (r.trabajo_titulo ?? "").trim()).filter(Boolean);
  const trabajo =
    trabajos.length === 0
      ? "—"
      : trabajos.length === 1
        ? trabajos[0]!
        : `${trabajos.length} trabajos`;
  const sumUd = rows.reduce((acc, r) => {
    if (r.unidades == null || !Number.isFinite(r.unidades)) return acc;
    return acc + r.unidades;
  }, 0);
  const allHaveUd = rows.every(
    (r) => r.unidades != null && Number.isFinite(r.unidades)
  );
  const cantidad = allHaveUd ? String(sumUd) : "—";
  const ent0 = rows[0] ? entregaExternoDisplay(rows[0]) : "—";
  return {
    proveedor: nombreProveedor.trim() || "—",
    ot: ots || "—",
    trabajo,
    cantidad,
    entrega: ent0,
  };
}

export function buildExternosComunicacionEmail(
  rowsSorted: ExternosFilaParaMail[],
  nombreProveedor: string,
  plantilla: EmailPlantillaBloques
): { subject: string; body: string } {
  const agg = varsExternoAgregadas(rowsSorted, nombreProveedor);
  const subject = sustituirVariablesPlantilla(plantilla.subject, agg).trim() || DEFAULT_EMAIL_PLANTILLA_EXTERNOS.subject;
  const header = sustituirVariablesPlantilla(plantilla.header, agg).trim();
  const lineas = rowsSorted.map((row) => {
    const v = varsExternoFila(row, nombreProveedor);
    return sustituirVariablesPlantilla(plantilla.detail, v).trim();
  });
  const footer = sustituirVariablesPlantilla(plantilla.footer, agg).trim();
  const bodyBlocks = [
    header || sustituirVariablesPlantilla(DEFAULT_EMAIL_PLANTILLA_EXTERNOS.header, agg),
    lineas.filter(Boolean).join("\n\n"),
    footer || sustituirVariablesPlantilla(DEFAULT_EMAIL_PLANTILLA_EXTERNOS.footer, agg),
  ];
  const body = bodyBlocks.join("\n\n").trim();
  return {
    subject,
    body: body || "—",
  };
}

function gramajeTexto(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
}

function varsComprasFila(
  row: ComprasMaterialTableRow,
  nombreProveedor: string
): Record<string, string> {
  const gramaje =
    row.gramaje != null && Number.isFinite(row.gramaje)
      ? `${gramajeTexto(row.gramaje)}g`
      : "—";
  return {
    proveedor: nombreProveedor.trim() || "—",
    material: (row.material ?? "").trim() || "—",
    cantidad:
      row.num_hojas_brutas != null && Number.isFinite(row.num_hojas_brutas)
        ? String(row.num_hojas_brutas)
        : "—",
    gramaje,
    formato: (row.tamano_hoja ?? "").trim() || "—",
    ot_asociada: String(row.ot_numero ?? "").trim() || "—",
  };
}

function varsComprasAgregadas(
  rows: ComprasMaterialTableRow[],
  nombreProveedor: string
): Record<string, string> {
  const ots = [...new Set(rows.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean))].join(", ");
  return {
    proveedor: nombreProveedor.trim() || "—",
    material: rows.length === 1 ? varsComprasFila(rows[0]!, nombreProveedor).material : `${rows.length} líneas`,
    cantidad: String(rows.length),
    gramaje: "—",
    formato: "—",
    ot_asociada: ots || "—",
  };
}

export function buildComprasMaterialSolicitudEmail(
  rows: ComprasMaterialTableRow[],
  nombreProveedor: string,
  plantilla: EmailPlantillaBloques
): { subject: string; body: string } {
  const agg = varsComprasAgregadas(rows, nombreProveedor);
  const subject = sustituirVariablesPlantilla(plantilla.subject, agg).trim() || DEFAULT_EMAIL_PLANTILLA_COMPRAS.subject;
  const header = sustituirVariablesPlantilla(plantilla.header, agg).trim();
  const lineas = rows.map((row) => {
    const v = varsComprasFila(row, nombreProveedor);
    return sustituirVariablesPlantilla(plantilla.detail, v).trim();
  });
  const footer = sustituirVariablesPlantilla(plantilla.footer, agg).trim();
  const bodyBlocks = [
    header || sustituirVariablesPlantilla(DEFAULT_EMAIL_PLANTILLA_COMPRAS.header, agg),
    lineas.filter(Boolean).join("\n\n"),
    footer || sustituirVariablesPlantilla(DEFAULT_EMAIL_PLANTILLA_COMPRAS.footer, agg),
  ];
  const body = bodyBlocks.join("\n\n").trim();
  return {
    subject,
    body: body || "—",
  };
}

export function buildGmailComposeUrl(to: string, subject: string, body: string): string {
  const t = to.trim();
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(t)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
