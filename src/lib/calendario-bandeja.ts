/**
 * Bandeja computada — Bloque 11 §5.
 * OTs despachadas sin pastilla en el ámbito activo (query, no auto-insert al despachar).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import {
  fetchItinerarioCalendarioByOtNumeros,
  semaforoForAmbito,
  type CalendarioItinerarioOt,
  type CalendarioPasoTipado,
} from "@/lib/calendario-produccion-progreso";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_CALENDARIO = "prod_calendario_produccion_ot";
const TABLE_MAESTRO = "prod_ots_general";

/** Ámbitos «impresión» upstream de troquel (I y/o D según itinerario). */
const PRINT_AMBITOS: CalendarioAmbito[] = ["impresion", "digital"];

export type CalendarioBandejaRow = {
  otNumero: string;
  cliente: string | null;
  trabajo: string | null;
  fechaEntrega: string | null;
  despachadoAt: string | null;
  semaforo: ReturnType<typeof semaforoForAmbito>;
  /** Motivo si queda oculta con filtro cadena (debug / tooltip). */
  cadenaBloqueada?: boolean;
};

export type CalendarioBandejaPillKey = `${CalendarioAmbito}:${string}`;

/** Clave única pastilla en calendario (ámbito + OT). */
export function pillKey(ambito: CalendarioAmbito, otNumero: string): CalendarioBandejaPillKey {
  return `${ambito}:${otNumero.trim()}`;
}

/** Pastillas ya colocadas (cualquier fecha). */
export function buildPillsSet(
  rows: ReadonlyArray<{ ot_numero: string; ambito: string }>,
): Set<CalendarioBandejaPillKey> {
  const out = new Set<CalendarioBandejaPillKey>();
  for (const r of rows) {
    const ot = String(r.ot_numero ?? "").trim();
    const a = String(r.ambito ?? "").trim() as CalendarioAmbito;
    if (ot && a) out.add(pillKey(a, ot));
  }
  return out;
}

/** Ámbito upstream para filtro cadena de visualización (§5). */
export function upstreamAmbitoCadena(
  ambito: CalendarioAmbito,
): CalendarioAmbito | null {
  if (ambito === "troquelado") return null; // I/D según itinerario
  if (ambito === "engomado") return "troquelado";
  return null;
}

export function ambitosPrintEnItinerario(
  pasos: readonly CalendarioPasoTipado[],
): CalendarioAmbito[] {
  return PRINT_AMBITOS.filter((a) => pasos.some((p) => p.ambito === a));
}

/** Pastilla colocada (cualquier día) o paso(s) del ámbito finalizado(s). */
export function colocadoOHecho(
  pasos: readonly CalendarioPasoTipado[],
  pills: ReadonlySet<CalendarioBandejaPillKey>,
  ambito: CalendarioAmbito,
  otNumero: string,
): boolean {
  if (pills.has(pillKey(ambito, otNumero))) return true;
  return semaforoForAmbito(pasos, ambito) === "hecho";
}

/** Filtro cadena §5 — solo visualización. */
export function cadenaUpstreamOk(
  ambito: CalendarioAmbito,
  otNumero: string,
  pasos: readonly CalendarioPasoTipado[],
  pills: ReadonlySet<CalendarioBandejaPillKey>,
): boolean {
  if (ambito === "impresion" || ambito === "digital") return true;

  if (ambito === "troquelado") {
    const prints = ambitosPrintEnItinerario(pasos);
    if (prints.length === 0) return true;
    return prints.every((a) => colocadoOHecho(pasos, pills, a, otNumero));
  }

  if (ambito === "engomado") {
    const tieneT = pasos.some((p) => p.ambito === "troquelado");
    if (!tieneT) return true;
    return colocadoOHecho(pasos, pills, "troquelado", otNumero);
  }

  return true;
}

export type BandejaFilterInput = {
  ambito: CalendarioAmbito;
  verTodas: boolean;
  mostrarPruebas: boolean;
  filtroTexto: string;
  pills: ReadonlySet<CalendarioBandejaPillKey>;
  itinerarioByOt: ReadonlyMap<string, CalendarioItinerarioOt>;
  candidatos: ReadonlyArray<{
    otNumero: string;
    cliente: string | null;
    trabajo: string | null;
    fechaEntrega: string | null;
    despachadoAt: string | null;
  }>;
};

