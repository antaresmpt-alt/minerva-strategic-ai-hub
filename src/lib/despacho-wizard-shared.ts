/** Tipos y helpers compartidos del wizard de despacho OT. */

import {
  buildCtpRequisitosSeedFromWizard,
  emptyDespachoWizardCtpDatos,
  parseCtpWizardFromDatosProceso,
  type DespachoWizardCtpDatos,
} from "@/lib/ctp-despacho";

export type { DespachoWizardCtpDatos };

export const TABLE_OT_DESPACHADAS = "produccion_ot_despachadas";
export const TABLE_OT_PASOS = "prod_ot_pasos";
export const TABLE_OTS = "prod_ots_general";
export const TABLE_COMPRA = "prod_compra_material";
export const TABLE_HIJA_COMPONENTES = "prod_ot_hija_componentes";

/** Número máximo de formas recomendado (Optimus parte en 2 pedidos si supera ~8). */
export const FORMAS_MAX_WARNING = 8;

export type DespachoSeleccion = { id: string; num_pedido: string };

export type DespachoMeta = {
  cliente: string;
  trabajo: string;
  cantidad: string;
  pedido_cliente: string;
  fecha_entrega: string;
};

export type DespachoCatalogItem = {
  id: string;
  tipo: "material" | "acabado_pral" | "tipo_engomado";
  label: string;
};

export type ReferenciaHistorialRow = {
  ot_numero: string;
  despachado_at: string | null;
  material: string | null;
  gramaje: number | null;
  tamano_hoja: string | null;
  troquel: string | null;
  poses: number | null;
  acabado_pral: string | null;
};

export type DespachoFormState = {
  tintas: string;
  material: string;
  tamano_hoja: string;
  gramaje: string;
  num_hojas_brutas: string;
  num_hojas_netas: string;
  horas_entrada: string;
  horas_tiraje: string;
  horas_estimadas_troquelado: string;
  horas_estimadas_engomado: string;
  tipo_engomado: string;
  troquel: string;
  poses: string;
  acabado_pral: string;
  notas: string;
  referencia_id: string | null;
  referencia_codigo: string;
  ot_anterior_numero: string;
  ot_anterior_id: string | null;
};

export type DespachoWizardTab =
  | "cabecera"
  | "formas"
  | "material"
  | "itinerario"
  | "produccion"
  | "resumen";

export const DESPACHO_WIZARD_TABS_SIMPLE: {
  id: DespachoWizardTab;
  label: string;
}[] = [
  { id: "cabecera", label: "Cabecera" },
  { id: "material", label: "Material" },
  { id: "itinerario", label: "Itinerario" },
  { id: "produccion", label: "Producción" },
  { id: "resumen", label: "Resumen" },
];

export const DESPACHO_WIZARD_TABS_CONTENEDOR: {
  id: DespachoWizardTab;
  label: string;
}[] = [
  { id: "cabecera", label: "Cabecera" },
  { id: "formas", label: "Formas / Hijas" },
  { id: "material", label: "Material padre" },
  { id: "itinerario", label: "Itinerario" },
  { id: "resumen", label: "Resumen" },
];

/** @deprecated Use DESPACHO_WIZARD_TABS_SIMPLE or DESPACHO_WIZARD_TABS_CONTENEDOR */
export const DESPACHO_WIZARD_TABS = DESPACHO_WIZARD_TABS_SIMPLE;

// ─── Tipos Formas / Hijas (Bloque 8.2) ────────────────────────────────────────

/** Un componente/referencia dentro de una forma (una fila en prod_ot_hija_componentes). */
export type DespachoComponenteState = {
  key: string;
  referencia_codigo: string;
  referencia_descripcion: string;
  poses_en_forma: string;
};

/** Una forma de imposición (una OT hija). */
export type DespachoFormaState = {
  key: string;
  descripcion: string;
  hojas_netas: string;
  aumento: string;
  componentes: DespachoComponenteState[];
};

export function emptyComponente(): DespachoComponenteState {
  return {
    key: crypto.randomUUID(),
    referencia_codigo: "",
    referencia_descripcion: "",
    poses_en_forma: "",
  };
}

