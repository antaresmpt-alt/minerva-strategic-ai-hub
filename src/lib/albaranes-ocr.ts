/**
 * OCR / visión de albaranes de entrada (Bloque 9.7).
 * Extrae líneas, cruza con proveedores/compras y calcula hojas desde kilos.
 * La IA nunca escribe en BD: esto solo normaliza y puntúa.
 */

import { parseDecimalLoose } from "@/lib/parse-decimal-input";
import { esAlbaranPlaceholder } from "@/lib/albaran-placeholders";
import { normalizeCompraEstado } from "@/lib/compras-material-estados";

export const ALBARANES_OCR_MAX_PAGES = 10;

export const ALBARANES_OCR_SYSTEM_PROMPT = `Eres el extractor de albaranes de ENTRADA de material (papel/cartón) para Minerva Packaging & Print.

El usuario te pasa fotos o páginas escaneadas de albaranes de proveedores (CARPAPSA, Papers Tordera, Torraspapel, Lecta, etc.).

RESPONDE SOLO JSON válido (sin markdown) con este formato:
{
  "rows": [
    {
      "source_file": "nombre del fichero si lo conoces",
      "page": 1,
      "proveedor_nombre": "CARPAPSA, S.A.",
      "albaran": "G6-3305",
      "fecha": "2026-06-15",
      "ot_numero": "36016",
      "es_stock": false,
      "material": "Folding Allyking 235",
      "gramaje": 235,
      "formato": "72×102",
      "palets": 1,
      "kilos": null,
      "hojas": 2400,
      "notas": "PEFC / texto a mano útil"
    }
  ]
}

REGLAS
1) Una fila por LÍNEA de material. Un albarán con 2 referencias = 2 filas (mismo nº albarán).
2) Varias páginas pueden ser varios albaranes distintos. No mezcles cabeceras.
3) albaran: número del proveedor (Nota de entrega / Albarán / Nº doc). Conserva letras y guiones (G6-3305, B26-2525, AV26-04186). NO uses el nº de pedido interno de Minerva como albarán.
4) fecha: YYYY-MM-DD. Si solo hay DD/MM/AA o DD-MM-YYYY, convierte. Si no hay fecha, null.
5) ot_numero: solo dígitos (5-7). Fuentes: "OT", "O/T", "Pedido", "Nuestra OT", y SOBRE TODO números escritos a mano (rotulador). Si dice STOCK / almacén / sin pedido → ot_numero "" y es_stock true.
6) No inventes OT. Si no está en el papel ni a mano, deja ot_numero vacío y es_stock true.
7) material: descripción comercial (Folding, Offset, Zenith, Allyking…) sin el párrafo legal.
8) gramaje: entero g/m² (235, 300…). Si viene "235 gr" o "235 g/m2", extrae 235.
9) formato: ancho×alto en cm con aspa, ej. "72×102", "70×100", "65×92". Si viene en mm (720x1020), convierte a cm.
10) palets: entero. Si no indica palets pero hay 1 línea, 1.
11) Cantidad:
    - Si el albarán pone HOJAS / pliegos / sheets → hojas (entero, "1.200" → 1200) y kilos null salvo que también figure el peso.
    - Si pone KG / kilos / kg y NO hojas → kilos (decimal con punto) y hojas null.
    - Si pone toneladas → kilos = tn × 1000.
12) Ignora totales de importe, IVA, dirección fiscal, códigos de barras y el pie legal FSC salvo una nota corta.
13) page: número de página del documento (1-based) de donde sale la línea.
14) source_file: el nombre de archivo que te indiquen junto a cada imagen.`;

export type AlbaranOcrSemaforo = "verde" | "ambar" | "rojo";

export type AlbaranOcrHojasOrigen = "albaran" | "calculadas" | "manual";

export type AlbaranOcrProveedor = {
  id: string;
  nombre: string;
};

export type AlbaranOcrCompra = {
  id: string;
  ot_numero: string | null;
  num_compra: string;
  material: string | null;
  gramaje: number | null;
  tamano_hoja: string | null;
  num_hojas_brutas: number | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  estado: string | null;
};

export type AlbaranOcrCompraCandidata = AlbaranOcrCompra & {
  score: number;
};

export type AlbaranOcrLlmRow = {
  source_file?: unknown;
  page?: unknown;
  proveedor_nombre?: unknown;
  albaran?: unknown;
  fecha?: unknown;
  ot_numero?: unknown;
  es_stock?: unknown;
  material?: unknown;
  gramaje?: unknown;
  formato?: unknown;
  palets?: unknown;
  kilos?: unknown;
  hojas?: unknown;
  notas?: unknown;
};

