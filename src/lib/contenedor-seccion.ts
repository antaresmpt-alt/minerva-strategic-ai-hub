/**
 * Bloque 11 — Contenedor genérico por sección (sin Pool/Mesa).
 * CTP/Troquel siguen en sus módulos; aquí Guillotina, Desbroce,
 * Manipulados, Engomado, Impresión Offset y Digital.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PROCESO_DESBROCE_ID,
  PROCESO_DIGITAL_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_GUILLOTINA_ID,
  PROCESO_MANIPULADOS_ID,
  PROCESO_OFFSET_ID,
} from "@/lib/despacho-wizard-shared";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import type { PlanificacionTipoMaquina } from "@/lib/planificacion-ambito";

export type ContenedorSeccionKind =
  | "guillotina"
  | "desbroce"
  | "manipulados"
  | "engomado"
  | "impresion"
  | "digital";

export type ContenedorSeccionMaquina = {
  id: string;
  nombre: string;
  tipoMaquina: string;
};

export type ContenedorSeccionPaso = {
  kind: ContenedorSeccionKind;
  otPasoId: string;
  otId: string;
  otNumero: string;
  orden: number;
  procesoId: number;
  datosProceso: Record<string, unknown> | null;
  ejecutable: boolean;
  isPrueba: boolean;
  fechaEntrega: string | null;
  horasPlanificadas: number;
};

export type ContenedorSeccionDef = {
  kind: ContenedorSeccionKind;
  procesoId: number;
  /** Prefijo id virtual: contenedor-{kind}: */
  labelBadge: string;
  /** tipo_maquina en prod_maquinas (filtro rol / listado). */
  tipoMaquina: PlanificacionTipoMaquina;
  /** Si true, claim al iniciar (multi-máquina). */
  claim: boolean;
  horasDefault: number;
  /**
   * Máquina fija por nombre (Manipulados MNRV vive en tipo engomado).
   * Si falta, se usa la primera activa del tipo.
   */
  maquinaNombreExacto?: string;
  /** En claim: excluir nombres (p.ej. Manipulados del listado engomado). */
  excludeMaquinaNombres?: readonly string[];
  /** Columna despacho opcional para horas plan. */
  horasDespachoField?:
    | "horas_estimadas_engomado"
    | "horas_estimadas_troquelado";
  /** Suma de columnas despacho (Offset: entrada + tiraje). */
  horasDespachoSumFields?: readonly ("horas_entrada" | "horas_tiraje")[];
  /** Etiqueta del selector claim. */
  claimSelectLabel?: string;
};

export const CONTENEDOR_SECCION_DEFS: readonly ContenedorSeccionDef[] = [
  {
    kind: "guillotina",
    procesoId: PROCESO_GUILLOTINA_ID,
    labelBadge: "Contenedor Guillotina",
    tipoMaquina: "guillotina",
    claim: false,
    horasDefault: 0.5,
  },
  {
    kind: "desbroce",
    procesoId: PROCESO_DESBROCE_ID,
    labelBadge: "Contenedor Desbroce",
    tipoMaquina: "desbroce",
    claim: false,
    horasDefault: 0.5,
  },
  {
    kind: "manipulados",
    procesoId: PROCESO_MANIPULADOS_ID,
    labelBadge: "Contenedor Manipulados",
    tipoMaquina: "engomado",
    claim: false,
    horasDefault: 0.5,
    maquinaNombreExacto: "Manipulados MNRV",
  },
  {
    kind: "engomado",
    procesoId: PROCESO_ENGOMADO_ID,
    labelBadge: "Contenedor Engomado",
    tipoMaquina: "engomado",
    claim: true,
    horasDefault: 1,
    excludeMaquinaNombres: ["Manipulados MNRV"],
    horasDespachoField: "horas_estimadas_engomado",
    claimSelectLabel: "Engomadora",
  },
  {
    // Hoy 1 Heidelberg → sin claim (como CTP). Si hay más, pasar claim:true.
    kind: "impresion",
    procesoId: PROCESO_OFFSET_ID,
    labelBadge: "Contenedor Impresión",
    tipoMaquina: "impresion",
    claim: false,
    horasDefault: 2,
    horasDespachoSumFields: ["horas_entrada", "horas_tiraje"],
  },
  {
    kind: "digital",
    procesoId: PROCESO_DIGITAL_ID,
    labelBadge: "Contenedor Digital",
    tipoMaquina: "digital",
    claim: true,
    horasDefault: 1,
    horasDespachoSumFields: ["horas_entrada", "horas_tiraje"],
    claimSelectLabel: "Máquina digital",
  },
] as const;

export function contenedorSeccionPrefix(kind: ContenedorSeccionKind): string {
  return `contenedor-${kind}:`;
}

export function contenedorSeccionVirtualId(
  kind: ContenedorSeccionKind,
  otPasoId: string,
): string {
  return `${contenedorSeccionPrefix(kind)}${otPasoId}`;
}

