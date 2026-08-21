/**
 * Bloque 11 PR1 — Espejo de solo lectura Calendario ↔ Mesa / Pool.
 * No escribe fechas ni sincroniza; solo informa quién manda ahora.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import type {
  CalendarioItinerarioOt,
  CalendarioPasoTipado,
  CalendarioSemaforoAmbito,
} from "@/lib/calendario-produccion-progreso";
import { semaforoForAmbito } from "@/lib/calendario-produccion-progreso";
import {
  parsePlanificacionTipoMaquina,
  type PlanificacionTipoMaquina,
} from "@/lib/planificacion-ambito";
import { MESA_ESTADOS_ACTIVOS } from "@/lib/planificacion-pasar-a-mesa";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

const TABLE_POOL = "prod_planificacion_pool";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_MAQUINAS = "prod_maquinas";

export type CalendarioPlantaFase =
  | "planificada"
  | "en_cola"
  | "en_mesa"
  | "en_curso"
  | "hecha";

export type CalendarioMesaTrabajo = {
  otNumero: string;
  fechaPlanificada: string;
  turno: string | null;
  maquinaId: string | null;
  maquinaNombre: string | null;
  tipoMaquina: PlanificacionTipoMaquina | null;
  estadoMesa: string;
};

export type CalendarioEspejoOt = {
  poolEstado: string | null;
  /** Trabajos de mesa activos (cualquier tipo de máquina). */
  mesaTrabajos: CalendarioMesaTrabajo[];
};

export type CalendarioPastillaEspejo = {
  fase: CalendarioPlantaFase;
  /** Label corto para la pastilla (Cola / Mesa 22/08 / …). */
  badge: string;
  title: string;
  mesaFecha: string | null;
  mesaTurno: string | null;
  mesaMaquina: string | null;
  /** True si hay fecha Mesa del mismo ámbito distinta a la del calendario. */
  fechaDifiere: boolean;
};

/** Primer paso disponible (cualquier sección) — label corto. */
export function labelPasoDisponible(
  pasos: readonly CalendarioPasoTipado[],
): string | null {
  const disp = pasos.find(
    (p) => String(p.estado ?? "").trim().toLowerCase() === "disponible",
  );
  if (!disp) return null;
  const n = String(disp.nombre ?? "").trim();
  if (!n || n === "—") return null;
  return n.length > 14 ? `${n.slice(0, 13)}…` : n;
}

export async function fetchCalendarioEspejoByOtNumeros(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, CalendarioEspejoOt>> {
  const out = new Map<string, CalendarioEspejoOt>();
  const ots = [
    ...new Set(otNumeros.map((o) => String(o ?? "").trim()).filter(Boolean)),
  ];
  if (ots.length === 0) return out;

  for (const ot of ots) {
    out.set(ot, { poolEstado: null, mesaTrabajos: [] });
  }

  const [poolRows, mesaRows] = await Promise.all([
    fetchAllInChunks(ots, 100, async (chunk) => {
      const { data, error } = await supabase
        .from(TABLE_POOL)
        .select("ot_numero, estado_pool, updated_at")
        .in("ot_numero", chunk)
        .in("estado_pool", ["pendiente", "enviada_mesa", "en_transito", "cerrada"]);
      if (error) throw error;
      return (data ?? []) as Array<{
        ot_numero?: string | null;
        estado_pool?: string | null;
        updated_at?: string | null;
      }>;
    }),
    fetchAllInChunks(ots, 100, async (chunk) => {
      const { data, error } = await supabase
        .from(TABLE_MESA)
        .select(
          "ot_numero, fecha_planificada, turno, maquina_id, maquina, estado_mesa",
        )
        .in("ot_numero", chunk)
        .in("estado_mesa", [...MESA_ESTADOS_ACTIVOS]);
      if (error) throw error;
      return (data ?? []) as Array<{
        ot_numero?: string | null;
        fecha_planificada?: string | null;
        turno?: string | null;
        maquina_id?: string | null;
        maquina?: string | null;
        estado_mesa?: string | null;
      }>;
    }),
  ]);

  // Si hay varias filas pool por OT, quedarnos con la más reciente.
  const poolBest = new Map<string, { estado: string; updated: string }>();
  for (const r of poolRows) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const estado = String(r.estado_pool ?? "").trim().toLowerCase();
    if (!estado) continue;
    const updated = String(r.updated_at ?? "");
    const prev = poolBest.get(ot);
    if (!prev || updated > prev.updated) {
      poolBest.set(ot, { estado, updated });
    }
  }
  for (const [ot, info] of poolBest) {
    const cur = out.get(ot) ?? { poolEstado: null, mesaTrabajos: [] };
    cur.poolEstado = info.estado;
    out.set(ot, cur);
  }

  const mqIds = new Set<string>();
  for (const r of mesaRows) {
    const mid = String(r.maquina_id ?? "").trim();
    if (mid) mqIds.add(mid);
  }
  const tipoById = new Map<
    string,
    { tipo: PlanificacionTipoMaquina | null; nombre: string | null }
  >();
  if (mqIds.size > 0) {
    const { data: mqData, error: mqErr } = await supabase
      .from(TABLE_MAQUINAS)
      .select("id, tipo_maquina, nombre")
      .in("id", [...mqIds]);
    if (mqErr) throw mqErr;
    for (const m of mqData ?? []) {
      const id = String((m as { id?: string }).id ?? "").trim();
      if (!id) continue;
      tipoById.set(id, {
        tipo: parsePlanificacionTipoMaquina(
          (m as { tipo_maquina?: string | null }).tipo_maquina,
        ),
        nombre: String((m as { nombre?: string | null }).nombre ?? "").trim() || null,
      });
    }
  }

  for (const r of mesaRows) {
    const ot = String(r.ot_numero ?? "").trim();
    if (!ot) continue;
    const mid = String(r.maquina_id ?? "").trim() || null;
    const mq = mid ? tipoById.get(mid) : undefined;
    const fecha = String(r.fecha_planificada ?? "").trim();
    if (!fecha) continue;
    const trabajo: CalendarioMesaTrabajo = {
      otNumero: ot,
      fechaPlanificada: fecha,
      turno: String(r.turno ?? "").trim() || null,
      maquinaId: mid,
      maquinaNombre:
        mq?.nombre ??
        (String(r.maquina ?? "").trim() || null),
      tipoMaquina: mq?.tipo ?? null,
      estadoMesa: String(r.estado_mesa ?? "").trim().toLowerCase(),
    };
    const cur = out.get(ot) ?? { poolEstado: null, mesaTrabajos: [] };
    cur.mesaTrabajos.push(trabajo);
    out.set(ot, cur);
  }

  return out;
}