export function emptyForma(index: number): DespachoFormaState {
  return {
    key: crypto.randomUUID(),
    descripcion: `Forma ${index + 1}`,
    hojas_netas: "",
    aumento: "",
    componentes: [emptyComponente()],
  };
}

/** Hojas brutas de una forma: netas + aumento (si aumento > 0). */
export function calcHojasBrutasForma(forma: DespachoFormaState): number {
  const netas = integerOrZeroForDespacho(forma.hojas_netas);
  const aumRaw = integerOrZeroForDespacho(forma.aumento);
  return netas + (aumRaw > 0 ? aumRaw : 0);
}

/** Estuches calculados de un componente: hojas_netas_forma × poses_en_forma. */
export function calcCantidadObjetivoComponente(
  forma: DespachoFormaState,
  comp: DespachoComponenteState
): number {
  const netas = integerOrZeroForDespacho(forma.hojas_netas);
  const poses = integerOrZeroForDespacho(comp.poses_en_forma);
  return netas * poses;
}

/** Total de poses de todos los componentes de una forma. */
export function totalPosesForma(forma: DespachoFormaState): number {
  return forma.componentes.reduce(
    (acc, c) => acc + integerOrZeroForDespacho(c.poses_en_forma),
    0
  );
}

/** Total estuches de todas las formas. */
export function totalEstuchesFormas(formas: DespachoFormaState[]): number {
  return formas.reduce((acc, forma) => {
    const netas = integerOrZeroForDespacho(forma.hojas_netas);
    const poses = totalPosesForma(forma);
    return acc + netas * poses;
  }, 0);
}

/** Total hojas brutas de compra (suma de todas las hijas). */
export function totalHojasBrutasFormas(formas: DespachoFormaState[]): number {
  return formas.reduce((acc, f) => acc + calcHojasBrutasForma(f), 0);
}

export type ValidacionFormasResult = {
  ok: boolean;
  errores: string[];
  warnings: string[];
};

/**
 * Valida la coherencia de las formas antes de despachar.
 * @param formas Lista de formas definidas.
 * @param posesTotalTroquel Poses del troquel del contenedor (del campo `form.poses`).
 * @param cantidadPedido Cantidad total pedida del contenedor.
 */
export function validarFormas(
  formas: DespachoFormaState[],
  posesTotalTroquel: number,
  cantidadPedido: number
): ValidacionFormasResult {
  const errores: string[] = [];
  const warnings: string[] = [];

  if (formas.length === 0) {
    errores.push("Define al menos una forma.");
    return { ok: false, errores, warnings };
  }

  formas.forEach((forma, i) => {
    const n = i + 1;
    const netas = integerOrZeroForDespacho(forma.hojas_netas);
    if (!netas) errores.push(`Forma ${n}: indica las hojas netas.`);
    const posesForma = totalPosesForma(forma);
    if (
      posesTotalTroquel > 0 &&
      posesForma > 0 &&
      posesForma !== posesTotalTroquel
    ) {
      errores.push(
        `Forma ${n}: suma de poses en chapa (${posesForma}) ≠ poses del troquel (${posesTotalTroquel}).`
      );
    }
    forma.componentes.forEach((c, ci) => {
      if (!c.referencia_codigo.trim())
        errores.push(`Forma ${n}, ref ${ci + 1}: indica el código de referencia.`);
      if (!integerOrZeroForDespacho(c.poses_en_forma))
        errores.push(`Forma ${n}, ref ${ci + 1}: indica las poses.`);
    });
  });

  if (formas.length > FORMAS_MAX_WARNING) {
    warnings.push(
      `Más de ${FORMAS_MAX_WARNING} formas: en Optimus suelen partirse en 2 pedidos.`
    );
  }

  if (cantidadPedido > 0) {
    const totalEst = totalEstuchesFormas(formas);
    if (totalEst > 0 && totalEst !== cantidadPedido) {
      warnings.push(
        `Estuches calculados (${totalEst.toLocaleString("es-ES")}) ≠ cantidad pedida (${cantidadPedido.toLocaleString("es-ES")}).`
      );
    }
  }

  return { ok: errores.length === 0, errores, warnings };
}