/** Filtra y ordena filas de bandeja (puro — testeable). */
export function filterBandejaRows(input: BandejaFilterInput): CalendarioBandejaRow[] {
  const needle = input.filtroTexto.trim().toLowerCase();
  const out: CalendarioBandejaRow[] = [];

  for (const c of input.candidatos) {
    const ot = String(c.otNumero ?? "").trim();
    if (!ot) continue;
    if (!input.mostrarPruebas && isOtNumeroPrueba(ot)) continue;
    if (input.pills.has(pillKey(input.ambito, ot))) continue;

    const info = input.itinerarioByOt.get(ot);
    const pasos = info?.pasos ?? [];
    const sem = semaforoForAmbito(pasos, input.ambito);
    if (sem === "sin_paso" || sem === "hecho") continue;

    if (!input.verTodas && !cadenaUpstreamOk(input.ambito, ot, pasos, input.pills)) {
      continue;
    }

    if (needle) {
      const hay = [ot, c.cliente, c.trabajo]
        .map((x) => String(x ?? "").toLowerCase())
        .some((x) => x.includes(needle));
      if (!hay) continue;
    }

    out.push({
      otNumero: ot,
      cliente: c.cliente,
      trabajo: c.trabajo,
      fechaEntrega: c.fechaEntrega,
      despachadoAt: c.despachadoAt,
      semaforo: sem,
    });
  }

  out.sort((a, b) => {
    const fa = a.fechaEntrega?.slice(0, 10) ?? "9999-99-99";
    const fb = b.fechaEntrega?.slice(0, 10) ?? "9999-99-99";
    if (fa !== fb) return fa.localeCompare(fb);
    const da = a.despachadoAt ?? "";
    const db = b.despachadoAt ?? "";
    return db.localeCompare(da);
  });

  return out;
}

type DespRow = {
  ot_numero?: string | null;
  despachado_at?: string | null;
};

export async function fetchCalendarioBandejaRaw(
  supabase: SupabaseClient,
): Promise<{
  candidatos: BandejaFilterInput["candidatos"];
  pills: Set<CalendarioBandejaPillKey>;
  itinerarioByOt: Map<string, CalendarioItinerarioOt>;
}> {
  const { data: despData, error: despErr } = await supabase
    .from(TABLE_DESPACHADAS)
    .select("ot_numero, despachado_at")
    .order("despachado_at", { ascending: false })
    .limit(1500);
  if (despErr) throw despErr;

  const despByOt = new Map<string, string | null>();
  for (const d of (despData ?? []) as DespRow[]) {
    const ot = String(d.ot_numero ?? "").trim();
    if (!ot || despByOt.has(ot)) continue;
    despByOt.set(ot, d.despachado_at ?? null);
  }

  const ots = [...despByOt.keys()];
  if (ots.length === 0) {
    return {
      candidatos: [],
      pills: new Set(),
      itinerarioByOt: new Map(),
    };
  }

  const pillRows = await fetchAllInChunks(ots, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_CALENDARIO)
      .select("ot_numero, ambito")
      .in("ot_numero", chunk);
    if (error) throw error;
    return (data ?? []) as Array<{ ot_numero: string; ambito: string }>;
  });

  const maestroRows = await fetchAllInChunks(ots, 100, async (chunk) => {
    const { data, error } = await supabase
      .from(TABLE_MAESTRO)
      .select("num_pedido, cliente, titulo, fecha_entrega")
      .in("num_pedido", chunk);
    if (error) throw error;
    return (data ?? []) as Array<{
      num_pedido?: string;
      cliente?: string | null;
      titulo?: string | null;
      fecha_entrega?: string | null;
    }>;
  });

  const itinerarioByOt = await fetchItinerarioCalendarioByOtNumeros(supabase, ots);

  const maestroByOt = new Map<
    string,
    { cliente: string | null; trabajo: string | null; fechaEntrega: string | null }
  >();
  for (const m of maestroRows) {
    const ot = String(m.num_pedido ?? "").trim();
    if (!ot) continue;
    maestroByOt.set(ot, {
      cliente: m.cliente ?? null,
      trabajo: m.titulo ?? null,
      fechaEntrega: m.fecha_entrega ?? null,
    });
  }

  const candidatos: BandejaFilterInput["candidatos"] = ots.map((ot) => {
    const meta = maestroByOt.get(ot);
    return {
      otNumero: ot,
      cliente: meta?.cliente ?? null,
      trabajo: meta?.trabajo ?? null,
      fechaEntrega: meta?.fechaEntrega ?? null,
      despachadoAt: despByOt.get(ot) ?? null,
    };
  });

  return {
    candidatos,
    pills: buildPillsSet(pillRows),
    itinerarioByOt,
  };
}

export async function fetchCalendarioBandeja(
  supabase: SupabaseClient,
  params: {
    ambito: CalendarioAmbito;
    verTodas: boolean;
    mostrarPruebas: boolean;
    filtroTexto: string;
  },
): Promise<CalendarioBandejaRow[]> {
  const raw = await fetchCalendarioBandejaRaw(supabase);
  return filterBandejaRows({
    ...params,
    pills: raw.pills,
    itinerarioByOt: raw.itinerarioByOt,
    candidatos: raw.candidatos,
  });
}
