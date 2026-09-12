import type { SupabaseClient } from "@supabase/supabase-js";

export type PaletConciliacionRow = {
  id: string;
  id_stock: number;
  recepcion_id: string | null;
  cantidad_inicial: number;
  coste: number | null;
  material_nombre: string | null;
  es_prueba: boolean;
};

export type RecepcionConciliacionRow = {
  id: string;
  albaran_proveedor: string;
  hojas_recibidas: number;
  material_nombre: string | null;
  importe_factura_eur: number | null;
  importe_factura_at: string | null;
  ot_numero: string | null;
};

export type AlbaranConciliacionContext = {
  albaranProveedor: string;
  recepciones: RecepcionConciliacionRow[];
  palets: PaletConciliacionRow[];
  /** Cartelas sandbox (≥99000) — no entran en conciliación. */
  paletsPrueba: PaletConciliacionRow[];
  hojasTotal: number;
  importeFacturaRegistrado: number | null;
};

function unwrapJoinRow<T extends Record<string, unknown>>(
  raw: unknown
): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return raw as T;
}

/** Reparte importe total entre palets según hojas (`cantidad_inicial`). */
export function prorratearImporteFacturaPorHojas(
  importeTotal: number,
  palets: Pick<PaletConciliacionRow, "id" | "cantidad_inicial">[]
): Map<string, number> {
  const out = new Map<string, number>();
  if (!(importeTotal > 0)) return out;

  const elegibles = palets.filter((p) => p.cantidad_inicial > 0);
  const totalHojas = elegibles.reduce((acc, p) => acc + p.cantidad_inicial, 0);
  if (totalHojas <= 0) return out;

  let asignado = 0;
  for (let i = 0; i < elegibles.length; i++) {
    const p = elegibles[i]!;
    if (i === elegibles.length - 1) {
      out.set(p.id, Math.round((importeTotal - asignado) * 100) / 100);
      continue;
    }
    const share =
      Math.round(((importeTotal * p.cantidad_inicial) / totalHojas) * 100) / 100;
    out.set(p.id, share);
    asignado += share;
  }
  return out;
}

/** Importe de factura atribuible a una línea de recepción (por hojas del albarán). */
export function importeFacturaLineaRecepcion(
  importeTotal: number,
  hojasLinea: number,
  hojasTotalAlbaran: number
): number | null {
  if (!(importeTotal > 0) || hojasLinea <= 0 || hojasTotalAlbaran <= 0) {
    return null;
  }
  return Math.round(((importeTotal * hojasLinea) / hojasTotalAlbaran) * 100) / 100;
}

