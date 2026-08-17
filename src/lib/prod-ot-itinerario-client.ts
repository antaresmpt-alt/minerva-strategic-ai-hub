import type { SupabaseClient } from "@supabase/supabase-js";

import type { DespachoItinerarioSlot } from "@/components/produccion/ots/despacho-itinerario-picker";
import { PROCESO_DESBROCE_ID } from "@/lib/hoja-ruta-campos-config";
import {
  buildDatosProcesoForItinerarioSlot,
  fetchItinerarioSeedContext,
} from "@/lib/prod-ot-itinerario-seed";

export const TABLE_PROD_OT_PASOS = "prod_ot_pasos";
export const TABLE_PROD_OTS_GENERAL = "prod_ots_general";

export type ProdOtPasoVista = {
  id: string;
  orden: number;
  estado: string;
  procesoId: number;
  procesoNombre: string;
};

const ESTADOS_EDITABLES = new Set(["pendiente", "disponible"]);

/** Orden temporal al liberar slots (ot_id, orden) antes de insertar la cola nueva. */
const COLA_VIVA_TEMP_ORDEN_BASE = 100000;

/**
 * Solo se permite sustituir o borrar el itinerario si ningún paso ha entrado
 * en producción (en_marcha / finalizado u otros distintos de pendiente+disponible).
 */
export function itinerarioPasosPermitenReemplazo(
  pasos: { estado: string | null | undefined }[]
): boolean {
  if (pasos.length === 0) return true;
  return pasos.every((p) =>
    ESTADOS_EDITABLES.has(String(p.estado ?? "").trim().toLowerCase())
  );
}

export async function fetchProdOtGeneralIdByNumPedido(
  supabase: SupabaseClient,
  numPedido: string
): Promise<string | null> {
  const ot = numPedido.trim();
  if (!ot) return null;
  const { data, error } = await supabase
    .from(TABLE_PROD_OTS_GENERAL)
    .select("id")
    .eq("num_pedido", ot)
    .maybeSingle();
  if (error) throw error;
  const id = data && typeof (data as { id?: unknown }).id === "string"
    ? String((data as { id: string }).id).trim()
    : "";
  return id || null;
}

/** Mapa num_pedido → id maestro (batch). */
export async function fetchProdOtGeneralIdsByNumPedidos(
  supabase: SupabaseClient,
  numeros: string[]
): Promise<Map<string, string>> {
  const nums = [
    ...new Set(numeros.map((n) => String(n ?? "").trim()).filter(Boolean)),
  ];
  const out = new Map<string, string>();
  if (nums.length === 0) return out;
  const { data, error } = await supabase
    .from(TABLE_PROD_OTS_GENERAL)
    .select("id, num_pedido")
    .in("num_pedido", nums);
  if (error) throw error;
  for (const raw of data ?? []) {
    const r = raw as { id?: string; num_pedido?: string | null };
    const num = String(r.num_pedido ?? "").trim();
    const id = String(r.id ?? "").trim();
    if (num && id) out.set(num, id);
  }
  return out;
}

export async function fetchProdOtPasosVista(
  supabase: SupabaseClient,
  otId: string
): Promise<ProdOtPasoVista[]> {
  const { data, error } = await supabase
    .from(TABLE_PROD_OT_PASOS)
    .select(
      "id, orden, estado, proceso_id, prod_procesos_cat ( id, nombre )"
    )
    .eq("ot_id", otId)
    .order("orden", { ascending: true });
  if (error) throw error;
  const rows: ProdOtPasoVista[] = [];
  for (const raw of data ?? []) {
    const r = raw as {
      id?: string;
      orden?: number | null;
      estado?: string | null;
      proceso_id?: number | null;
      prod_procesos_cat?: { nombre?: string | null } | null;
    };
    const id = String(r.id ?? "").trim();
    if (!id) continue;
    const pid = r.proceso_id;
    const procesoId =
      typeof pid === "number" && Number.isFinite(pid) ? Math.trunc(pid) : NaN;
    if (!Number.isFinite(procesoId)) continue;
    rows.push({
      id,
      orden: typeof r.orden === "number" && Number.isFinite(r.orden) ? r.orden : 0,
      estado: String(r.estado ?? "").trim() || "—",
      procesoId,
      procesoNombre:
        String(r.prod_procesos_cat?.nombre ?? "").trim() || "—",
    });
  }
  return rows;
}

export function pasosVistaToItinerarioSlots(
  pasos: ProdOtPasoVista[]
): DespachoItinerarioSlot[] {
  return pasos.map((p) => ({
    key: p.id,
    procesoId: p.procesoId,
    nombre: p.procesoNombre,
  }));
}

