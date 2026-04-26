/**
 * Tipos de la Mesa de Secuenciación de OTs (planificación drag & drop).
 *
 * - `PoolOT`: lo que llega al sidebar desde `prod_planificacion_pool` enriquecido
 *   con datos de `produccion_ot_despachadas` y `prod_ots_general`.
 * - `MesaTrabajo`: lo que vive dentro de un turno (fila en
 *   `prod_mesa_planificacion_trabajos` ya con snapshots).
 * - `CapacidadTurno`: capacidad real en `prod_mesa_capacidad_turnos`.
 * - `BoardState` / `DraftBoardState`: estructura tablero usada para render y
 *   para la simulación local (localStorage).
 */

export type TurnoKey = "manana" | "tarde";

/** ymd `yyyy-MM-dd`. */
export type DayKey = string;

/** `${DayKey}::${TurnoKey}` (clave plana de un slot). */
export type SlotKey = string;

export type MaterialStatus = "verde" | "amarillo" | "rojo";
export type TroquelStatus = "ok" | "falta" | "no_aplica" | "sin_informar";
export type TroquelModo = "informado" | "no_aplica" | "sin_informar";

/** Item del Pool en sidebar (enriquecido para mostrar en la tarjeta). */
export interface PoolOT {
  /** Nº OT (clave de negocio). */
  ot: string;
  poolId: string | null;
  cliente: string;
  trabajo: string;
  papel: string;
  tintas: string;
  /** Acabado principal (no es lo mismo que barniz, pero se usa como fallback). */
  acabadoPral: string;
  /** Barniz/acabado del impreso (puede ser null si no se distingue). */
  barniz: string | null;
  fechaEntrega: string | null;
  numHojasBrutas: number;
  /** Horas planificadas totales (entrada + tiraje). */
  horasPlanificadas: number;
  materialStatus: MaterialStatus;
  troquelStatus: TroquelStatus;
}

/** Item ya planificado en la mesa para una celda (día + turno). */
export interface MesaTrabajo {
  id: string;
  maquinaId: string | null;
  ot: string;
  fechaPlanificada: DayKey;
  turno: TurnoKey;
  slotOrden: number;
  estadoMesa: string;
  fechaEntrega: string | null;
  materialStatus: MaterialStatus;
  troquelStatus: TroquelStatus;
  acabadoPralSnapshot: string;
  /** Snapshots autocontenidos (no requieren joins para pintar la tarjeta). */
  clienteSnapshot: string;
  papelSnapshot: string;
  tintasSnapshot: string;
  barnizSnapshot: string | null;
  numHojasBrutasSnapshot: number;
  horasPlanificadasSnapshot: number;
}

/** Capacidad horaria por día y turno (config). */
export interface CapacidadTurno {
  fecha: DayKey;
  turno: TurnoKey;
  capacidadHoras: number;
  motivoAjuste: string | null;
}

/** Estado completo del tablero (lo que se renderiza). */
export interface BoardState {
  /** Trabajos por slot, ya ordenados por slot_orden. */
  bySlot: Record<SlotKey, MesaTrabajo[]>;
  /** Capacidad efectiva por slot (con default 8h si no hay registro). */
  capacityBySlot: Record<SlotKey, number>;
}

/** Borrador local usado por el "Modo Simulación" (persistido en localStorage). */
export interface DraftBoardState {
  /** Identificador (yyyy-MM-dd del lunes) para asociar el draft a la semana. */
  weekMondayKey: DayKey;
  /** Máquina productiva a la que pertenece el draft. */
  maquinaId: string;
  /** Ámbito funcional de la pantalla que creó el draft. */
  scope: "impresion";
  bySlot: Record<SlotKey, MesaTrabajo[]>;
  /** Marca temporal para evitar mostrar drafts antiguos. */
  updatedAt: string;
}

/** Resultado del cálculo de carga de un turno. */
export interface TurnLoad {
  totalHoras: number;
  capacidadHoras: number;
  /** Porcentaje (puede superar 100). */
  pct: number;
  bucket: "verde" | "naranja" | "rojo";
}
