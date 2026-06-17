/**
 * Clona OT origen → destino para pruebas (one-off / CLI).
 * Uso: node scripts/clone-ot-test.mjs 35842 98009
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SOURCE_OT = String(process.argv[2] ?? "35842").trim();
const TARGET_OT = String(process.argv[3] ?? "98009").trim();
const FORMATO_COMPRA = String(process.argv[4] ?? "72x102").trim();
/** Itinerario forzado para prueba encadenado formato: Guillotina → Impresión offset */
const ITINERARIO_PROCESO_IDS = [17, 1];

const MASTER_COLS = [
  "estado_cod",
  "estado_desc",
  "cliente",
  "pedido_cliente",
  "cantidad",
  "valor_potencial",
  "titulo",
  "fecha_apertura",
  "fecha_entrega",
  "prioridad",
  "ultima_transaccion",
  "familia",
  "tipo_pedido",
  "vendedor",
  "originador",
  "fsc",
  "prueba_color",
  "pdf_ok",
  "muestra_ok",
];

const DESPACHO_COLS = [
  "tintas",
  "material",
  "gramaje",
  "num_hojas_brutas",
  "num_hojas_netas",
  "horas_entrada",
  "horas_tiraje",
  "horas_estimadas_troquelado",
  "horas_estimadas_engomado",
  "tipo_engomado",
  "troquel",
  "poses",
  "acabado_pral",
  "notas",
  "referencia_id",
  "estado_material",
];

function pick(row, cols) {
  const out = {};
  for (const c of cols) {
    if (row[c] !== undefined) out[c] = row[c];
  }
  return out;
}

async function main() {
  console.log(`Clonando OT ${SOURCE_OT} → ${TARGET_OT} (formato compra: ${FORMATO_COMPRA})`);

  const { data: srcMaster, error: errMaster } = await supabase
    .from("prod_ots_general")
    .select("*")
    .eq("num_pedido", SOURCE_OT)
    .maybeSingle();
  if (errMaster) throw errMaster;
  if (!srcMaster) {
    console.error(`No existe prod_ots_general para OT ${SOURCE_OT}`);
    process.exit(1);
  }

  const { data: srcDespacho, error: errDesp } = await supabase
    .from("produccion_ot_despachadas")
    .select("*")
    .eq("ot_numero", SOURCE_OT)
    .maybeSingle();
  if (errDesp) throw errDesp;

  const { data: existingTarget } = await supabase
    .from("prod_ots_general")
    .select("id, num_pedido")
    .eq("num_pedido", TARGET_OT)
    .maybeSingle();

  let targetId = existingTarget?.id ?? null;

  const masterPayload = {
    ...pick(srcMaster, MASTER_COLS),
    num_pedido: TARGET_OT,
    titulo: srcMaster.titulo
      ? `${srcMaster.titulo} [copia test formato]`
      : `Copia test formato de ${SOURCE_OT}`,
    despachado: Boolean(srcDespacho),
    updated_at: new Date().toISOString(),
  };

  if (targetId) {
    const { error } = await supabase
      .from("prod_ots_general")
      .update(masterPayload)
      .eq("id", targetId);
    if (error) throw error;
    console.log(`Actualizado maestro existente ${TARGET_OT} (${targetId})`);
  } else {
    const { data: inserted, error } = await supabase
      .from("prod_ots_general")
      .insert({ ...masterPayload, created_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    targetId = inserted.id;
    console.log(`Creado maestro ${TARGET_OT} (${targetId})`);
  }

  if (srcDespacho) {
    const despachoPayload = {
      ...pick(srcDespacho, DESPACHO_COLS),
      ot_numero: TARGET_OT,
      tamano_hoja: FORMATO_COMPRA,
      ot_anterior_numero: SOURCE_OT,
      ot_anterior_id: srcMaster.id,
      despachado_at: new Date().toISOString(),
    };
    const { error: errUpsert } = await supabase
      .from("produccion_ot_despachadas")
      .upsert(despachoPayload, { onConflict: "ot_numero" });
    if (errUpsert) throw errUpsert;
    console.log(`Despacho upsert para ${TARGET_OT} (tamano_hoja=${FORMATO_COMPRA})`);
  } else {
    console.warn(`OT ${SOURCE_OT} sin despacho; solo maestro creado.`);
  }

  // Materiales líneas
  const { data: matLines, error: errMat } = await supabase
    .from("prod_despacho_materiales_lineas")
    .select("*")
    .eq("ot_numero", SOURCE_OT)
    .order("orden", { ascending: true });
  if (errMat) throw errMat;

  if (matLines?.length) {
    await supabase
      .from("prod_despacho_materiales_lineas")
      .delete()
      .eq("ot_numero", TARGET_OT);
    const rows = matLines.map((m) => {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = m;
      return { ...rest, ot_numero: TARGET_OT };
    });
    const { error: errInsMat } = await supabase
      .from("prod_despacho_materiales_lineas")
      .insert(rows);
    if (errInsMat) throw errInsMat;
    console.log(`Copiadas ${rows.length} líneas de material`);
  }

  // Itinerario: reemplazar por Guillotina → Impresión offset
  const { error: errDelPasos } = await supabase
    .from("prod_ot_pasos")
    .delete()
    .eq("ot_id", targetId);
  if (errDelPasos) throw errDelPasos;

  const pasoRows = ITINERARIO_PROCESO_IDS.map((procesoId, i) => ({
    ot_id: targetId,
    orden: i + 1,
    proceso_id: procesoId,
    estado: i === 0 ? "disponible" : "pendiente",
    datos_proceso: {},
  }));
  const { error: errPasos } = await supabase.from("prod_ot_pasos").insert(pasoRows);
  if (errPasos) throw errPasos;
  console.log(
    `Itinerario: ${ITINERARIO_PROCESO_IDS.map((id) => `proceso ${id}`).join(" → ")}`,
  );

  // Limpiar ejecuciones/planificación previas de prueba en esta OT
  const { data: oldPasos } = await supabase
    .from("prod_ot_pasos")
    .select("id")
    .eq("ot_id", targetId);
  const pasoIds = (oldPasos ?? []).map((p) => p.id);
  if (pasoIds.length) {
    await supabase.from("prod_mesa_ejecuciones").delete().eq("ot_numero", TARGET_OT);
    await supabase.from("prod_planificacion_pool").delete().eq("ot_numero", TARGET_OT);
    await supabase.from("prod_mesa_planificacion_trabajos").delete().eq("ot_numero", TARGET_OT);
  }

  // Verificación
  const { data: check } = await supabase
    .from("produccion_ot_despachadas")
    .select("ot_numero, tamano_hoja")
    .eq("ot_numero", TARGET_OT)
    .single();
  const { data: pasosCheck } = await supabase
    .from("prod_ot_pasos")
    .select("orden, proceso_id, estado")
    .eq("ot_id", targetId)
    .order("orden");

  console.log("\n--- Verificación ---");
  console.log("Despacho:", check);
  console.log("Pasos:", pasosCheck);
  console.log(`\nListo: OT ${TARGET_OT} lista para probar encadenado de formato.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
