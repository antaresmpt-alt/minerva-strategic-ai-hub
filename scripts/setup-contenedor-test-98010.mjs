/**
 * Monta OT contenedor 98010 + hijas 98010-01/02/03 para probar Bloque 8.1.
 * Convención numeración: {padre}-{nn} (nn = 2 dígitos).
 * Contenedor: sin pasos de itinerario; compra material solo en el padre.
 * Hijas: CTP → Impresión; sin compra propia (modelo barco).
 * Clona desde 35909 / 35904 / 35906 sin modificar las OT reales.
 *
 * Uso: node scripts/setup-contenedor-test-98010.mjs
 *      node scripts/setup-contenedor-test-98010.mjs --force  (recrear pasos/despachos)
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

const FORCE = process.argv.includes("--force");

const CONTENEDOR = "98010";
const ITINERARIO_PROCESO_IDS = [16, 1]; // CTP → Impresión offset

const LEGACY_HIJAS = ["98011", "98012", "98013"];

const HIJAS = [
  {
    target: "98010-01",
    source: "35909",
    codigo: "AU260",
    forma: "AU260 — Expositor Milical Ananás",
    cantidad: 2300,
    hojasBrutas: 2600,
  },
  {
    target: "98010-02",
    source: "35904",
    codigo: "AU235",
    forma: "AU235 — Expositor Milical Alcachofa",
    cantidad: 1300,
    hojasBrutas: 1600,
  },
  {
    target: "98010-03",
    source: "35906",
    codigo: "AU490",
    forma: "AU490 — Expositor Milical Ventre Plano",
    cantidad: 4650,
    hojasBrutas: 4950,
  },
];

const TOTAL_HOJAS = HIJAS.reduce((acc, h) => acc + h.hojasBrutas, 0);
const TOTAL_CANTIDAD = HIJAS.reduce((acc, h) => acc + h.cantidad, 0);

const MASTER_COLS = [
  "estado_cod",
  "estado_desc",
  "cliente",
  "pedido_cliente",
  "valor_potencial",
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

const ESTADO_SIN_ORDEN = "Sin orden compra";

const DESPACHO_COLS = [
  "gramaje",
  "horas_entrada",
  "horas_tiraje",
  "horas_estimadas_troquelado",
  "horas_estimadas_engomado",
  "tipo_engomado",
  "troquel",
  "acabado_pral",
  "notas",
  "referencia_id",
];

function pick(row, cols) {
  const out = {};
  for (const c of cols) {
    if (row[c] !== undefined) out[c] = row[c];
  }
  return out;
}

async function fetchMaster(numPedido) {
  const { data, error } = await supabase
    .from("prod_ots_general")
    .select("*")
    .eq("num_pedido", numPedido)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchDespacho(otNumero) {
  const { data, error } = await supabase
    .from("produccion_ot_despachadas")
    .select("*")
    .eq("ot_numero", otNumero)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertMaster(payload) {
  const numPedido = payload.num_pedido;
  const { data: existing } = await supabase
    .from("prod_ots_general")
    .select("id")
    .eq("num_pedido", numPedido)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("prod_ots_general")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("prod_ots_general")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

async function upsertDespacho(payload) {
  const { error } = await supabase
    .from("produccion_ot_despachadas")
    .upsert(payload, { onConflict: "ot_numero" });
  if (error) throw error;
}

async function syncEstadoMaterialConCompras(otNumero) {
  const { count, error: countErr } = await supabase
    .from("prod_compra_material")
    .select("id", { count: "exact", head: true })
    .eq("ot_numero", otNumero);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return false;

  const { error } = await supabase
    .from("produccion_ot_despachadas")
    .update({ estado_material: ESTADO_SIN_ORDEN })
    .eq("ot_numero", otNumero);
  if (error) throw error;
  return true;
}

async function purgeComprasForOt(otNumero) {
  const { data: compras, error } = await supabase
    .from("prod_compra_material")
    .select("id")
    .eq("ot_numero", otNumero);
  if (error) throw error;
  const ids = (compras ?? []).map((c) => c.id).filter(Boolean);
  if (ids.length > 0) {
    await supabase.from("prod_recepciones_material").delete().in("compra_id", ids);
    const { error: delErr } = await supabase.from("prod_compra_material").delete().in("id", ids);
    if (delErr) throw delErr;
  }

  await syncEstadoMaterialConCompras(otNumero);
  return ids.length;
}

async function clearContenedorItinerario(contenedorId) {
  await supabase.from("prod_ot_pasos").delete().eq("ot_id", contenedorId);
  await supabase.from("prod_mesa_ejecuciones").delete().eq("ot_numero", CONTENEDOR);
  await supabase.from("prod_planificacion_pool").delete().eq("ot_numero", CONTENEDOR);
  await supabase.from("prod_mesa_planificacion_trabajos").delete().eq("ot_numero", CONTENEDOR);
}

async function purgeOt(numPedido) {
  const master = await fetchMaster(numPedido);
  if (!master) return;

  await supabase.from("prod_mesa_ejecuciones").delete().eq("ot_numero", numPedido);
  await supabase.from("prod_planificacion_pool").delete().eq("ot_numero", numPedido);
  await supabase.from("prod_mesa_planificacion_trabajos").delete().eq("ot_numero", numPedido);
  await purgeComprasForOt(numPedido);
  await supabase.from("prod_ot_pasos").delete().eq("ot_id", master.id);
  await supabase.from("produccion_ot_despachadas").delete().eq("ot_numero", numPedido);
  await supabase.from("prod_despacho_materiales_lineas").delete().eq("ot_numero", numPedido);
  const { error } = await supabase.from("prod_ots_general").delete().eq("id", master.id);
  if (error) throw error;
  console.log(`  🗑 Eliminada OT legacy ${numPedido}`);
}

async function replaceItinerario(otId, otNumero) {
  await supabase.from("prod_mesa_ejecuciones").delete().eq("ot_numero", otNumero);
  await supabase.from("prod_planificacion_pool").delete().eq("ot_numero", otNumero);
  await supabase.from("prod_mesa_planificacion_trabajos").delete().eq("ot_numero", otNumero);

  const { error: errDel } = await supabase.from("prod_ot_pasos").delete().eq("ot_id", otId);
  if (errDel) throw errDel;

  const pasoRows = ITINERARIO_PROCESO_IDS.map((procesoId, i) => ({
    ot_id: otId,
    orden: i + 1,
    proceso_id: procesoId,
    estado: i === 0 ? "disponible" : "pendiente",
    datos_proceso: {},
  }));
  const { error: errIns } = await supabase.from("prod_ot_pasos").insert(pasoRows);
  if (errIns) throw errIns;
}

async function setupHija(spec, srcMaster, srcDespacho, padreNumero) {
  console.log(`\n→ Hija ${spec.target} ← ${spec.source} (${spec.codigo})`);

  const otId = await upsertMaster({
    ...pick(srcMaster, MASTER_COLS),
    num_pedido: spec.target,
    titulo: spec.forma,
    cantidad: spec.cantidad,
    ot_tipo: "hija",
    ot_padre_numero: padreNumero,
    tipo_hija: "forma",
    forma_descripcion: spec.forma,
    despachado: true,
    estado_desc: srcMaster.estado_desc ?? "Despachada",
  });

  if (srcDespacho) {
    await upsertDespacho({
      ...pick(srcDespacho, DESPACHO_COLS),
      ot_numero: spec.target,
      material: "TP WHITE 350g",
      tamano_hoja: "58x92",
      tintas: srcDespacho.tintas ?? "CMYK + Barniz",
      num_hojas_brutas: spec.hojasBrutas,
      num_hojas_netas: spec.cantidad,
      poses: 1,
      ot_anterior_numero: spec.source,
      ot_anterior_id: srcMaster.id,
      estado_material: ESTADO_SIN_ORDEN,
      despachado_at: new Date().toISOString(),
    });
  }

  if (FORCE) {
    await replaceItinerario(otId, spec.target);
  } else {
    const { count } = await supabase
      .from("prod_ot_pasos")
      .select("id", { count: "exact", head: true })
      .eq("ot_id", otId);
    if (!count) await replaceItinerario(otId, spec.target);
  }

  const comprasRemoved = await purgeComprasForOt(spec.target);
  if (comprasRemoved > 0) {
    console.log(`  ✓ ${spec.target}: eliminadas ${comprasRemoved} compra(s) (solo compra en padre)`);
  }

  console.log(`  ✓ ${spec.target}: ${spec.hojasBrutas} hojas brutas, cantidad ${spec.cantidad}, itinerario CTP→Imp`);
  return otId;
}

async function main() {
  console.log(`Montando contenedor ${CONTENEDOR} + hijas ${HIJAS.map((h) => h.target).join(", ")}`);
  console.log(`Total hojas barco: ${TOTAL_HOJAS} · Total unidades: ${TOTAL_CANTIDAD}`);

  console.log("\n→ Limpieza numeración legacy (98011–98013)");
  for (const legacy of LEGACY_HIJAS) {
    await purgeOt(legacy);
  }

  const refMaster = await fetchMaster(HIJAS[0].source);
  if (!refMaster) {
    console.error(`No existe OT origen ${HIJAS[0].source}`);
    process.exit(1);
  }
  const refDespacho = await fetchDespacho(HIJAS[0].source);

  // Contenedor
  console.log(`\n→ Contenedor ${CONTENEDOR}`);
  const contenedorId = await upsertMaster({
    ...pick(refMaster, MASTER_COLS),
    num_pedido: CONTENEDOR,
    titulo: "EXPOSITORES MILICAL — barco test (98010)",
    cantidad: TOTAL_CANTIDAD,
    ot_tipo: "contenedor",
    ot_padre_numero: null,
    tipo_hija: null,
    forma_descripcion: null,
    despachado: true,
    estado_desc: "Despachada",
  });

  // Contenedor sin itinerario ejecutable (progreso vía hijas)
  await clearContenedorItinerario(contenedorId);

  let horasEntrada = 0;
  let horasTiraje = 0;
  for (const spec of HIJAS) {
    const d = await fetchDespacho(spec.source);
    if (d) {
      horasEntrada += Number(d.horas_entrada) || 0;
      horasTiraje += Number(d.horas_tiraje) || 0;
    }
  }

  await upsertDespacho({
    ...(refDespacho ? pick(refDespacho, DESPACHO_COLS) : {}),
    ot_numero: CONTENEDOR,
    material: "TP WHITE 350g",
    tamano_hoja: "58x92",
    tintas: "CMYK + Barniz",
    num_hojas_brutas: TOTAL_HOJAS,
    num_hojas_netas: TOTAL_CANTIDAD,
    poses: null,
    troquel: null,
    horas_entrada: horasEntrada,
    horas_tiraje: horasTiraje,
    notas: "OT contenedor ficticia — prueba Bloque 8.1. Compra material barco completo.",
    estado_material: ESTADO_SIN_ORDEN,
    despachado_at: new Date().toISOString(),
  });
  await syncEstadoMaterialConCompras(CONTENEDOR);

  console.log(`  ✓ ${CONTENEDOR}: contenedor, ${TOTAL_HOJAS} hojas compra agregadas`);

  // Hijas
  for (const spec of HIJAS) {
    const srcMaster = await fetchMaster(spec.source);
    if (!srcMaster) {
      console.warn(`  ⚠ Saltando ${spec.target}: no existe origen ${spec.source}`);
      continue;
    }
    const srcDespacho = await fetchDespacho(spec.source);
    await setupHija(spec, srcMaster, srcDespacho, CONTENEDOR);
  }

  // Reafirmar: contenedor sin pasos; hijas solo CTP→Imp; sin compras en hijas
  await clearContenedorItinerario(contenedorId);
  for (const spec of HIJAS) {
    const hijaMaster = await fetchMaster(spec.target);
    if (!hijaMaster) continue;
    await replaceItinerario(hijaMaster.id, spec.target);
    await purgeComprasForOt(spec.target);
    await supabase
      .from("produccion_ot_despachadas")
      .update({ estado_material: ESTADO_SIN_ORDEN })
      .eq("ot_numero", spec.target);
  }
  await syncEstadoMaterialConCompras(CONTENEDOR);

  const { count: pasosContenedor } = await supabase
    .from("prod_ot_pasos")
    .select("id", { count: "exact", head: true })
    .eq("ot_id", contenedorId);

  console.log(`\n→ Higiene final: contenedor pasos=${pasosContenedor ?? 0} (debe ser 0)`);

  const { data: comprasCheck } = await supabase
    .from("prod_compra_material")
    .select("ot_numero, num_compra, estado")
    .in("ot_numero", [CONTENEDOR, ...HIJAS.map((h) => h.target)]);

  console.log("\n--- Compras ---");
  if ((comprasCheck ?? []).length === 0) {
    console.log("  (ninguna — generar compra manual solo en 98010 si hace falta)");
  } else {
    for (const c of comprasCheck ?? []) {
      console.log(`  ${c.ot_numero}: ${c.num_compra ?? "—"} · ${c.estado ?? "—"}`);
    }
  }

  // Verificación
  const { data: tree } = await supabase
    .from("prod_ots_general")
    .select("num_pedido, ot_tipo, ot_padre_numero, tipo_hija, forma_descripcion, cantidad, titulo")
    .or(`num_pedido.eq.${CONTENEDOR},ot_padre_numero.eq.${CONTENEDOR}`)
    .order("num_pedido");

  console.log("\n--- Árbol OT ---");
  for (const row of tree ?? []) {
    console.log(
      `  ${row.num_pedido} [${row.ot_tipo}] padre=${row.ot_padre_numero ?? "—"} forma=${row.forma_descripcion ?? "—"} qty=${row.cantidad}`,
    );
  }

  const nums = [CONTENEDOR, ...HIJAS.map((h) => h.target)];
  const { data: despCheck } = await supabase
    .from("produccion_ot_despachadas")
    .select("ot_numero, material, tamano_hoja, num_hojas_brutas")
    .in("ot_numero", nums);

  const { data: estadoCheck } = await supabase
    .from("produccion_ot_despachadas")
    .select("ot_numero, estado_material")
    .in("ot_numero", nums);

  console.log("\n--- Despachos ---");
  for (const d of despCheck ?? []) {
    const est = (estadoCheck ?? []).find((e) => e.ot_numero === d.ot_numero);
    console.log(
      `  ${d.ot_numero}: ${d.material} ${d.tamano_hoja} · ${d.num_hojas_brutas} hojas · estado=${est?.estado_material ?? "—"}`,
    );
  }

  console.log("\n✅ Listo. Compra solo en 98010; hijas CTP→Imp; contenedor sin pasos.");
  console.log("   Pipeline → OT: agrupado → expandir 98010 → probar ejecución 98010-01.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