/**
 * Sustituye por completo los pasos de la OT (delete + insert).
 * Llamar solo si `itinerarioPasosPermitenReemplazo` era true antes de mutar en UI.
 */
export async function replaceProdOtItinerarioSlots(
  supabase: SupabaseClient,
  otId: string,
  slots: DespachoItinerarioSlot[]
): Promise<void> {
  const { error: errDel } = await supabase
    .from(TABLE_PROD_OT_PASOS)
    .delete()
    .eq("ot_id", otId);
  if (errDel) throw errDel;
  if (slots.length === 0) return;
  let desbroceMaquinaId: string | null = null;
  if (slots.some((s) => s.procesoId === PROCESO_DESBROCE_ID)) {
    const { data: maqData, error: maqErr } = await supabase
      .from("prod_maquinas")
      .select("id")
      .eq("codigo", "ENG-DESBROZ")
      .maybeSingle();
    if (maqErr) throw maqErr;
    desbroceMaquinaId =
      typeof (maqData as { id?: unknown } | null)?.id === "string"
        ? String((maqData as { id: string }).id).trim() || null
        : null;
  }
  const pasoRows = slots.map((s, i) => ({
    ot_id: otId,
    orden: i + 1,
    proceso_id: s.procesoId,
    maquina_id: s.procesoId === PROCESO_DESBROCE_ID ? desbroceMaquinaId : null,
    estado: i === 0 ? "disponible" : "pendiente",
  }));
  const { error: errIns } = await supabase
    .from(TABLE_PROD_OT_PASOS)
    .insert(pasoRows);
  if (errIns) throw errIns;
}

/**
 * Sustituye únicamente los pasos PENDIENTES/DISPONIBLES de una OT activa.
 * Los pasos ya iniciados (en_marcha, pausado) o finalizados se dejan intactos.
 * newSlots define la nueva cola que irá después de los pasos bloqueados.
 */
