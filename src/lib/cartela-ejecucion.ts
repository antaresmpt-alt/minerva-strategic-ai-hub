/**
 * Enlace documental cartela ↔ cierre de impresión (Bloque 9.4-preview).
 * Registra ID Stock y material real en datos_proceso; sin movimientos de stock aún.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import type { ProdStockPaletRow } from "@/types/prod-stock";

/** Procesos donde el maquinista puede vincular cartela al cerrar. */
export const PROCESOS_IMPRESION_CARTELA = [1, 2] as const;

export function procesoUsaCartela(procesoId: number | null): boolean {
  return procesoId != null && (PROCESOS_IMPRESION_CARTELA as readonly number[]).includes(procesoId);
}

export const CARTELA_DATOS_KEYS = {
  idStock: "id_stock_cartela",
  hojasConsumidas: "cartela_hojas_consumidas",
  materialReal: "material_real_cartela",
  paletId: "cartela_palet_id",
} as const;

/** Normaliza entrada "10313", "10.313", "10 313" → 10313 */
export function normalizeIdStockInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatIdStockDisplay(idStock: number): string {
  return idStock.toLocaleString("es-ES");
}

export function buildMaterialRealLabel(
  palet: Pick<ProdStockPaletRow, "material_nombre" | "gramaje" | "formato" | "descripcion_material">,
): string {
  const parts: string[] = [];
  const nombre = palet.material_nombre ?? palet.descripcion_material;
  if (nombre) parts.push(nombre);
  if (palet.gramaje != null) parts.push(`${palet.gramaje} gr`);
  if (palet.formato) parts.push(palet.formato);
  return parts.join(" · ") || "—";
}

export async function fetchPaletByIdStock(
  supabase: SupabaseClient,
  idStock: number,
): Promise<ProdStockPaletRow | null> {
  const { data, error } = await supabase
    .from("prod_stock_palets")
    .select(
      "id, id_stock, material_nombre, descripcion_material, gramaje, formato, cantidad_actual, codigo_articulo",
    )
    .eq("id_stock", idStock)
    .maybeSingle();

  if (error) throw error;
  return data as ProdStockPaletRow | null;
}

export type CartelaOption = {
  idStock: number;
  label: string;
  palet: Pick<ProdStockPaletRow, "id" | "id_stock" | "material_nombre" | "descripcion_material" | "gramaje" | "formato" | "cantidad_actual">;
};

/**
 * Carga todas las cartelas asignadas a una OT específica (desde prod_stock_palet_ots).
 * Devuelve opciones para un dropdown con ID Stock y descripción del material.
 */
export async function fetchCartelasForOt(
  supabase: SupabaseClient,
  otNumero: string,
): Promise<CartelaOption[]> {
  const { data: bridgeData, error: bridgeErr } = await supabase
    .from("prod_stock_palet_ots")
    .select("palet_id")
    .eq("ot_numero", otNumero);
  
  if (bridgeErr) throw bridgeErr;
  if (!bridgeData || bridgeData.length === 0) return [];
  
  const paletIds = bridgeData.map((row) => row.palet_id);
  
  const { data: palets, error: paletsErr } = await supabase
    .from("prod_stock_palets")
    .select("id, id_stock, material_nombre, descripcion_material, gramaje, formato, cantidad_actual")
    .in("id", paletIds)
    .order("id_stock", { ascending: true });
  
  if (paletsErr) throw paletsErr;
  if (!palets) return [];
  
  return palets.map((p) => ({
    idStock: p.id_stock,
    label: buildCartelaOptionLabel(p),
    palet: p,
  }));
}

function buildCartelaOptionLabel(
  palet: Pick<ProdStockPaletRow, "id_stock" | "material_nombre" | "descripcion_material" | "gramaje" | "formato" | "cantidad_actual">,
): string {
  const parts: string[] = [`#${formatIdStockDisplay(palet.id_stock)}`];
  const nombre = palet.material_nombre ?? palet.descripcion_material;
  if (nombre) parts.push(nombre);
  if (palet.gramaje != null) parts.push(`${palet.gramaje}gr`);
  if (palet.formato) parts.push(palet.formato);
  parts.push(`(${palet.cantidad_actual.toLocaleString("es-ES")}h)`);
  return parts.join(" · ");
}

export function applyCartelaToDatos(
  datos: DatosProcesoGenerico,
  palet: ProdStockPaletRow | null,
  idStock: number | null,
  hojasConsumidas: number | null,
): DatosProcesoGenerico {
  const next: DatosProcesoGenerico = { ...datos };
  if (idStock == null) {
    delete next[CARTELA_DATOS_KEYS.idStock];
    delete next[CARTELA_DATOS_KEYS.hojasConsumidas];
    delete next[CARTELA_DATOS_KEYS.materialReal];
    delete next[CARTELA_DATOS_KEYS.paletId];
    return next;
  }
  next[CARTELA_DATOS_KEYS.idStock] = idStock;
  if (hojasConsumidas != null && hojasConsumidas > 0) {
    next[CARTELA_DATOS_KEYS.hojasConsumidas] = hojasConsumidas;
  } else {
    delete next[CARTELA_DATOS_KEYS.hojasConsumidas];
  }
  if (palet) {
    next[CARTELA_DATOS_KEYS.materialReal] = buildMaterialRealLabel(palet);
    next[CARTELA_DATOS_KEYS.paletId] = palet.id;
  } else {
    delete next[CARTELA_DATOS_KEYS.materialReal];
    delete next[CARTELA_DATOS_KEYS.paletId];
  }
  return next;
}

export type CartelaVistaCampo = { label: string; valor: string };

/** Campos cartela para hoja de ruta / PDF (solo si hay datos). */
export function buildCartelaCamposVista(
  procesoId: number | null,
  datos: Record<string, unknown> | null,
): CartelaVistaCampo[] {
  if (!procesoUsaCartela(procesoId) || !datos) return [];
  const out: CartelaVistaCampo[] = [];
  const idRaw = datos[CARTELA_DATOS_KEYS.idStock];
  const idNum =
    typeof idRaw === "number"
      ? idRaw
      : typeof idRaw === "string"
        ? normalizeIdStockInput(idRaw)
        : null;
  if (idNum != null) {
    out.push({
      label: "ID Stock (cartela)",
      valor: formatIdStockDisplay(idNum),
    });
  }
  const material = datos[CARTELA_DATOS_KEYS.materialReal];
  if (typeof material === "string" && material.trim()) {
    out.push({ label: "Material real (palet)", valor: material.trim() });
  }
  const hojas = datos[CARTELA_DATOS_KEYS.hojasConsumidas];
  if (typeof hojas === "number" && hojas > 0) {
    out.push({
      label: "Hojas consumidas (cartela)",
      valor: `${hojas.toLocaleString("es-ES")} h`,
    });
  }
  return out;
}
