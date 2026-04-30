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
export const TEMPLATE_OPTIMUS_IMPORT_PROMPT =
  "produccion_externos_optimus_import_prompt";
export const TEMPLATE_OPTIMUS_REGEX_RULES = "optimus_regex_rules";
export const TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT =
  "optimus_extraction_mode_default";

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

export const DEFAULT_OPTIMUS_IMPORT_PROMPT = `Eres el extractor oficial de albaranes Optimus para Minerva Packaging & Print.

RESPONDE SOLO JSON válido (sin markdown, sin texto extra) con este formato:
{
  "rows": [
    {
      "referencia": "3517201",
      "proveedor_nombre": "PLASTIFICADOS DEL LLOBREGAT, S.L.",
      "trabajo_titulo": "EXPOS 6 TONICO GLOW HIDRAMILK 150 ML",
      "unidades": 800,
      "prioridad": "Urgente",
      "fecha_envio": "2026-04-21",
      "fecha_prevista": "2026-04-21",
      "observaciones": "OC-94961 | Comprador: Jordi Gaya | Plastificado Polipropileno Brillo",
      "raw_text": "fragmento breve relevante"
    }
  ]
}

REGLAS DE EXTRACCION (OBLIGATORIAS)

1) referencia (OT)
- Prioridad de fuentes: "O/T:" > "Referència:" > "Nuestra OT"/"NUESTRA OT".
- Conserva solo dígitos.
- Acepta referencias de 5 o 7 dígitos.
- Si aparecen varias referencias en una línea (ej: "34484 / 34485"), crea una fila por cada referencia.
- No uses "Ref.Compra" como OT si ya existe OT en las fuentes anteriores. Solo úsala si no hay ninguna otra referencia.

2) proveedor_nombre
- Toma el proveedor del encabezado del documento (primeras líneas).

3) trabajo_titulo
- Prioriza texto entre paréntesis junto a "O/T:".
- Si el paréntesis contiene términos de presupuesto ("presupuesto", "núm", "num", "según su presupuesto"), IGNÓRALO como título principal.
- Si no hay título útil en paréntesis, usa la descripción principal del cuerpo (líneas de producto/trabajo).

4) unidades
- Devuelve entero sin separadores de miles.
- Ejemplos: "10.000" -> 10000, "1.300" -> 1300.

5) prioridad
- "Urgente" si aparece "***" o palabras como "URGENTE", "RUSH", "ASAP".
- Si no, "Normal".

6) fecha_envio
- Usa "Data:" de cabecera.
- Convierte a YYYY-MM-DD.

7) fecha_prevista
- Usa "Data entrega" del cuerpo cuando exista.
- Si no existe, usa la misma fecha que fecha_envio.
- Nunca devuelvas fecha_prevista vacía.

8) observaciones
- Formato obligatorio exacto:
  "OC-[numero] | Comprador: [Nombre] | [Descripción técnica]"
- OC sale de "Ordre de Compra".
- Comprador sale de "Comprador:".
- Descripción técnica: proceso/material/nota técnica principal (plastificado, contracolado, forrado, etc).

REGLAS DE CALIDAD
- No inventes datos.
- Si falta un campo de texto, usa "".
- Si falta unidades, usa null.
- Si no hay filas válidas, devuelve: {"rows":[]}.`;

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

export async function fetchOptimusImportPromptProduccion(
  supabase: SupabaseClient
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from(TABLE_PROD_CONFIGURACION)
      .select("valor")
      .eq("clave", TEMPLATE_OPTIMUS_IMPORT_PROMPT)
      .maybeSingle();
    if (error) throw error;
    const value = (data as { valor?: string | null } | null)?.valor ?? "";
    const trimmed = String(value).trim();
    return trimmed || DEFAULT_OPTIMUS_IMPORT_PROMPT;
  } catch {
    return DEFAULT_OPTIMUS_IMPORT_PROMPT;
  }
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

function otPosicionComprasDisplay(row: ComprasMaterialTableRow): string {
  const ot = String(row.ot_numero ?? "").trim();
  if (!ot) return "—";
  const pos = row.posicion;
  if (pos == null || !Number.isFinite(pos)) return ot;
  const p = Math.max(1, Math.trunc(pos));
  return `${ot}${String(p).padStart(2, "0")}`;
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
    ot_asociada: otPosicionComprasDisplay(row),
  };
}

function varsComprasAgregadas(
  rows: ComprasMaterialTableRow[],
  nombreProveedor: string
): Record<string, string> {
  const ots = [
    ...new Set(
      rows
        .map((r) => otPosicionComprasDisplay(r))
        .filter((v) => v !== "—" && v.trim().length > 0)
    ),
  ].join(", ");
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
