import Papa from "papaparse";

import type { SalesOrderRow } from "@/types/sales";

function num(v: string | undefined): number {
  if (v == null || v === "") return NaN;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function str(v: string | undefined): string {
  return (v ?? "").trim();
}

export function parseVentasCsv(csvText: string): SalesOrderRow[] {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0) {
    console.warn("CSV parse warnings:", errors);
  }

  const rows: SalesOrderRow[] = [];

  for (const r of data) {
    const idPedido = num(r["ID_Pedido"]);
    if (Number.isNaN(idPedido)) continue;

    rows.push({
      idPedido,
      estado: str(r["Estado"]),
      cliente: str(r["Cliente"]),
      pedidoCliente: str(r["Pedido Cliente"]),
      cantidadPedida: num(r["Cantidad pedida"]),
      valorPotencial: num(r["Valor_Potencial"]),
      titulo: str(r["Título"]),
      fechaApertura: str(r["Fecha_Apertura"]),
      fechaEntrega: str(r["Fecha_Entrega"]),
      fsc: str(r["FSC"]),
      pruebaColor: str(r["Prueba_Color"]),
      pdfOk: str(r["PDF_OK"]),
      muestraOk: str(r["Muestra_OK"]),
      comercial: str(r["Comercial"]),
      tipoCliente: str(r["Tipo_Cliente"]),
      valorReal: num(r["Valor_Real"]),
      costeEstimado: num(r["Coste_Estimado"]),
      margenEuros: num(r["Margen_Euros"]),
      margenPorcentaje: num(r["Margen_Porcentaje"]),
    });
  }

  return rows;
}

export async function loadVentasCsv(url = "/data/ventasDataSet_mejorado.csv"): Promise<SalesOrderRow[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar el CSV (${res.status})`);
  const text = await res.text();
  return parseVentasCsv(text);
}
