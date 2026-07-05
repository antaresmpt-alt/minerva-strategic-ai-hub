import { buildCartelaCamposVista } from "@/lib/cartela-ejecucion";
import {
  getCamposConfigByProcesoId,
  type CampoDefinicion,
} from "@/lib/hoja-ruta-campos-config";

export function fmtDate(v: string | null | undefined): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtDateShort(v: string | null | undefined): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function fmtCantidad(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-ES").format(v);
}

export function tipoMaquinaLabel(v: string | null | undefined): string {
  const t = String(v ?? "").trim().toLowerCase();
  if (t === "impresion") return "Impresión";
  if (t === "digital") return "Digital";
  if (t === "troquelado") return "Troquelado";
  if (t === "engomado") return "Engomado";
  return "";
}

export function formatValor(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) {
    const items = value
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0);
    return items.length > 0 ? items.join(", ") : null;
  }
  const raw = String(value).trim();
  return raw.length > 0 ? raw : null;
}

export const TINTA_LABELS: Record<string, string> = {
  CYAN: "Cyan",
  MAGENTA: "Magenta",
  YELLOW: "Yellow",
  BLACK: "Black",
  BLANCO: "Blanco",
  PANTONE: "Pantone",
};

/** Formatea densidades_tintas → "Cyan 1.25, Pantone 185C 1.10". */
export function formatDensidades(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => {
      if (item == null) return "";
      if (typeof item === "string") return TINTA_LABELS[item] ?? item;
      if (typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const tintaRaw = String(obj.tinta ?? "").trim();
        if (!tintaRaw) return "";
        const tinta = TINTA_LABELS[tintaRaw] ?? tintaRaw;
        const ref = obj.ref ? String(obj.ref).trim() : "";
        const lote = obj.lote ? String(obj.lote).trim() : "";
        const dens = Number(obj.densidad);
        const densStr = Number.isFinite(dens) ? dens.toFixed(2) : "";
        const loteStr = lote ? `lot.${lote}` : "";
        return [tinta, ref, densStr, loteStr].filter(Boolean).join(" ");
      }
      return "";
    })
    .filter((s) => s.length > 0);
  return items.length > 0 ? items.join(", ") : null;
}

export type CampoVista = { label: string; valor: string };

/**
 * Extrae solo los campos rellenados de `datos_proceso` según la config del
 * proceso, en orden, gestionando previsto/real. No muestra campos vacíos.
 */
export function buildCamposVista(
  procesoId: number | null,
  datos: Record<string, unknown> | null,
): CampoVista[] {
  if (procesoId == null || !datos) return [];
  const config = getCamposConfigByProcesoId(procesoId);
  if (!config) return [];
  const out: CampoVista[] = [];
  const suffix = (campo: CampoDefinicion, v: string) => {
    if (!campo.suffix) return v;
    const normalizedValue = v.trim().toLowerCase();
    const normalizedSuffix = campo.suffix.trim().toLowerCase();
    return normalizedValue.endsWith(normalizedSuffix)
      ? v
      : `${v} ${campo.suffix}`;
  };

  for (const campo of config.campos) {
    if (campo.hasPrevistoReal) {
      const prev = formatValor(datos[`${campo.id}_previsto`]);
      const real = formatValor(datos[`${campo.id}_real`]);
      if (prev != null) out.push({ label: `${campo.label} (prev.)`, valor: suffix(campo, prev) });
      if (real != null) out.push({ label: `${campo.label} (real)`, valor: suffix(campo, real) });
      continue;
    }
    if (campo.tipo === "densidades") {
      const d = formatDensidades(datos[campo.id]);
      if (d != null) out.push({ label: campo.label, valor: d });
      continue;
    }
    const v = formatValor(datos[campo.id]);
    if (v != null) out.push({ label: campo.label, valor: suffix(campo, v) });
  }
  out.push(...buildCartelaCamposVista(procesoId, datos));
  return out;
}
