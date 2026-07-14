/**
 * Enlace documental cartela ↔ cierre de proceso (Bloque 9.4).
 * Registra ID Stock y material real en datos_proceso; descuenta stock al cerrar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import { getCamposConfigByProcesoId } from "@/lib/hoja-ruta-campos-config";
import type { ProdStockPaletRow } from "@/types/prod-stock";

/** Procesos de impresión (legacy / compat). */
export const PROCESOS_IMPRESION_CARTELA = [1, 2] as const;

export const PROCESO_GUILLOTINA_ID = 17;
export const PROCESO_TROQUELADO_ID = 10;
export const PROCESO_IMPRESION_EXTERNA_ID = 21;

/** Orden de prioridad para el único punto de consumo de material bruto por OT. */
export const PROCESOS_CONSUMO_MATERIAL_ORDEN = [17, 1, 2, 10, 21] as const;

export type PasoItinerarioConsumo = {
  procesoId: number | null;
  orden: number;
};

function toFiniteNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function resolvePrimerProcesoConsumoMaterial(
  pasos: PasoItinerarioConsumo[],
): number | null {
  const sorted = [...pasos].sort((a, b) => a.orden - b.orden);
  const candidatos = new Set<number>(PROCESOS_CONSUMO_MATERIAL_ORDEN);
  for (const paso of sorted) {
    if (paso.procesoId != null && candidatos.has(paso.procesoId)) {
      return paso.procesoId;
    }
  }
  return null;
}

export function procesoEsCandidatoConsumoMaterial(procesoId: number | null): boolean {
  return (
    procesoId != null &&
    (PROCESOS_CONSUMO_MATERIAL_ORDEN as readonly number[]).includes(procesoId)
  );
}

/**
 * True si este paso es el primer consumidor de material bruto según itinerario.
 * Sin itinerario: solo impresión (1, 2) — comportamiento previo a 9.4 A/B.
 */
export function procesoEsPuntoConsumoMaterial(
  procesoId: number | null,
  pasosItinerario?: PasoItinerarioConsumo[] | null,
): boolean {
  if (!procesoEsCandidatoConsumoMaterial(procesoId)) return false;

  if (!pasosItinerario || pasosItinerario.length === 0) {
    return (PROCESOS_IMPRESION_CARTELA as readonly number[]).includes(procesoId!);
  }

  return resolvePrimerProcesoConsumoMaterial(pasosItinerario) === procesoId;
}

/** Alias usado en UI de cierre y consumo RPC. */
export function procesoUsaCartela(
  procesoId: number | null,
  pasosItinerario?: PasoItinerarioConsumo[] | null,
): boolean {
  return procesoEsPuntoConsumoMaterial(procesoId, pasosItinerario);
}

export function nombreProcesoConsumoMaterial(procesoId: number): string {
  return getCamposConfigByProcesoId(procesoId)?.procesoNombre ?? `Proceso ${procesoId}`;
}

export function notaConsumoCartelaPorProceso(procesoId: number | null): string {
  switch (procesoId) {
    case PROCESO_GUILLOTINA_ID:
      return "Consumo cierre guillotina (9.4)";
    case 1:
      return "Consumo cierre impresión offset (9.4)";
    case 2:
      return "Consumo cierre impresión digital (9.4)";
    case PROCESO_TROQUELADO_ID:
      return "Consumo cierre troquelado (9.4)";
    case PROCESO_IMPRESION_EXTERNA_ID:
      return "Consumo envío impresión externa (9.4)";
    default:
      return "Consumo cierre proceso (9.4)";
  }
}

/** Prefill de hojas consumidas según salidas del paso al cerrar. */
export function suggestHojasConsumoCartela(
  procesoId: number | null,
  datos: DatosProcesoGenerico,
): number | null {
  if (procesoId == null) return null;

  if (procesoId === PROCESO_GUILLOTINA_ID) {
    const finales = toFiniteNum(datos.hojas_finales);
    if (finales != null && finales > 0) return Math.round(finales);
    const iniciales = toFiniteNum(datos.hojas_iniciales);
    if (iniciales != null && iniciales > 0) return Math.round(iniciales);
    return null;
  }

  if (procesoId === PROCESO_TROQUELADO_ID) {
    const troqueladas = toFiniteNum(datos.hojas_troqueladas);
    if (troqueladas != null && troqueladas > 0) return Math.round(troqueladas);
    const aTroquelar = toFiniteNum(datos.hojas_troquelar);
    if (aTroquelar != null && aTroquelar > 0) return Math.round(aTroquelar);
    return null;
  }

  if ((PROCESOS_IMPRESION_CARTELA as readonly number[]).includes(procesoId)) {
    const impresas = toFiniteNum(datos.hojas_impresas);
    if (impresas != null && impresas > 0) return Math.round(impresas);
    const brutas = toFiniteNum(datos.hojas_brutas);
    if (brutas != null && brutas > 0) return Math.round(brutas);
    const netas = toFiniteNum(datos.hojas_netas);
    if (netas != null && netas > 0) return Math.round(netas);
    return null;
  }

  if (procesoId === PROCESO_IMPRESION_EXTERNA_ID) {
    const brutas = toFiniteNum(datos.hojas_brutas);
    if (brutas != null && brutas > 0) return Math.round(brutas);
    const numeroHojas = toFiniteNum(datos.numero_hojas);
    if (numeroHojas != null && numeroHojas > 0) return Math.round(numeroHojas);
    const netas = toFiniteNum(datos.hojas_netas);
    if (netas != null && netas > 0) return Math.round(netas);
    return null;
  }

  return null;
}

export const CARTELA_DATOS_KEYS = {
  idStock: "id_stock_cartela",
  hojasConsumidas: "cartela_hojas_consumidas",
  materialReal: "material_real_cartela",
  paletId: "cartela_palet_id",
} as const;

export function datosIncluyenCartela(datos: Record<string, unknown> | null): boolean {
  if (!datos) return false;
  const idRaw = datos[CARTELA_DATOS_KEYS.idStock];
  const idNum =
    typeof idRaw === "number"
      ? idRaw
      : typeof idRaw === "string"
        ? normalizeIdStockInput(idRaw)
        : null;
  if (idNum != null && idNum > 0) return true;
  const hojas = datos[CARTELA_DATOS_KEYS.hojasConsumidas];
  return typeof hojas === "number" && hojas > 0;
}

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
  _procesoId: number | null,
  datos: Record<string, unknown> | null,
): CartelaVistaCampo[] {
  if (!datosIncluyenCartela(datos)) return [];
  const out: CartelaVistaCampo[] = [];
  const idRaw = datos![CARTELA_DATOS_KEYS.idStock];
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
  const material = datos![CARTELA_DATOS_KEYS.materialReal];
  if (typeof material === "string" && material.trim()) {
    out.push({ label: "Material real (palet)", valor: material.trim() });
  }
  const hojas = datos![CARTELA_DATOS_KEYS.hojasConsumidas];
  if (typeof hojas === "number" && hojas > 0) {
    out.push({
      label: "Hojas consumidas (cartela)",
      valor: `${hojas.toLocaleString("es-ES")} h`,
    });
  }
  return out;
}