export type AlbaranOcrDraftRow = {
  id: string;
  included: boolean;
  source_file: string;
  page: number | null;
  proveedor_detectado: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  albaran: string;
  fecha: string | null;
  ot_numero: string;
  es_stock: boolean;
  material: string;
  gramaje: number | null;
  formato: string;
  palets: number | null;
  kilos: number | null;
  hojas: number | null;
  hojas_origen: AlbaranOcrHojasOrigen;
  compra_id: string | null;
  compras_candidatas: AlbaranOcrCompraCandidata[];
  semaforo: AlbaranOcrSemaforo;
  avisos: string[];
  notas: string;
};

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeProveedorKey(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\./g, " ")
    .replace(/\b(s\s*a|s\s*l|s\s*l\s*u|slu|sl|sa|sociedad anonima|sociedad limitada)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchProveedor(
  detected: string,
  catalog: readonly AlbaranOcrProveedor[]
): AlbaranOcrProveedor | null {
  const key = normalizeProveedorKey(detected);
  if (!key || catalog.length === 0) return null;

  let best: { p: AlbaranOcrProveedor; score: number } | null = null;
  for (const p of catalog) {
    const pk = normalizeProveedorKey(p.nombre);
    if (!pk) continue;
    let score = 0;
    if (pk === key) score = 100;
    else if (pk.includes(key) || key.includes(pk)) {
      const shorter = Math.min(pk.length, key.length);
      const longer = Math.max(pk.length, key.length);
      score = Math.round(70 + (30 * shorter) / longer);
    } else {
      const tokens = key.split(" ").filter((t) => t.length >= 4);
      const hits = tokens.filter((t) => pk.includes(t)).length;
      if (hits > 0 && tokens.length > 0) {
        score = Math.round(40 * (hits / tokens.length));
      }
    }
    if (score >= 40 && (!best || score > best.score)) {
      best = { p, score };
    }
  }
  return best?.p ?? null;
}

/** "72x102", "72 × 102 cm", "720x1020" (mm) → "72×102" */
export function normalizeFormato(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const m = t.replace(/,/g, ".").match(
    /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/
  );
  if (!m) return t.replace(/x/gi, "×");
  let w = Number(m[1]);
  let h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return "";
  if (w >= 200 && h >= 200) {
    w = w / 10;
    h = h / 10;
  }
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return `${fmt(w)}×${fmt(h)}`;
}

export function parseFormatoCm(
  formato: string | null | undefined
): { wCm: number; hCm: number } | null {
  const n = normalizeFormato(formato);
  const m = n.match(/^(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const wCm = Number(m[1]);
  const hCm = Number(m[2]);
  if (!Number.isFinite(wCm) || !Number.isFinite(hCm) || wCm <= 0 || hCm <= 0) {
    return null;
  }
  return { wCm, hCm };
}

/**
 * hojas = (kilos × 1000) / (gramaje × formato_m²)
 * Ej. OFFSET 70×100 100 g, 35 kg → 500 h
 */
export function hojasDesdeKilos(
  kilos: number,
  gramaje: number,
  formato: string | null | undefined
): number | null {
  if (!(kilos > 0) || !(gramaje > 0)) return null;
  const dims = parseFormatoCm(formato);
  if (!dims) return null;
  const formatoM2 = (dims.wCm / 100) * (dims.hCm / 100);
  if (!(formatoM2 > 0)) return null;
  const hojas = (kilos * 1000) / (gramaje * formatoM2);
  if (!Number.isFinite(hojas) || hojas <= 0) return null;
  return Math.max(1, Math.round(hojas));
}

export function parseOtNumero(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 7) return "";
  return digits;
}

export function parseFechaYmd(raw: unknown): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const dd = dmy[1]!.padStart(2, "0");
    const mm = dmy[2]!.padStart(2, "0");
    let yyyy = dmy[3]!;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return parseDecimalLoose(String(raw ?? ""));
}

export function toPositiveInt(raw: unknown): number | null {
  const n = toFiniteNumber(raw);
  if (n == null) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

export function pickJsonObject(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(t.slice(start, end + 1)) as unknown;
    }
    throw new Error("La IA no devolvió JSON válido.");
  }
}

export function compraEstaPendienteDeRecepcion(
  estado: string | null | undefined
): boolean {
  const n = normalizeCompraEstado(estado);
  return (
    n === "pendiente" ||
    n === "generada" ||
    n === "confirmado" ||
    n === "recibido parcial"
  );
}

function materialScore(
  detected: string,
  compraMaterial: string | null
): number {
  const a = normalizeProveedorKey(detected);
  const b = normalizeProveedorKey(compraMaterial ?? "");
  if (!a || !b) return 0;
  if (a === b) return 20;
  if (a.includes(b) || b.includes(a)) return 14;
  const tokens = a.split(" ").filter((t) => t.length >= 4);
  const hits = tokens.filter((t) => b.includes(t)).length;
  if (tokens.length === 0) return 0;
  return Math.round(12 * (hits / tokens.length));
}

