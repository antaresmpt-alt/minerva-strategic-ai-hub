export const PRIORIDAD_NORMAL = "Normal";
export const PRIORIDAD_URGENTE = "Urgente";

const URGENCIA_REGEX =
  /(\*{1,}|urgente|urgencia|asap|prioridad\s*alta|rush|inmediat[oa]|hoy|ya\b)/i;

export type OptimusRefSplit = {
  ot: string;
  numOperacion: number;
  idPedido: number;
};

/**
 * Regla Optimus: una referencia de 7 dígitos se divide en OT (5) + operación (2).
 * Ejemplo: 3517201 -> OT 35172 + Op 1.
 */
export function splitOptimusReferencia5Plus2(raw: string): OptimusRefSplit | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 5) return null;
  // Caso principal: 7 dígitos => OT(5) + Op(2)
  if (digits.length >= 7) {
    const ref = digits.slice(0, 7);
    const ot = ref.slice(0, 5);
    const opRaw = ref.slice(5, 7);
    const idPedido = Number(ot);
    if (!Number.isFinite(idPedido) || idPedido <= 0) return null;
    const numOperacion = Number(opRaw);
    if (!Number.isFinite(numOperacion) || numOperacion <= 0) return null;
    return {
      ot,
      numOperacion,
      idPedido: Math.trunc(idPedido),
    };
  }
  // Caso soporte: 5 dígitos => OT completa y operación por defecto 1.
  const ot = digits.slice(0, 5);
  const idPedido = Number(ot);
  if (!Number.isFinite(idPedido) || idPedido <= 0) return null;
  return {
    ot,
    numOperacion: 1,
    idPedido: Math.trunc(idPedido),
  };
}

export function prioridadSugeridaDesdeTexto(texto: string): string {
  const t = String(texto ?? "");
  return URGENCIA_REGEX.test(t) ? PRIORIDAD_URGENTE : PRIORIDAD_NORMAL;
}

export function parseDateLikeToYmd(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const monthMap: Record<string, number> = {
    ene: 1,
    gen: 1,
    feb: 2,
    mar: 3,
    abr: 4,
    apr: 4,
    mai: 5,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    ag: 8,
    sep: 9,
    set: 9,
    oct: 10,
    nov: 11,
    dic: 12,
    des: 12,
  };
  const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (dmy) {
    let yy = Number(dmy[3]);
    if (yy < 100) yy += 2000;
    const dt = new Date(yy, Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
        dt.getDate()
      ).padStart(2, "0")}`;
    }
  }
  const dMonY = s.match(/^(\d{1,2})[\/.\-\s]([a-zA-Z]{3})[\/.\-\s](\d{2,4})$/);
  if (dMonY) {
    const dd = Number(dMonY[1]);
    const mon = monthMap[dMonY[2].toLowerCase()];
    let yy = Number(dMonY[3]);
    if (yy < 100) yy += 2000;
    if (Number.isFinite(dd) && Number.isFinite(mon) && Number.isFinite(yy)) {
      const dt = new Date(yy, mon - 1, dd, 12, 0, 0, 0);
      if (!Number.isNaN(dt.getTime())) {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
          dt.getDate()
        ).padStart(2, "0")}`;
      }
    }
  }
  const parsed = new Date(s.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
    parsed.getDate()
  ).padStart(2, "0")}`;
}

