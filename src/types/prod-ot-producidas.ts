/**
 * Bloque 6 — Histórico inmutable de OTs producidas.
 *
 * Cada fila representa una OT cerrada. Las reaperturas NO pisan la fila:
 * generan una nueva fila con `version + 1` y `reabierta_desde_id` apuntando
 * a la fila anterior.
 *
 * Para cálculos de promedios (Bloque 6.x):
 *   SELECT ... WHERE excluido_de_promedios = false
 *   GROUP BY referencia_id, ot_numero
 *   HAVING version = MAX(version)
 *
 * Convención de columnas de horas (§7.1.10):
 *   - horas_prep_*  → tiempo de preparación/entrada (absoluto, estable por artículo).
 *   - horas_tiraje_* → tiempo de tiraje/producción (base para normalizar horas/millar).
 *   - horas_*_engomado_reales → NULLABLE mientras la tarjeta de Engomado no separe prep/tiraje.
 */
export type ProdOtProducidaRow = {
  // ─── Identidad ────────────────────────────────────────────────────────────
  id: string;
  ot_numero: string;
  /** FK a prod_ots_general — puede ser null si la OT se elimina. */
  ot_id: string | null;
  /** FK a prod_referencias — puede ser null si aún no estaba asignada al cerrar. */
  referencia_id: string | null;
  referencia_minerva: string | null;
  referencia_cliente: string | null;
  cliente: string | null;
  trabajo: string | null;
  cantidad_pedida: number | null;
  cantidad_producida: number | null;

  // ─── Técnico ──────────────────────────────────────────────────────────────
  material: string | null;
  gramaje: number | null;
  formato: string | null;
  tintas: string | null;
  troquel: string | null;
  poses: number | null;
  acabado_pral: string | null;
  tipo_engomado: string | null;
  codigo_caja_embalaje: string | null;
  estuches_por_bulto: number | null;
  fsc: boolean | null;

  // ─── Producción real ──────────────────────────────────────────────────────
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  fecha_cierre: string | null;

  /** Horas de preparación/entrada de impresión (offset o digital). */
  horas_prep_impresion_reales: number | null;
  /** Horas de tiraje de impresión. Base para horas/millar (§7.1.10). */
  horas_tiraje_impresion_reales: number | null;

  /** Horas de preparación/arreglo de troquelado. */
  horas_prep_troquelado_reales: number | null;
  /** Horas de tiraje de troquelado. Base para horas/millar (§7.1.10). */
  horas_tiraje_troquelado_reales: number | null;

  /**
   * NULLABLE — La tarjeta de Engomado hoy captura un único campo "Tiempo"
   * (prep + tiraje mezclados). No se mapea hasta que se separen los campos
   * en la UI de ejecución. NULL = ausencia de dato, no dato incorrecto.
   */
  horas_prep_engomado_reales: number | null;
  /** NULLABLE — ver horas_prep_engomado_reales. */
  horas_tiraje_engomado_reales: number | null;

  /** Total de horas en guillotina (sin split prep/tiraje). */
  horas_guillotina_reales: number | null;
  /** Total de horas CTP (sin split prep/tiraje). */
  horas_ctp_reales: number | null;
  /** Total de horas de desbroce (sin split prep/tiraje). */
  horas_desbroce_reales: number | null;

  horas_total_reales: number | null;
  merma_total: number | null;

  // ─── Control / trazabilidad ───────────────────────────────────────────────
  /**
   * Copia completa de la Hoja de Ruta en el momento del cierre.
   * Inmutable: si la OT se reabre, se crea una fila nueva con version + 1.
   */
  snapshot: Record<string, unknown>;
  snapshot_version: number;
  /**
   * Número de versión para esta ot_numero (empieza en 1).
   * Promedios = MAX(version) GROUP BY ot_numero + excluido_de_promedios = false.
   */
  version: number;
  /** UUID del usuario que ejecutó el cierre. */
  cerrada_por: string | null;
  cerrada_at: string;
  observaciones_revision: string | null;
  /** Si true, esta fila se excluye de los cálculos de promedios (Bloque 6.x). */
  excluido_de_promedios: boolean;
  /** Motivo textual de la exclusión (avería, cantidad atípica, reproceso…). */
  motivo_exclusion: string | null;
  /**
   * FK a la fila anterior de esta misma OT (solo cuando version > 1).
   * Permite reconstruir la cadena completa de reaperturas.
   */
  reabierta_desde_id: string | null;
  created_at: string;
};