export function parseContenedorSeccionVirtualId(
  id: string | null | undefined,
): { kind: ContenedorSeccionKind; otPasoId: string } | null {
  const raw = String(id ?? "").trim();
  for (const def of CONTENEDOR_SECCION_DEFS) {
    const prefix = contenedorSeccionPrefix(def.kind);
    if (!raw.startsWith(prefix)) continue;
    const pasoId = raw.slice(prefix.length).trim();
    if (!pasoId) return null;
    return { kind: def.kind, otPasoId: pasoId };
  }
  return null;
}

export function isContenedorSeccionVirtualId(
  id: string | null | undefined,
): boolean {
  return parseContenedorSeccionVirtualId(id) != null;
}

export function defContenedorSeccion(
  kind: ContenedorSeccionKind,
): ContenedorSeccionDef {
  const def = CONTENEDOR_SECCION_DEFS.find((d) => d.kind === kind);
  if (!def) throw new Error(`Sección contenedor desconocida: ${kind}`);
  return def;
}

export function seccionesVisiblesParaTipoFiltro(
  tipoFiltro: PlanificacionTipoMaquina | null,
): ContenedorSeccionDef[] {
  if (!tipoFiltro) return [...CONTENEDOR_SECCION_DEFS];
  return CONTENEDOR_SECCION_DEFS.filter((d) => d.tipoMaquina === tipoFiltro);
}

export async function fetchMaquinasContenedorSeccion(
  supabase: SupabaseClient,
  def: ContenedorSeccionDef,
): Promise<ContenedorSeccionMaquina[]> {
  let q = supabase
    .from("prod_maquinas")
    .select("id, nombre, tipo_maquina")
    .eq("activa", true)
    .eq("tipo_maquina", def.tipoMaquina)
    .order("nombre", { ascending: true });

  if (def.maquinaNombreExacto) {
    q = q.eq("nombre", def.maquinaNombreExacto);
  }

  const { data, error } = await q;
  if (error) throw error;

  const exclude = new Set(
    (def.excludeMaquinaNombres ?? []).map((n) => n.trim().toLowerCase()),
  );

  return ((data ?? []) as Array<{
    id?: string;
    nombre?: string | null;
    tipo_maquina?: string | null;
  }>)
    .map((m) => {
      const id = String(m.id ?? "").trim();
      const nombre = String(m.nombre ?? "").trim();
      if (!id || !nombre) return null;
      if (exclude.has(nombre.toLowerCase())) return null;
      return {
        id,
        nombre,
        tipoMaquina: String(m.tipo_maquina ?? def.tipoMaquina),
      };
    })
    .filter((m): m is ContenedorSeccionMaquina => m != null);
}