export function scoreCompraContraLinea(opts: {
  otNumero: string;
  proveedorId: string | null;
  material: string;
  gramaje: number | null;
  formato: string;
  compra: AlbaranOcrCompra;
}): number {
  const { otNumero, proveedorId, material, gramaje, formato, compra } = opts;
  let score = 0;
  const compraOt = String(compra.ot_numero ?? "").replace(/\D/g, "");
  if (otNumero && compraOt && otNumero === compraOt) score += 50;
  if (proveedorId && compra.proveedor_id && proveedorId === compra.proveedor_id) {
    score += 25;
  }
  score += materialScore(material, compra.material);
  if (
    gramaje != null &&
    compra.gramaje != null &&
    Math.abs(gramaje - compra.gramaje) < 0.5
  ) {
    score += 10;
  }
  const fa = normalizeFormato(formato);
  const fb = normalizeFormato(compra.tamano_hoja);
  if (fa && fb && fa === fb) score += 10;
  return score;
}

export function rankComprasParaLinea(opts: {
  otNumero: string;
  proveedorId: string | null;
  material: string;
  gramaje: number | null;
  formato: string;
  compras: readonly AlbaranOcrCompra[];
}): AlbaranOcrCompraCandidata[] {
  const ranked = opts.compras
    .map((compra) => ({
      ...compra,
      score: scoreCompraContraLinea({ ...opts, compra }),
    }))
    .filter((c) => c.score >= 25)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, 5);
}

export function enrichOcrDraftRow(opts: {
  row: Omit<
    AlbaranOcrDraftRow,
    "compras_candidatas" | "compra_id" | "semaforo" | "avisos" | "included"
  >;
  compras: readonly AlbaranOcrCompra[];
  albaranesExistentes: ReadonlySet<string>;
}): AlbaranOcrDraftRow {
  const { row, compras, albaranesExistentes } = opts;
  const avisos: string[] = [];
  const candidatas = row.es_stock
    ? []
    : rankComprasParaLinea({
        otNumero: row.ot_numero,
        proveedorId: row.proveedor_id,
        material: row.material,
        gramaje: row.gramaje,
        formato: row.formato,
        compras,
      });

  const albKey = row.albaran.trim().toLowerCase();
  const duplicado =
    albKey.length > 0 &&
    !esAlbaranPlaceholder(row.albaran) &&
    albaranesExistentes.has(albKey);

  if (duplicado) {
    avisos.push("Este nº de albarán ya tiene recepción en Minerva.");
  }
  if (!row.albaran.trim() || esAlbaranPlaceholder(row.albaran)) {
    avisos.push("Falta el número de albarán.");
  }
  if (!row.material.trim()) {
    avisos.push("Falta el material.");
  }
  if (!row.proveedor_id) {
    avisos.push(
      row.proveedor_detectado
        ? `Proveedor «${row.proveedor_detectado}» no encontrado en el catálogo — elige uno.`
        : "Elige un proveedor."
    );
  }
  if (row.hojas == null || row.hojas <= 0) {
    avisos.push("Faltan las hojas (o kilos + gramaje + formato para calcularlas).");
  }
  if (row.hojas_origen === "calculadas") {
    avisos.push("Hojas calculadas desde kilos — revisa el redondeo.");
  }
  if (row.ot_numero && candidatas.length === 0 && !row.es_stock) {
    avisos.push(
      `OT ${row.ot_numero} sin compra pendiente — se dará de alta como STOCK.`
    );
  }

  const top = candidatas[0] ?? null;
  const second = candidatas[1] ?? null;
  let compraId: string | null = null;
  let semaforo: AlbaranOcrSemaforo = "ambar";
  let included = true;

  if (duplicado || !row.albaran.trim() || !row.material.trim()) {
    semaforo = "rojo";
    included = !duplicado;
  }

  if (row.es_stock || !row.ot_numero) {
    if (!duplicado && row.material.trim() && row.hojas && row.hojas > 0) {
      semaforo = row.proveedor_id ? "verde" : "ambar";
    }
  } else if (top && top.score >= 70 && (!second || top.score - second.score >= 12)) {
    compraId = top.id;
    if (!duplicado) semaforo = "verde";
  } else if (top && top.score >= 40) {
    compraId = top.id;
    semaforo = duplicado ? "rojo" : "ambar";
    if (second && top.score - second.score < 12) {
      avisos.push("Hay varias compras candidatas — elige la correcta.");
    }
  } else {
    semaforo = duplicado ? "rojo" : "ambar";
  }

  if (duplicado) included = false;

  return {
    ...row,
    included,
    compra_id: row.es_stock ? null : compraId,
    compras_candidatas: candidatas,
    semaforo,
    avisos: [...new Set(avisos)],
  };
}