/** Genera el num_pedido de una hija: padre + sufijo 2 dígitos (01, 02, …). */
export function buildHijaNumPedido(padre: string, index: number): string {
  return `${padre}-${String(index + 1).padStart(2, "0")}`;
}

export function emptyDespachoMeta(): DespachoMeta {
  return {
    cliente: "",
    trabajo: "",
    cantidad: "",
    pedido_cliente: "",
    fecha_entrega: "",
  };
}

export function emptyDespachoForm(): DespachoFormState {
  return {
    tintas: "",
    material: "",
    tamano_hoja: "",
    gramaje: "",
    num_hojas_brutas: "",
    num_hojas_netas: "",
    horas_entrada: "",
    horas_tiraje: "",
    horas_estimadas_troquelado: "",
    horas_estimadas_engomado: "",
    tipo_engomado: "",
    troquel: "",
    poses: "",
    acabado_pral: "",
    notas: "",
    referencia_id: null,
    referencia_codigo: "",
    ot_anterior_numero: "",
    ot_anterior_id: null,
  };
}

export const DESPACHO_CLONE_FIELDS = [
  "tintas",
  "material",
  "tamano_hoja",
  "gramaje",
  "troquel",
  "poses",
  "acabado_pral",
  "tipo_engomado",
  "notas",
] as const;

export const DESPACHO_CLONE_SELECT =
  "tintas, material, tamano_hoja, gramaje, troquel, poses, acabado_pral, tipo_engomado, notas, despachado_at";

export function applyClonePrefill(
  form: DespachoFormState,
  source: Record<string, unknown>
): { next: DespachoFormState; filled: number } {
  const next = { ...form };
  let filled = 0;
  for (const field of DESPACHO_CLONE_FIELDS) {
    const current = String(next[field] ?? "").trim();
    if (current) continue;
    const raw = source[field];
    if (raw == null) continue;
    const valueStr = String(raw).trim();
    if (!valueStr) continue;
    next[field] = valueStr;
    filled += 1;
  }
  return { next, filled };
}