export async function fetchContenedorSeccionPasosDisponibles(
  supabase: SupabaseClient,
  def: ContenedorSeccionDef,
  options?: {
    includePruebas?: boolean;
    soloEjecutable?: boolean;
    otPasoIdsConEjecucionActiva?: ReadonlySet<string>;
  },
): Promise<ContenedorSeccionPaso[]> {
  const includePruebas = options?.includePruebas === true;
  const soloEjecutable = options?.soloEjecutable !== false;
  const occupied = options?.otPasoIdsConEjecucionActiva ?? new Set<string>();

  const { data: pasoRows, error: pasoErr } = await supabase
    .from("prod_ot_pasos")
    .select("id, ot_id, orden, estado, datos_proceso, proceso_id")
    .eq("proceso_id", def.procesoId)
    .eq("estado", "disponible")
    .order("orden", { ascending: true });
  if (pasoErr) throw pasoErr;

  const pasos = (pasoRows ?? []).filter((p) => {
    const id = String((p as { id?: string }).id ?? "").trim();
    return id && !occupied.has(id);
  }) as Array<{
    id: string;
    ot_id: string;
    orden: number | null;
    datos_proceso: Record<string, unknown> | null;
  }>;

  if (pasos.length === 0) return [];

  const otIds = [
    ...new Set(pasos.map((p) => String(p.ot_id ?? "").trim()).filter(Boolean)),
  ];

  const maestros = await fetchAllInChunks(otIds, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ots_general")
      .select("id, num_pedido, fecha_entrega, despachado")
      .in("id", chunk);
    if (error) throw error;
    return data ?? [];
  });

  const maestroById = new Map<
    string,
    { num_pedido: string; fecha_entrega: string | null; despachado: boolean }
  >();
  for (const m of maestros as Array<{
    id?: string;
    num_pedido?: string;
    fecha_entrega?: string | null;
    despachado?: boolean | null;
  }>) {
    const id = String(m.id ?? "").trim();
    const num = String(m.num_pedido ?? "").trim();
    if (!id || !num) continue;
    maestroById.set(id, {
      num_pedido: num,
      fecha_entrega: m.fecha_entrega ?? null,
      despachado: Boolean(m.despachado),
    });
  }

  const otNumeros = [...maestroById.values()]
    .filter((m) => m.despachado)
    .map((m) => m.num_pedido);
  const horasByOt = new Map<string, number>();
  if (otNumeros.length > 0 && (def.horasDespachoField || def.horasDespachoSumFields?.length)) {
    const selectCols = new Set<string>(["ot_numero"]);
    if (def.horasDespachoField) selectCols.add(def.horasDespachoField);
    for (const f of def.horasDespachoSumFields ?? []) selectCols.add(f);
    const select = [...selectCols].join(", ");
    const despRows = await fetchAllInChunks(otNumeros, 80, async (chunk) => {
      const { data, error } = await supabase
        .from("produccion_ot_despachadas")
        .select(select)
        .in("ot_numero", chunk);
      if (error) throw error;
      return data ?? [];
    });
    for (const d of despRows as Array<Record<string, unknown>>) {
      const ot = String(d.ot_numero ?? "").trim();
      if (!ot) continue;
      let h = 0;
      if (def.horasDespachoField) {
        const v = d[def.horasDespachoField];
        if (typeof v === "number" && Number.isFinite(v) && v > 0) h = v;
      }
      if (def.horasDespachoSumFields?.length) {
        let sum = 0;
        for (const f of def.horasDespachoSumFields) {
          const v = d[f];
          if (typeof v === "number" && Number.isFinite(v) && v > 0) sum += v;
        }
        if (sum > 0) h = sum;
      }
      if (h > 0) horasByOt.set(ot, h);
    }
  }

  const out: ContenedorSeccionPaso[] = [];
  for (const p of pasos) {
    const otId = String(p.ot_id ?? "").trim();
    const maestro = maestroById.get(otId);
    if (!maestro?.despachado) continue;
    const otNumero = maestro.num_pedido;
    const isPrueba = isOtNumeroPrueba(otNumero);
    if (!includePruebas && isPrueba) continue;

    const ejecutable = true;
    if (soloEjecutable && !ejecutable) continue;

    out.push({
      kind: def.kind,
      otPasoId: String(p.id),
      otId,
      otNumero,
      orden: typeof p.orden === "number" ? p.orden : 0,
      procesoId: def.procesoId,
      datosProceso: p.datos_proceso ?? null,
      ejecutable,
      isPrueba,
      fechaEntrega: maestro.fecha_entrega,
      horasPlanificadas: horasByOt.get(otNumero) ?? def.horasDefault,
    });
  }

  out.sort((a, b) => {
    const fa = a.fechaEntrega ?? "9999-12-31";
    const fb = b.fechaEntrega ?? "9999-12-31";
    if (fa !== fb) return fa.localeCompare(fb);
    return a.otNumero.localeCompare(b.otNumero, "es", { numeric: true });
  });

  return out;
}

export type CrearEjecucionLigeraSeccionInput = {
  otNumero: string;
  otPasoId: string;
  maquinaId: string;
  horasPlanificadas?: number | null;
  horasDefault?: number;
  userId?: string | null;
  userEmail?: string | null;
  startImmediately?: boolean;
};

export async function crearEjecucionLigeraSeccion(
  supabase: SupabaseClient,
  input: CrearEjecucionLigeraSeccionInput,
): Promise<{ id: string }> {
  const otNumero = String(input.otNumero ?? "").trim();
  const otPasoId = String(input.otPasoId ?? "").trim();
  const maquinaId = String(input.maquinaId ?? "").trim();
  if (!otNumero || !otPasoId || !maquinaId) {
    throw new Error(
      "Faltan OT, paso o máquina para crear la ejecución del contenedor.",
    );
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const horasDefault = input.horasDefault ?? 0.5;
  const horas =
    typeof input.horasPlanificadas === "number" &&
    Number.isFinite(input.horasPlanificadas) &&
    input.horasPlanificadas > 0
      ? input.horasPlanificadas
      : horasDefault;

  const { data, error } = await supabase
    .from("prod_mesa_ejecuciones")
    .insert({
      mesa_trabajo_id: null,
      ot_numero: otNumero,
      maquina_id: maquinaId,
      ot_paso_id: otPasoId,
      fecha_planificada: today,
      turno: null,
      slot_orden: null,
      liberada_at: nowIso,
      inicio_real_at: null,
      estado_ejecucion: "pendiente_inicio",
      horas_planificadas_snapshot: horas,
      created_by: input.userId ?? null,
      created_by_email: input.userEmail ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const id = String((data as { id?: string } | null)?.id ?? "").trim();
  if (!id) throw new Error("No se obtuvo id de la ejecución contenedor.");

  if (input.startImmediately) {
    const { error: startErr } = await supabase
      .from("prod_mesa_ejecuciones")
      .update({
        estado_ejecucion: "en_curso",
        inicio_real_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (startErr) throw startErr;
  }

  return { id };
}
