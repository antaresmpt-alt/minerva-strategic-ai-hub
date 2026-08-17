import { fmtCantidad, fmtDate } from "@/lib/hoja-ruta/hoja-ruta-formatters";
import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

export type ProducidaVersionDiffRow = {
  label: string;
  left: string;
  right: string;
  changed: boolean;
};

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return fmtCantidad(v) ?? String(v);
  return String(v).trim() || "—";
}

const DIFF_FIELDS: Array<{
  label: string;
  pick: (r: ProdOtProducidaRow) => string | number | null | undefined;
}> = [
  { label: "Cantidad pedida", pick: (r) => r.cantidad_pedida },
  { label: "Cantidad producida", pick: (r) => r.cantidad_producida },
  { label: "Material", pick: (r) => r.material },
  { label: "Gramaje", pick: (r) => r.gramaje },
  { label: "Formato", pick: (r) => r.formato },
  { label: "Tintas", pick: (r) => r.tintas },
  { label: "Troquel", pick: (r) => r.troquel },
  { label: "Poses", pick: (r) => r.poses },
  { label: "Acabado PRAL", pick: (r) => r.acabado_pral },
  { label: "Tipo engomado", pick: (r) => r.tipo_engomado },
  { label: "Caja embalaje", pick: (r) => r.codigo_caja_embalaje },
  { label: "Estuches/bulto", pick: (r) => r.estuches_por_bulto },
  { label: "Horas total", pick: (r) => r.horas_total_reales },
  { label: "Merma total", pick: (r) => r.merma_total },
  { label: "Obs. revisión", pick: (r) => r.observaciones_revision },
  { label: "Cerrada", pick: (r) => fmtDate(r.cerrada_at) },
];

export function buildProducidaVersionDiff(
  a: ProdOtProducidaRow,
  b: ProdOtProducidaRow,
): ProducidaVersionDiffRow[] {
  return DIFF_FIELDS.map(({ label, pick }) => {
    const left = cell(pick(a));
    const right = cell(pick(b));
    return { label, left, right, changed: left !== right };
  });
}

export function versionsForOt(
  rows: ProdOtProducidaRow[],
  otNumero: string,
): ProdOtProducidaRow[] {
  return rows
    .filter((r) => r.ot_numero === otNumero)
    .sort((x, y) => x.version - y.version);
}
