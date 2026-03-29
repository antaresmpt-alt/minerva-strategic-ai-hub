import * as XLSX from "xlsx";

import type { DeliveryTimeStatus, SalesOrderRow } from "@/types/sales";

export type { DeliveryTimeStatus };

/** Filas del informe de retrasos (solo pedidos activos en estado late o risk). */
export type DelayExportRecord = {
  ID_Pedido: number;
  Cliente: string;
  Producto: string;
  Estado: string;
  Fecha_Entrega: string;
  Dias_Retraso: number;
};

function normalizeEstado(estado: string): string {
  return estado.trim().toLowerCase();
}

/** Pedido activo a efectos de plazos: no entregado ni cancelado. */
export function isOrderActiveForDelivery(estado: string): boolean {
  const e = normalizeEstado(estado);
  return e !== "entregado" && e !== "cancelado";
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Intenta obtener una fecha válida desde strings CSV/Excel (ISO, DD/MM/YYYY, etc.).
 */
export function parseDeliveryDate(raw: string): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const direct = Date.parse(s);
  if (!Number.isNaN(direct)) {
    const d = new Date(direct);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const m = s.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/
  );
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const yStr = m[3];
    const y = yStr.length === 2 ? 2000 + Number(yStr) : Number(yStr);
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    const d = new Date(y, month - 1, day);
    if (
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === y &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
    ) {
      return d;
    }
  }

  return null;
}

/**
 * Compara solo pedidos activos con fecha de entrega válida.
 * - late: Fecha_Entrega &lt; hoy
 * - risk: hoy &lt;= Fecha_Entrega &lt;= hoy+7 días
 * - ok: Fecha_Entrega &gt; hoy+7 días
 */
export function computeDeliveryTimeStatus(row: SalesOrderRow): DeliveryTimeStatus {
  if (!isOrderActiveForDelivery(row.estado)) return "na";
  const delivery = parseDeliveryDate(row.fechaEntrega);
  if (!delivery || Number.isNaN(delivery.getTime())) return "na";

  const today = startOfLocalDay(new Date());
  const due = startOfLocalDay(delivery);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / 86_400_000
  );

  if (diffDays < 0) return "late";
  if (diffDays <= 7) return "risk";
  return "ok";
}

/** Días de retraso respecto a Fecha_Entrega (0 si aún no vence o fecha inválida). */
export function computeDeliveryDelayDays(row: SalesOrderRow): number {
  const delivery = parseDeliveryDate(row.fechaEntrega);
  if (!delivery || Number.isNaN(delivery.getTime())) return 0;
  const today = startOfLocalDay(new Date());
  const due = startOfLocalDay(delivery);
  const diffMs = today.getTime() - due.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  return days > 0 ? days : 0;
}

export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function getDelayExportRecords(rows: SalesOrderRow[]): DelayExportRecord[] {
  const out: DelayExportRecord[] = [];
  for (const row of rows) {
    if (!isOrderActiveForDelivery(row.estado)) continue;
    const ts = computeDeliveryTimeStatus(row);
    if (ts !== "late" && ts !== "risk") continue;
    out.push({
      ID_Pedido: row.idPedido,
      Cliente: row.cliente ?? "",
      Producto: row.titulo ?? "",
      Estado: row.estado ?? "",
      Fecha_Entrega: row.fechaEntrega ?? "",
      Dias_Retraso: computeDeliveryDelayDays(row),
    });
  }
  return out;
}

export function buildDelayReportCsv(rows: SalesOrderRow[]): string {
  const records = getDelayExportRecords(rows);
  const header = [
    "ID_Pedido",
    "Cliente",
    "Producto",
    "Estado",
    "Fecha_Entrega",
    "Dias_Retraso",
  ];
  const lines = [header.join(",")];
  for (const rec of records) {
    const line = [
      String(rec.ID_Pedido),
      escapeCsvField(rec.Cliente),
      escapeCsvField(rec.Producto),
      escapeCsvField(rec.Estado),
      escapeCsvField(rec.Fecha_Entrega),
      String(rec.Dias_Retraso),
    ];
    lines.push(line.join(","));
  }
  return lines.join("\r\n");
}

const DELAY_SHEET_HEADERS: (keyof DelayExportRecord)[] = [
  "ID_Pedido",
  "Cliente",
  "Producto",
  "Estado",
  "Fecha_Entrega",
  "Dias_Retraso",
];

/** Libro Excel listo para descargar (una hoja «Retrasos»). */
export function buildDelayReportXlsxBlob(rows: SalesOrderRow[]): Blob {
  const records = getDelayExportRecords(rows);
  const ws =
    records.length > 0
      ? XLSX.utils.json_to_sheet(records)
      : XLSX.utils.aoa_to_sheet([DELAY_SHEET_HEADERS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Retrasos");
  const buf = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