export function applyHojasAuto(row: AlbaranOcrDraftRow): AlbaranOcrDraftRow {
  if (row.hojas_origen === "manual") return row;
  if (row.hojas != null && row.hojas > 0 && row.hojas_origen === "albaran") {
    return row;
  }
  if (row.kilos != null && row.kilos > 0) {
    const calc = hojasDesdeKilos(row.kilos, row.gramaje ?? 0, row.formato);
    if (calc != null) {
      return { ...row, hojas: calc, hojas_origen: "calculadas" };
    }
  }
  return row;
}

export function llmRowToDraftBase(
  raw: AlbaranOcrLlmRow,
  fallbackFile: string,
  catalog: readonly AlbaranOcrProveedor[]
): Omit<
  AlbaranOcrDraftRow,
  "compras_candidatas" | "compra_id" | "semaforo" | "avisos" | "included" | "id"
> {
  const proveedorDetectado = String(raw.proveedor_nombre ?? "").trim();
  const matched = matchProveedor(proveedorDetectado, catalog);
  const ot = parseOtNumero(raw.ot_numero);
  const formato = normalizeFormato(String(raw.formato ?? ""));
  const gramaje = toPositiveInt(raw.gramaje);
  const kilos = toFiniteNumber(raw.kilos);
  const hojasRaw = toPositiveInt(raw.hojas);
  let hojas = hojasRaw;
  let hojasOrigen: AlbaranOcrHojasOrigen = hojasRaw ? "albaran" : "calculadas";
  if (hojas == null && kilos != null && gramaje != null) {
    hojas = hojasDesdeKilos(kilos, gramaje, formato);
    hojasOrigen = hojas != null ? "calculadas" : "calculadas";
  }
  const pageN = toPositiveInt(raw.page);

  return {
    source_file: String(raw.source_file ?? fallbackFile).trim() || fallbackFile,
    page: pageN,
    proveedor_detectado: proveedorDetectado,
    proveedor_id: matched?.id ?? null,
    proveedor_nombre: matched?.nombre ?? null,
    albaran: String(raw.albaran ?? "").trim(),
    fecha: parseFechaYmd(raw.fecha),
    ot_numero: ot,
    es_stock: !ot,
    material: String(raw.material ?? "").trim(),
    gramaje,
    formato,
    palets: toPositiveInt(raw.palets) ?? 1,
    kilos: kilos != null && kilos > 0 ? kilos : null,
    hojas,
    hojas_origen: hojasOrigen,
    notas: String(raw.notas ?? "").trim(),
  };
}

export function buildOcrDraftRows(opts: {
  llmRows: AlbaranOcrLlmRow[];
  fallbackFile: string;
  catalog: readonly AlbaranOcrProveedor[];
  compras: readonly AlbaranOcrCompra[];
  albaranesExistentes: ReadonlySet<string>;
  idFactory?: () => string;
}): AlbaranOcrDraftRow[] {
  const makeId = opts.idFactory ?? (() => crypto.randomUUID());
  return opts.llmRows.map((raw) => {
    const base = llmRowToDraftBase(raw, opts.fallbackFile, opts.catalog);
    return enrichOcrDraftRow({
      row: { ...base, id: makeId() },
      compras: opts.compras,
      albaranesExistentes: opts.albaranesExistentes,
    });
  });
}

export function patchOcrDraftRow(
  row: AlbaranOcrDraftRow,
  patch: Partial<AlbaranOcrDraftRow>,
  compras: readonly AlbaranOcrCompra[],
  albaranesExistentes: ReadonlySet<string>
): AlbaranOcrDraftRow {
  const merged: AlbaranOcrDraftRow = { ...row, ...patch };
  if (patch.ot_numero !== undefined) {
    merged.es_stock = patch.es_stock ?? !parseOtNumero(patch.ot_numero);
  }
  if (patch.es_stock === true) {
    merged.compra_id = null;
  }
  if (patch.hojas != null && patch.hojas_origen === undefined) {
    merged.hojas_origen = "manual";
  }
  if (
    (patch.kilos != null || patch.gramaje != null || patch.formato != null) &&
    merged.hojas_origen !== "manual"
  ) {
    merged.hojas_origen = "calculadas";
  }
  const next = applyHojasAuto(merged);
  const included = patch.included ?? row.included;
  const {
    compras_candidatas: _c,
    compra_id: prevCompra,
    semaforo: _s,
    avisos: _a,
    included: _i,
    ...rest
  } = next;
  void _c;
  void _s;
  void _a;
  void _i;
  const enriched = enrichOcrDraftRow({
    row: rest,
    compras,
    albaranesExistentes,
  });
  return {
    ...enriched,
    included,
    compra_id:
      patch.compra_id !== undefined
        ? patch.compra_id
        : next.es_stock
          ? null
          : (prevCompra ?? enriched.compra_id),
  };
}