export async function insertarPasosEnColaViva(
  supabase: SupabaseClient,
  otId: string,
  pasosActuales: ProdOtPasoVista[],
  newSlots: DespachoItinerarioSlot[],
  otNumero?: string | null,
): Promise<void> {
  const locked = pasosActuales.filter(
    (p) => !ESTADOS_EDITABLES.has(String(p.estado ?? "").trim().toLowerCase()),
  );
  const editablePasos = pasosActuales.filter((p) =>
    ESTADOS_EDITABLES.has(String(p.estado ?? "").trim().toLowerCase()),
  );
  const editableIds = editablePasos.map((p) => p.id);
  const ordenRollback = editablePasos.map((p) => ({ id: p.id, orden: p.orden }));

  const preservedDatosByKey = new Map<string, Record<string, unknown>>();
  if (editableIds.length > 0) {
    const { data: editableRows, error: errLoadEditable } = await supabase
      .from(TABLE_PROD_OT_PASOS)
      .select("id, datos_proceso")
      .in("id", editableIds);
    if (errLoadEditable) throw errLoadEditable;
    for (const raw of editableRows ?? []) {
      const r = raw as { id?: string; datos_proceso?: unknown };
      const id = String(r.id ?? "").trim();
      if (!id) continue;
      if (r.datos_proceso && typeof r.datos_proceso === "object") {
        preservedDatosByKey.set(
          id,
          r.datos_proceso as Record<string, unknown>,
        );
      }
    }
  }

  if (newSlots.length === 0) {
    if (editableIds.length === 0) return;
    const { error: errDel } = await supabase
      .from(TABLE_PROD_OT_PASOS)
      .delete()
      .in("id", editableIds);
    if (errDel) throw errDel;
    return;
  }

  const nextOrden =
    locked.length > 0 ? Math.max(...locked.map((p) => p.orden)) + 1 : 1;

  // If a step is currently en_marcha, new first slot stays pendiente (not disponible)
  const hasEnMarcha = locked.some(
    (p) => String(p.estado ?? "").trim().toLowerCase() === "en_marcha",
  );

  let desbroceMaquinaId: string | null = null;
  if (newSlots.some((s) => s.procesoId === PROCESO_DESBROCE_ID)) {
    const { data: maqData, error: maqErr } = await supabase
      .from("prod_maquinas")
      .select("id")
      .eq("codigo", "ENG-DESBROZ")
      .maybeSingle();
    if (maqErr) throw maqErr;
    desbroceMaquinaId =
      typeof (maqData as { id?: unknown } | null)?.id === "string"
        ? String((maqData as { id: string }).id).trim() || null
        : null;
  }

  let seedCtx = null;
  if (otNumero?.trim()) {
    const lockedPasosRows: Array<{
      proceso_id: number;
      datos_proceso?: unknown;
    }> = [];
    if (locked.length > 0) {
      const lockedIds = locked.map((p) => p.id);
      const { data: lockedRows, error: errLocked } = await supabase
        .from(TABLE_PROD_OT_PASOS)
        .select("proceso_id, datos_proceso")
        .in("id", lockedIds);
      if (errLocked) throw errLocked;
      for (const raw of lockedRows ?? []) {
        const r = raw as { proceso_id?: number; datos_proceso?: unknown };
        if (typeof r.proceso_id === "number") {
          lockedPasosRows.push({
            proceso_id: r.proceso_id,
            datos_proceso: r.datos_proceso,
          });
        }
      }
    }
    seedCtx = await fetchItinerarioSeedContext(
      supabase,
      otNumero,
      lockedPasosRows,
      newSlots.map((s) => s.procesoId),
    );
  }

  const pasoRows = newSlots.map((s, i) => {
    const preserved = preservedDatosByKey.get(s.key);
    const datosProceso =
      seedCtx != null
        ? buildDatosProcesoForItinerarioSlot(s, seedCtx, preserved)
        : preserved && Object.keys(preserved).length > 0
          ? preserved
          : null;
    return {
      ot_id: otId,
      orden: nextOrden + i,
      proceso_id: s.procesoId,
      maquina_id:
        s.procesoId === PROCESO_DESBROCE_ID ? desbroceMaquinaId : null,
      estado: i === 0 && !hasEnMarcha ? "disponible" : "pendiente",
      ...(datosProceso ? { datos_proceso: datosProceso } : {}),
    };
  });

  async function restoreEditableOrden(): Promise<void> {
    if (ordenRollback.length === 0) return;
    const results = await Promise.all(
      ordenRollback.map(({ id, orden }) =>
        supabase
          .from(TABLE_PROD_OT_PASOS)
          .update({ orden })
          .eq("id", id),
      ),
    );
    for (const r of results) {
      if (r.error) throw r.error;
    }
  }

  let bumpedOrden = false;
  if (editableIds.length > 0) {
    const bumpResults = await Promise.all(
      ordenRollback.map(({ id }, i) =>
        supabase
          .from(TABLE_PROD_OT_PASOS)
          .update({ orden: COLA_VIVA_TEMP_ORDEN_BASE + i })
          .eq("id", id),
      ),
    );
    for (const r of bumpResults) {
      if (r.error) throw r.error;
    }
    bumpedOrden = true;
  }

  let insertedIds: string[] = [];
  try {
    const { data: inserted, error: errIns } = await supabase
      .from(TABLE_PROD_OT_PASOS)
      .insert(pasoRows)
      .select("id");
    if (errIns) throw errIns;
    insertedIds = (inserted ?? [])
      .map((raw) => String((raw as { id?: string }).id ?? "").trim())
      .filter(Boolean);

    if (editableIds.length > 0) {
      const { error: errDel } = await supabase
        .from(TABLE_PROD_OT_PASOS)
        .delete()
        .in("id", editableIds);
      if (errDel) throw errDel;
    }
  } catch (e) {
    if (insertedIds.length > 0) {
      const { error: rollbackInsErr } = await supabase
        .from(TABLE_PROD_OT_PASOS)
        .delete()
        .in("id", insertedIds);
      if (rollbackInsErr) throw rollbackInsErr;
    }
    if (bumpedOrden) {
      await restoreEditableOrden();
    }
    throw e;
  }
}

/**
 * Números de OT sin ningún paso en `prod_ot_pasos` (sin fila maestro → también se listan).
 */
export async function listOtNumerosSinItinerario(
  supabase: SupabaseClient,
  otNumeros: string[]
): Promise<string[]> {
  const nums = [
    ...new Set(otNumeros.map((n) => String(n ?? "").trim()).filter(Boolean)),
  ];
  if (nums.length === 0) return [];
  const idMap = await fetchProdOtGeneralIdsByNumPedidos(supabase, nums);
  const ids = [...new Set([...idMap.values()])];
  let withPasos = new Set<string>();
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from(TABLE_PROD_OT_PASOS)
      .select("ot_id")
      .in("ot_id", ids);
    if (error) throw error;
    withPasos = new Set(
      (data ?? [])
        .map((r) => String((r as { ot_id?: string }).ot_id ?? "").trim())
        .filter(Boolean)
    );
  }
  const sin: string[] = [];
  for (const num of nums) {
    const oid = idMap.get(num);
    if (!oid || !withPasos.has(oid)) sin.push(num);
  }
  return sin;
}
