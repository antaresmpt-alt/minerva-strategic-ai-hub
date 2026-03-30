import * as XLSX from "xlsx";

import type { LeadRow } from "@/types/leads";

function normalizeHeaderKey(key: string): string {
  return key.replace(/\s+/g, " ").trim();
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

function pick(
  r: Record<string, unknown>,
  ...candidates: string[]
): unknown {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(r)) {
    map.set(normalizeHeaderKey(k), v);
  }
  for (const c of candidates) {
    const nk = normalizeHeaderKey(c);
    if (map.has(nk)) return map.get(nk);
  }
  return undefined;
}

function parseRecord(raw: Record<string, unknown>): LeadRow | null {
  const idRaw = pick(
    raw,
    "ID_Lead",
    "ID Lead",
    "Id_Lead",
    "Id Lead",
    "ID",
    "id_lead"
  );
  const idLead =
    idRaw == null || idRaw === ""
      ? ""
      : typeof idRaw === "number"
        ? String(idRaw)
        : cellStr(idRaw);

  const empresa = cellStr(pick(raw, "Empresa", "empresa"));
  if (!idLead && !empresa) return null;

  return {
    idLead: idLead || `—${empresa.slice(0, 8)}`,
    empresa,
    contacto: cellStr(pick(raw, "Contacto", "contacto")),
    cargo: cellStr(pick(raw, "Cargo", "cargo")),
    email: cellStr(pick(raw, "Email", "email", "E-mail")),
    telefono: cellStr(
      pick(raw, "Telefono", "Teléfono", "Móvil", "Movil")
    ),
    origen: cellStr(pick(raw, "Origen", "origen")),
    temaInteres: cellStr(
      pick(raw, "Tema_Interes", "Tema Interes", "Tema interés", "Tema")
    ),
    comercial: cellStr(pick(raw, "Comercial", "comercial")) || "Sin asignar",
    estado: cellStr(pick(raw, "Estado", "estado")),
    prioridad: cellStr(pick(raw, "Prioridad", "prioridad")),
    ultimoContacto: cellStr(
      pick(raw, "Ultimo_Contacto", "Ultimo Contacto", "Último contacto")
    ),
    proximaAccion: cellStr(
      pick(raw, "Proxima_Accion", "Proxima Accion", "Próxima acción")
    ),
  };
}

function sheetToRows(
  json: Record<string, unknown>[]
): LeadRow[] {
  const out: LeadRow[] = [];
  for (const row of json) {
    const rec = parseRecord(row);
    if (rec) out.push(rec);
  }
  return out;
}

export function parseLeadsArrayBuffer(buffer: ArrayBuffer): LeadRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) {
    throw new Error("El archivo no contiene ninguna hoja.");
  }
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("No se pudo leer la hoja de leads.");
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return sheetToRows(json);
}

/** CSV como texto UTF-8 (primera hoja). */
export function parseLeadsCsvText(text: string): LeadRow[] {
  const wb = XLSX.read(text, { type: "string", raw: false });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("CSV vacío o no legible.");
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("No se pudo leer el CSV.");
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return sheetToRows(json);
}

export async function parseLeadsFile(file: File): Promise<LeadRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return parseLeadsCsvText(text);
  }
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel")
  ) {
    const buf = await file.arrayBuffer();
    return parseLeadsArrayBuffer(buf);
  }
  throw new Error(
    "Formato no soportado. Usa Excel (.xlsx) o CSV con las columnas corporativas de leads."
  );
}