function formatDiaCorto(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}`;
}

function pickMesaParaAmbito(
  trabajos: readonly CalendarioMesaTrabajo[],
  ambito: CalendarioAmbito,
): CalendarioMesaTrabajo | null {
  const match = trabajos.find((t) => t.tipoMaquina === ambito);
  if (match) return match;
  // Sin máquina aún (cola lateral no crea fila; si hay fila sin tipo, no atribuir a ámbito).
  return null;
}

/**
 * Deriva fase + badge para una pastilla (ámbito concreto).
 */
export function derivePastillaEspejo(args: {
  ambito: CalendarioAmbito;
  fechaCalendario: string;
  itinerario: CalendarioItinerarioOt | undefined;
  espejo: CalendarioEspejoOt | undefined;
}): CalendarioPastillaEspejo {
  const semaforo: CalendarioSemaforoAmbito = semaforoForAmbito(
    args.itinerario?.pasos ?? [],
    args.ambito,
  );

  if (semaforo === "hecho") {
    return {
      fase: "hecha",
      badge: "Hecha",
      title: "Paso(s) del ámbito finalizado(s)",
      mesaFecha: null,
      mesaTurno: null,
      mesaMaquina: null,
      fechaDifiere: false,
    };
  }

  const pasosAmbito = (args.itinerario?.pasos ?? []).filter(
    (p) => p.ambito === args.ambito,
  );
  const enCurso = pasosAmbito.some((p) => {
    const e = String(p.estado ?? "").trim().toLowerCase();
    return e === "en_marcha" || e === "pausado";
  });
  if (enCurso) {
    return {
      fase: "en_curso",
      badge: "En curso",
      title: "Paso del ámbito en marcha o pausado",
      mesaFecha: null,
      mesaTurno: null,
      mesaMaquina: null,
      fechaDifiere: false,
    };
  }

  const mesa = pickMesaParaAmbito(
    args.espejo?.mesaTrabajos ?? [],
    args.ambito,
  );
  if (mesa) {
    const cal = args.fechaCalendario.slice(0, 10);
    const mesaYmd = mesa.fechaPlanificada.slice(0, 10);
    const difiere = cal !== mesaYmd;
    const dia = formatDiaCorto(mesaYmd);
    const turno = mesa.turno ? ` ${mesa.turno}` : "";
    return {
      fase: "en_mesa",
      badge: difiere ? `Mesa ${dia}≠` : `Mesa ${dia}`,
      title: difiere
        ? `Intención ${formatDiaCorto(cal)} · Mesa ${dia}${turno}${
            mesa.maquinaNombre ? ` · ${mesa.maquinaNombre}` : ""
          }`
        : `En Mesa ${dia}${turno}${
            mesa.maquinaNombre ? ` · ${mesa.maquinaNombre}` : ""
          }`,
      mesaFecha: mesaYmd,
      mesaTurno: mesa.turno,
      mesaMaquina: mesa.maquinaNombre,
      fechaDifiere: difiere,
    };
  }

  const pool = String(args.espejo?.poolEstado ?? "")
    .trim()
    .toLowerCase();
  if (pool === "enviada_mesa") {
    return {
      fase: "en_cola",
      badge: "En cola",
      title: "En cola de Mesa (sin día/máquina aún). El calendario sigue siendo la intención.",
      mesaFecha: null,
      mesaTurno: null,
      mesaMaquina: null,
      fechaDifiere: false,
    };
  }

  return {
    fase: "planificada",
    badge: "",
    title: "Solo planificada en calendario",
    mesaFecha: null,
    mesaTurno: null,
    mesaMaquina: null,
    fechaDifiere: false,
  };
}

export const ESPEJO_FASE_STYLES: Record<
  CalendarioPlantaFase,
  { chip: string }
> = {
  planificada: { chip: "" },
  en_cola: {
    chip: "bg-violet-100 text-violet-900 ring-1 ring-violet-300/60",
  },
  en_mesa: {
    chip: "bg-sky-100 text-sky-950 ring-1 ring-sky-300/50",
  },
  en_curso: {
    chip: "bg-amber-100 text-amber-950 ring-1 ring-amber-300/50",
  },
  hecha: {
    chip: "bg-[#002147]/10 text-[#002147] ring-1 ring-[#002147]/20",
  },
};
