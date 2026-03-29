import type { SalesOrderRow } from "@/types/sales";

/** Colapsa espacios / saltos en cabeceras Excel (p. ej. "Pedido             Cliente"). */
export function normalizeSalesHeaderKey(key: string): string {
  return key.replace(/\s+/g, " ").trim();
}

export function normalizeSalesRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeSalesHeaderKey(k);
    if (nk) r[nk] = v;
  }
  return r;
}

/** Normaliza valor de celda CSV/Excel a número */
function cellNum(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Normaliza a string (fechas Excel como string ISO o display) */
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

function pick(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in r && r[k] !== undefined && r[k] !== "") return r[k];
  }
  return undefined;
}

/**
 * Construye una fila a partir de un objeto con cabeceras (CSV corporativo o export ERP).
 */
export function parseSalesRowRecord(raw: Record<string, unknown>): SalesOrderRow | null {
  const r = normalizeSalesRecord(raw);

  const idPedido = cellNum(
    pick(
      r,
      "ID_Pedido",
      "ID Pedido",
      "Nº Pedido",
      "Nº pedido",
      "No Pedido",
      "No. Pedido",
      "Numero Pedido",
      "Número Pedido",
      "Número pedido",
      "N.º pedido",
      "Pedido ID"
    )
  );
  if (Number.isNaN(idPedido)) return null;

  const valorPotencial = cellNum(
    pick(r, "Valor_Potencial", "Valor Potencial", "Valor potencial")
  );
  let valorReal = cellNum(pick(r, "Valor_Real", "Valor Real"));
  if (Number.isNaN(valorReal)) {
    valorReal = Number.isNaN(valorPotencial) ? 0 : valorPotencial;
  }

  let costeEstimado = cellNum(
    pick(r, "Coste_Estimado", "Coste Estimado", "Coste estimado")
  );
  if (Number.isNaN(costeEstimado)) costeEstimado = 0;

  let margenEuros = cellNum(pick(r, "Margen_Euros", "Margen Euros", "Margen euros"));
  if (Number.isNaN(margenEuros)) margenEuros = 0;

  let margenPorcentaje = cellNum(
    pick(r, "Margen_Porcentaje", "Margen Porcentaje", "Margen porcentaje", "Margen %")
  );
  if (Number.isNaN(margenPorcentaje)) margenPorcentaje = 0;

  const potencial = Number.isNaN(valorPotencial) ? 0 : valorPotencial;

  return {
    idPedido,
    estado: cellStr(pick(r, "Estado")),
    cliente: cellStr(pick(r, "Cliente")),
    pedidoCliente: cellStr(pick(r, "Pedido Cliente", "Pedido_Cliente")),
    cantidadPedida: cellNum(pick(r, "Cantidad pedida", "Cantidad_pedida")),
    valorPotencial: potencial,
    titulo: cellStr(pick(r, "Título", "Titulo", "Título ")),
    fechaApertura: cellStr(pick(r, "Fecha_Apertura", "Fecha Apertura")),
    fechaEntrega: cellStr(pick(r, "Fecha_Entrega", "Fecha Entrega")),
    fsc: cellStr(pick(r, "FSC")),
    pruebaColor: cellStr(pick(r, "Prueba_Color", "Prueba color", "Prueba Color")),
    pdfOk: cellStr(pick(r, "PDF_OK", "PDF para OK", "PDF OK", "Pdf Ok")),
    muestraOk: cellStr(pick(r, "Muestra_OK", "Muestra para OK", "Muestra OK")),
    comercial: cellStr(pick(r, "Comercial", "Commercial")) || "Sin asignar",
    tipoCliente:
      cellStr(pick(r, "Tipo_Cliente", "Tipo Cliente", "Tipo cliente")) ||
      "Sin clasificar",
    valorReal,
    costeEstimado,
    margenEuros,
    margenPorcentaje,
  };
}
