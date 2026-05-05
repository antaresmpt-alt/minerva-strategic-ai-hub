import type { SupabaseClient } from "@supabase/supabase-js";

import type { DespachoItinerarioSlot } from "@/components/produccion/ots/despacho-itinerario-picker";

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
  const pasoRows = slots.map((s, i) => ({
    ot_id: otId,
    orden: i + 1,
    proceso_id: s.procesoId,
    estado: i === 0 ? "disponible" : "pendiente",
  }));
  const { error: errIns } = await supabase
    .from(TABLE_PROD_OT_PASOS)
    .insert(pasoRows);
  if (errIns) throw errIns;
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
