import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchPasosResumenOt } from "@/lib/calendario-produccion-progreso";
import { resolveEstadoOtLabel } from "@/lib/hoja-ruta/hoja-ruta-query";
import type { CalendarioProduccionOtDetalle } from "@/types/prod-calendario-produccion-ot";

const TABLE_MAESTRO = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

/** Carga ligera maestro + despacho + pasos resumidos (mini-modal calendario). */
export async function fetchOtResumenRapido(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<CalendarioProduccionOtDetalle | null> {
  const ot = String(otNumero ?? "").trim();
  if (!ot) return null;

  const [
    { data: maestro, error: mErr },
    { data: despacho, error: dErr },
    pasos,
  ] = await Promise.all([
    supabase
      .from(TABLE_MAESTRO)
      .select(
        "num_pedido, cliente, titulo, cantidad, fecha_entrega, despachado, estado_desc",
      )
      .eq("num_pedido", ot)
      .maybeSingle(),
    supabase
      .from(TABLE_DESPACHADAS)
      .select(
        "material, gramaje, tamano_hoja, tintas, acabado_pral, troquel, poses, num_hojas_brutas, num_hojas_netas",
      )
      .eq("ot_numero", ot)
      .maybeSingle(),
    fetchPasosResumenOt(supabase, ot).catch(() => []),
  ]);
  if (mErr) throw mErr;
  if (dErr) throw dErr;
  if (!maestro) return null;

  const m = maestro as {
    cliente?: string | null;
    titulo?: string | null;
    cantidad?: number | null;
    fecha_entrega?: string | null;
    despachado?: boolean | null;
    estado_desc?: string | null;
  };
  const d = despacho as {
    material?: string | null;
    gramaje?: number | null;
    tamano_hoja?: string | null;
    tintas?: string | null;
    acabado_pral?: string | null;
    troquel?: string | null;
    poses?: number | null;
    num_hojas_brutas?: number | null;
    num_hojas_netas?: number | null;
  } | null;

  return {
    otNumero: ot,
    cliente: m.cliente ?? null,
    trabajo: m.titulo ?? null,
    cantidad: m.cantidad ?? null,
    fechaEntrega: m.fecha_entrega ?? null,
    despachado: Boolean(m.despachado),
    estadoOt: resolveEstadoOtLabel(m.estado_desc ?? null, pasos),
    material: d?.material ?? null,
    gramaje: d?.gramaje ?? null,
    tamanoHoja: d?.tamano_hoja ?? null,
    tintas: d?.tintas ?? null,
    acabadoPral: d?.acabado_pral ?? null,
    troquel: d?.troquel ?? null,
    poses: d?.poses ?? null,
    hojasBrutas: d?.num_hojas_brutas ?? null,
    hojasNetas: d?.num_hojas_netas ?? null,
    pasos,
  };
}
