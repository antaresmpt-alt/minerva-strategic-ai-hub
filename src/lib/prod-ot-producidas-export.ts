import * as XLSX from "xlsx";

import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

/** Exporta columnas planas del histórico a Excel (sin snapshot JSONB). */
export function exportProducidasAExcel(
  rows: ProdOtProducidaRow[],
  filename = `producidas_${new Date().toISOString().slice(0, 10)}.xlsx`,
): void {
  const data = rows.map((r) => ({
    ot_numero: r.ot_numero,
    version: r.version,
    cliente: r.cliente,
    trabajo: r.trabajo,
    referencia_minerva: r.referencia_minerva,
    referencia_cliente: r.referencia_cliente,
    cantidad_pedida: r.cantidad_pedida,
    cantidad_producida: r.cantidad_producida,
    material: r.material,
    gramaje: r.gramaje,
    formato: r.formato,
    tintas: r.tintas,
    troquel: r.troquel,
    poses: r.poses,
    acabado_pral: r.acabado_pral,
    tipo_engomado: r.tipo_engomado,
    codigo_caja_embalaje: r.codigo_caja_embalaje,
    estuches_por_bulto: r.estuches_por_bulto,
    horas_prep_impresion: r.horas_prep_impresion_reales,
    horas_tiraje_impresion: r.horas_tiraje_impresion_reales,
    horas_prep_troquelado: r.horas_prep_troquelado_reales,
    horas_tiraje_troquelado: r.horas_tiraje_troquelado_reales,
    horas_ctp: r.horas_ctp_reales,
    horas_guillotina: r.horas_guillotina_reales,
    horas_desbroce: r.horas_desbroce_reales,
    horas_total: r.horas_total_reales,
    merma_total: r.merma_total,
    fecha_inicio_real: r.fecha_inicio_real,
    fecha_fin_real: r.fecha_fin_real,
    fecha_cierre: r.fecha_cierre,
    cerrada_at: r.cerrada_at,
    excluido_de_promedios: r.excluido_de_promedios,
    motivo_exclusion: r.motivo_exclusion,
    observaciones_revision: r.observaciones_revision,
    reabierta_at: r.reabierta_at,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "producidas");
  XLSX.writeFile(wb, filename);
}