export function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function numberOrZeroForDespacho(s: string): number {
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function integerOrZeroForDespacho(s: string): number {
  return Math.trunc(numberOrZeroForDespacho(s));
}

export function formatFechaEntregaCorta(
  value: string | null | undefined
): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseReferenciaClienteFromTitulo(
  titulo: string | null | undefined
): string {
  const match = String(titulo ?? "")
    .trim()
    .match(/^([A-Z]{1,6}\d{1,8})\s*[-–—]\s+/i);
  return match?.[1]?.trim().toUpperCase() ?? "";
}

export function parseDescripcionReferenciaFromTitulo(
  titulo: string | null | undefined
): string {
  return String(titulo ?? "")
    .trim()
    .replace(/^[A-Z]{1,6}\d{1,8}\s*[-–—]\s+/i, "")
    .trim();
}

/** IDs de procesos externos en prod_procesos_cat. */
export const PROCESO_EXTERNO_IDS = new Set([
  3, 4, 5, 6, 7, 8, 9, 11, 13, 14, 21,
]);

export const PROCESO_CTP_ID = 16;
export const PROCESO_GUILLOTINA_ID = 17;
export const PROCESO_OFFSET_ID = 1;
export const PROCESO_DIGITAL_ID = 2;
export const PROCESO_TROQUEL_ID = 10;
export const PROCESO_ENGOMADO_ID = 12;
export const PROCESO_MANIPULADOS_ID = 15;
export const PROCESO_DESBROCE_ID = 22;

/** Datos de proceso capturados en el wizard (se siembran en prod_ot_pasos.datos_proceso). */
export type DespachoWizardGuillotinaDatos = {
  patron_corte: string;
  tamano_final: string;
  hojas_iniciales: string;
  hojas_finales: string;
};

export type DespachoWizardImpresionDatos = {
  /** Brutas de entrada a impresión (salida guillotina / paso anterior). */
  hojas_brutas: string;
  /** Netas previstas tras impresión (alimentan desbroce). */
  hojas_netas: string;
  formato_hojas: string;
};

export type DespachoWizardProcesoDatos = {
  guillotina: DespachoWizardGuillotinaDatos;
  impresion: DespachoWizardImpresionDatos;
  ctp: DespachoWizardCtpDatos;
};

export function emptyDespachoWizardProcesoDatos(): DespachoWizardProcesoDatos {
  return {
    guillotina: {
      patron_corte: "",
      tamano_final: "",
      hojas_iniciales: "",
      hojas_finales: "",
    },
    impresion: {
      hojas_brutas: "",
      hojas_netas: "",
      formato_hojas: "",
    },
    ctp: emptyDespachoWizardCtpDatos(),
  };
}

/** Hojas brutas del pliego compra (entrada típica a guillotina). */
export function hojasBrutasCompraDespacho(form: DespachoFormState): number {
  return integerOrZeroForDespacho(form.num_hojas_brutas);
}

/** Hojas netas del pliego compra. */
export function hojasNetasCompraDespacho(form: DespachoFormState): number {
  return integerOrZeroForDespacho(form.num_hojas_netas);
}

/** Fallback genérico compra (netas si hay, si no brutas). */
export function hojasCompraDespacho(form: DespachoFormState): number {
  const netas = hojasNetasCompraDespacho(form);
  if (netas > 0) return netas;
  return hojasBrutasCompraDespacho(form);
}

function tieneImpresionEnRuta(procesoIdsInRoute: Set<number>): boolean {
  return (
    procesoIdsInRoute.has(PROCESO_OFFSET_ID) ||
    procesoIdsInRoute.has(PROCESO_DIGITAL_ID)
  );
}

/** Brutas de entrada a impresión (post guillotina / paso anterior). */
export function hojasBrutasImpresionDespacho(
  form: DespachoFormState,
  procesoDatos: DespachoWizardProcesoDatos,
  procesoIdsInRoute: Set<number>
): number {
  if (tieneImpresionEnRuta(procesoIdsInRoute)) {
    const brutas = integerOrZeroForDespacho(procesoDatos.impresion.hojas_brutas);
    if (brutas > 0) return brutas;
  }
  if (procesoIdsInRoute.has(PROCESO_GUILLOTINA_ID)) {
    const finales = integerOrZeroForDespacho(
      procesoDatos.guillotina.hojas_finales
    );
    if (finales > 0) return finales;
  }
  return hojasBrutasCompraDespacho(form) || hojasCompraDespacho(form);
}

/** Netas previstas tras impresión — base para estuches en desbroce. */
export function hojasNetasParaEstuchesDespacho(
  form: DespachoFormState,
  procesoDatos: DespachoWizardProcesoDatos,
  procesoIdsInRoute: Set<number>
): number {
  if (tieneImpresionEnRuta(procesoIdsInRoute)) {
    return integerOrZeroForDespacho(procesoDatos.impresion.hojas_netas);
  }
  if (procesoIdsInRoute.has(PROCESO_GUILLOTINA_ID)) {
    return integerOrZeroForDespacho(procesoDatos.guillotina.hojas_finales);
  }
  return hojasNetasCompraDespacho(form) || hojasBrutasCompraDespacho(form);
}

export function estuchesEstimadosDespacho(
  form: DespachoFormState,
  procesoDatos: DespachoWizardProcesoDatos,
  procesoIdsInRoute: Set<number>
): { hojas: number; poses: number; estuches: number } | null {
  const hojas = hojasNetasParaEstuchesDespacho(
    form,
    procesoDatos,
    procesoIdsInRoute
  );
  const poses = integerOrZeroForDespacho(form.poses);
  if (!hojas || !poses) return null;
  return { hojas, poses, estuches: hojas * poses };
}

function numOrNull(s: string): number | null {
  const n = integerOrZeroForDespacho(s);
  return n > 0 ? n : null;
}

/** Construye datos_proceso JSON al guardar despacho. */
export function buildDatosProcesoSeed(
  procesoId: number,
  form: DespachoFormState,
  procesoDatos: DespachoWizardProcesoDatos,
  procesoIdsInRoute: Set<number> = new Set(),
): Record<string, unknown> | null {
  if (procesoId === PROCESO_GUILLOTINA_ID) {
    const g = procesoDatos.guillotina;
    const payload: Record<string, unknown> = {
      tamano_inicial: form.tamano_hoja.trim() || null,
      hojas_iniciales:
        numOrNull(g.hojas_iniciales) ??
        (hojasBrutasCompraDespacho(form) || null),
      patron_corte: g.patron_corte.trim() || null,
      tamano_final: g.tamano_final.trim() || null,
      hojas_finales: numOrNull(g.hojas_finales),
    };
    return Object.values(payload).some((v) => v != null && v !== "") ? payload : null;
  }
  if (procesoId === PROCESO_OFFSET_ID || procesoId === PROCESO_DIGITAL_ID) {
    const imp = procesoDatos.impresion;
    const hojasBrutas =
      numOrNull(imp.hojas_brutas) ??
      numOrNull(procesoDatos.guillotina.hojas_finales) ??
      (hojasBrutasCompraDespacho(form) || null);
    const hojasNetas = numOrNull(imp.hojas_netas);
    const payload: Record<string, unknown> = {
      hojas_brutas: hojasBrutas,
      hojas_netas: hojasNetas,
      formato_hojas:
        imp.formato_hojas.trim() ||
        procesoDatos.guillotina.tamano_final.trim() ||
        null,
      horas_entrada_previsto: numberOrZeroForDespacho(form.horas_entrada) || null,
      horas_impresion_previsto: numberOrZeroForDespacho(form.horas_tiraje) || null,
    };
    return Object.values(payload).some((v) => v != null && v !== "") ? payload : null;
  }
  if (procesoId === PROCESO_TROQUEL_ID) {
    const hojas =
      numOrNull(procesoDatos.impresion.hojas_brutas) ??
      numOrNull(procesoDatos.guillotina.hojas_finales);
    if (!form.troquel.trim() && !hojas) return null;
    return {
      troquel: form.troquel.trim() || null,
      num_figuras: integerOrZeroForDespacho(form.poses) || null,
      hojas_a_troquelar: hojas,
      horas_preparacion_previsto:
        parseOptionalDecimalInput(form.horas_estimadas_troquelado) ?? null,
    };
  }
  if (procesoId === PROCESO_CTP_ID) {
    const seed = buildCtpRequisitosSeedFromWizard(procesoDatos.ctp);
    return Object.keys(seed).length > 0 ? seed : null;
  }
  if (procesoId === PROCESO_ENGOMADO_ID) {
    const est = estuchesEstimadosDespacho(form, procesoDatos, procesoIdsInRoute);
    const payload: Record<string, unknown> = {};
    const tipo = form.tipo_engomado.trim();
    if (tipo) payload.tipo_engomado = tipo;
    const tiempo = parseOptionalDecimalInput(form.horas_estimadas_engomado);
    if (tiempo != null && tiempo > 0) payload.tiempo_previsto = tiempo;
    if (est != null && est.estuches > 0) payload.estuches_realizar = est.estuches;
    return Object.keys(payload).length > 0 ? payload : null;
  }
  return null;
}

/** Restaura wizard proceso datos desde pasos existentes. */
export function parseProcesoDatosFromPasos(
  pasos: Array<{ proceso_id: number; datos_proceso?: unknown }>
): DespachoWizardProcesoDatos {
  const next = emptyDespachoWizardProcesoDatos();
  for (const p of pasos) {
    const raw = p.datos_proceso;
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    if (p.proceso_id === PROCESO_GUILLOTINA_ID) {
      next.guillotina = {
        patron_corte: String(d.patron_corte ?? ""),
        tamano_final: String(d.tamano_final ?? ""),
        hojas_iniciales:
          d.hojas_iniciales == null ? "" : String(d.hojas_iniciales),
        hojas_finales:
          d.hojas_finales == null ? "" : String(d.hojas_finales),
      };
    }
    if (
      p.proceso_id === PROCESO_OFFSET_ID ||
      p.proceso_id === PROCESO_DIGITAL_ID
    ) {
      next.impresion = {
        hojas_brutas:
          d.hojas_brutas == null ? "" : String(d.hojas_brutas),
        hojas_netas:
          d.hojas_netas == null ? "" : String(d.hojas_netas),
        formato_hojas: String(d.formato_hojas ?? ""),
      };
    }
    if (p.proceso_id === PROCESO_CTP_ID) {
      next.ctp = parseCtpWizardFromDatosProceso(d);
    }
  }
  return next;
}
