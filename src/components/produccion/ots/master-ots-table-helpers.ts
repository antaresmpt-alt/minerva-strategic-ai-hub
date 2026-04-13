import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

import type { ProdOtsGeneralRow } from "@/types/prod-ots";

const ESTADO_COD_LABEL: Record<number, string> = {
  4: "Terminado",
  3: "En producción",
  1: "Lanzado",
  2: "Retrasado",
};

/** Nunca mostrar solo un número: prioriza `estado_desc` textual y cae a etiqueta por código. */
export function estadoDisplayForRow(row: ProdOtsGeneralRow): string {
  const d = (row.estado_desc ?? "").trim();
  if (d && !/^\d+$/.test(d)) return d;
  if (/^\d+$/.test(d)) {
    const n = Number(d);
    return ESTADO_COD_LABEL[n] ?? "—";
  }
  const c = row.estado_cod;
  if (c != null && ESTADO_COD_LABEL[c]) return ESTADO_COD_LABEL[c];
  return "—";
}

export function formatDateDDMMYY(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function statusBadge(row: ProdOtsGeneralRow): {
  label: string;
  className: string;
  icon: LucideIcon | null;
} {
  const display = estadoDisplayForRow(row);
  const desc = display.toLowerCase();
  const cod = row.estado_cod;
  const terminado = cod === 4 || desc.includes("termin");
  const retrasado =
    desc.includes("retras") ||
    (row.prioridad != null && row.prioridad < 5 && !terminado);
  const produccion =
    desc.includes("lanz") ||
    desc.includes("producci") ||
    desc.includes("en curso") ||
    desc.includes("en cola");

  if (terminado) {
    return {
      label: display,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 gap-1 pr-2 pl-1.5",
      icon: Check,
    };
  }
  if (retrasado) {
    return {
      label: display || "Atención",
      className:
        "border-amber-300 bg-amber-50 text-amber-950 gap-1 pr-2 pl-1.5",
      icon: null,
    };
  }
  if (produccion) {
    return {
      label: display || "Producción",
      className:
        "border-blue-200 bg-blue-50 text-blue-950 gap-1 pr-2 pl-1.5",
      icon: null,
    };
  }
  return {
    label: display || "—",
    className: "border-slate-200 bg-slate-50 text-slate-800",
    icon: null,
  };
}
