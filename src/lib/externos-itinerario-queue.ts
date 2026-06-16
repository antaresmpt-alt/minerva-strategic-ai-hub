import type { SupabaseClient } from "@supabase/supabase-js";

export type ExternoItinerarioQueueRow = {
  ot_numero: string;
  ot_id: string;
  ot_paso_id: string;
  proceso_nombre: string;
  cliente: string;
  trabajo_titulo: string;
  fecha_entrega: string | null;
  acabado_pral: string | null;
  material: string | null;
  tamano_hoja: string | null;
  num_hojas_netas: number | null;
  num_hojas_brutas: number | null;
};

/** Convierte yyyy-mm-dd local a ISO UTC (mediodia local), mismo criterio que gestion-externos-page. */
export function externosDateInputToTimestamptz(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.toISOString();
}

export function externosIsoToDateInput(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function externosComputeDiasHastaFEntregaOt(
  iso: string | null | undefined,
): number | null {
  if (iso == null || iso === "") return null;
  const fp = new Date(iso);
  if (Number.isNaN(fp.getTime())) return null;
  fp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (fp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
}

/**
 * OTs cuyo primer paso `disponible` del itinerario es `es_externo` en catálogo,
 * sin fila de seguimiento activa (estado distinto de Recibido) para ese ot_paso_id.
 */
export async function fetchExternoItinerarioQueue(
  supabase: SupabaseClient,
): Promise<ExternoItinerarioQueueRow[]> {
  const { data, error } = await supabase.rpc("prod_ots_proximo_paso_externo_queue");
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const otNumeros = [
    ...new Set(rows.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean)),
  ];
  const despachoByOt = new Map<string, Record<string, unknown>>();
  if (otNumeros.length > 0) {
    const { data: despachoData, error: despachoErr } = await supabase
      .from("produccion_ot_despachadas")
      .select("ot_numero, acabado_pral, material, tamano_hoja, num_hojas_netas, num_hojas_brutas")
      .in("ot_numero", otNumeros);
    if (despachoErr) throw despachoErr;
    for (const d of (despachoData ?? []) as Record<string, unknown>[]) {
      const ot = String(d.ot_numero ?? "").trim();
      if (ot) despachoByOt.set(ot, d);
    }
  }

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return rows.map((r) => {
    const ot = String(r.ot_numero ?? "").trim();
    const despacho = despachoByOt.get(ot);
    return {
      ot_numero: ot,
      ot_id: String(r.ot_id ?? "").trim(),
      ot_paso_id: String(r.ot_paso_id ?? "").trim(),
      proceso_nombre: String(r.proceso_nombre ?? "").trim(),
      cliente: String(r.cliente ?? "").trim(),
      trabajo_titulo: String(r.trabajo_titulo ?? "").trim(),
      fecha_entrega:
        r.fecha_entrega != null && String(r.fecha_entrega).trim() !== ""
          ? String(r.fecha_entrega).slice(0, 10)
          : null,
      acabado_pral: String(despacho?.acabado_pral ?? "").trim() || null,
      material: String(despacho?.material ?? "").trim() || null,
      tamano_hoja: String(despacho?.tamano_hoja ?? "").trim() || null,
      num_hojas_netas: num(despacho?.num_hojas_netas),
      num_hojas_brutas: num(despacho?.num_hojas_brutas),
    };
  });
}