export async function fetchAlbaranConciliacionContext(
  supabase: SupabaseClient,
  albaranProveedor: string
): Promise<AlbaranConciliacionContext | null> {
  const albaran = albaranProveedor.trim();
  if (!albaran) return null;

  const { data: recepcionesRaw, error: rErr } = await supabase
    .from("prod_recepciones_material")
    .select(
      `id, albaran_proveedor, hojas_recibidas, material_nombre,
       importe_factura_eur, importe_factura_at,
       prod_compra_material(ot_numero)`
    )
    .eq("albaran_proveedor", albaran)
    .order("fecha_recepcion", { ascending: true });

  if (rErr) throw rErr;
  if (!recepcionesRaw?.length) return null;

  const recepciones: RecepcionConciliacionRow[] = recepcionesRaw.map((raw) => {
    const compra = unwrapJoinRow<{ ot_numero?: string | null }>(
      (raw as Record<string, unknown>).prod_compra_material
    );
    return {
      id: String(raw.id),
      albaran_proveedor: String(raw.albaran_proveedor ?? albaran),
      hojas_recibidas:
        typeof raw.hojas_recibidas === "number" ? raw.hojas_recibidas : 0,
      material_nombre:
        typeof raw.material_nombre === "string" ? raw.material_nombre : null,
      importe_factura_eur:
        typeof raw.importe_factura_eur === "number"
          ? raw.importe_factura_eur
          : null,
      importe_factura_at:
        typeof raw.importe_factura_at === "string" ? raw.importe_factura_at : null,
      ot_numero:
        typeof compra?.ot_numero === "string" ? compra.ot_numero : null,
    };
  });

  const recepcionIds = recepciones.map((r) => r.id);
  const { data: paletsRaw, error: pErr } = await supabase
    .from("prod_stock_palets")
    .select(
      "id, id_stock, recepcion_id, cantidad_inicial, coste, material_nombre, es_prueba"
    )
    .in("recepcion_id", recepcionIds)
    .order("id_stock", { ascending: true });

  if (pErr) throw pErr;

  const palets: PaletConciliacionRow[] = (paletsRaw ?? []).map((p) => ({
    id: String(p.id),
    id_stock: Number(p.id_stock),
    recepcion_id:
      typeof p.recepcion_id === "string" ? p.recepcion_id : null,
    cantidad_inicial:
      typeof p.cantidad_inicial === "number" ? p.cantidad_inicial : 0,
    coste: typeof p.coste === "number" ? p.coste : null,
    material_nombre:
      typeof p.material_nombre === "string" ? p.material_nombre : null,
    es_prueba: Boolean(p.es_prueba),
  }));

  const paletsProd = palets.filter((p) => !p.es_prueba);
  const paletsPrueba = palets.filter((p) => p.es_prueba);
  const hojasTotal = paletsProd.reduce((acc, p) => acc + p.cantidad_inicial, 0);
  const importeFacturaRegistrado = recepciones.reduce(
    (acc, r) => acc + (r.importe_factura_eur ?? 0),
    0
  );

  return {
    albaranProveedor: albaran,
    recepciones,
    palets: paletsProd,
    paletsPrueba,
    hojasTotal,
    importeFacturaRegistrado:
      importeFacturaRegistrado > 0 ? importeFacturaRegistrado : null,
  };
}

export async function aplicarConciliacionFacturaAlbaran(
  supabase: SupabaseClient,
  params: {
    albaranProveedor: string;
    importeTotalEur: number;
    userEmail: string | null;
  }
): Promise<{ paletsActualizados: number; importeTotal: number }> {
  const ctx = await fetchAlbaranConciliacionContext(
    supabase,
    params.albaranProveedor
  );
  if (!ctx) {
    throw new Error("No se encontró recepción con ese albarán.");
  }
  if (ctx.palets.length === 0) {
    throw new Error(
      "Este albarán no tiene cartelas carteladas todavía. Cartela primero o revisa el nº de albarán."
    );
  }
  if (!(params.importeTotalEur > 0)) {
    throw new Error("Indica un importe de factura mayor que cero.");
  }

  const hojasPorRecepcion = new Map<string, number>();
  for (const p of ctx.palets) {
    if (!p.recepcion_id) continue;
    hojasPorRecepcion.set(
      p.recepcion_id,
      (hojasPorRecepcion.get(p.recepcion_id) ?? 0) + p.cantidad_inicial
    );
  }

  const costesPorPalet = prorratearImporteFacturaPorHojas(
    params.importeTotalEur,
    ctx.palets
  );

  const now = new Date().toISOString();
  for (const palet of ctx.palets) {
    const coste = costesPorPalet.get(palet.id);
    if (coste == null) continue;
    const { error } = await supabase
      .from("prod_stock_palets")
      .update({ coste })
      .eq("id", palet.id);
    if (error) throw error;
  }

  for (const recepcion of ctx.recepciones) {
    const hojasLinea = hojasPorRecepcion.get(recepcion.id) ?? 0;
    const importeLinea = importeFacturaLineaRecepcion(
      params.importeTotalEur,
      hojasLinea,
      ctx.hojasTotal
    );
    const { error } = await supabase
      .from("prod_recepciones_material")
      .update({
        importe_factura_eur: importeLinea,
        importe_factura_at: now,
        importe_factura_por_email: params.userEmail?.trim() || null,
      })
      .eq("id", recepcion.id);
    if (error) throw error;
  }

  return {
    paletsActualizados: ctx.palets.length,
    importeTotal: params.importeTotalEur,
  };
}
