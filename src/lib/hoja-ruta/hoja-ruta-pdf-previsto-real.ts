/**
 * Filas del gráfico PREVISTO vs REAL del PDF de hoja de ruta.
 * CTP (16) y Guillotina (17) quedan fuera: no tienen cantidad comparable.
 */

import {
  PROCESO_CTP_ID,
  PROCESO_DESBROCE_ID,
  PROCESO_DIGITAL_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_GUILLOTINA_ID,
  PROCESO_MANIPULADOS_ID,
  PROCESO_OFFSET_ID,
  PROCESO_TROQUEL_ID,
} from "@/lib/despacho-wizard-shared";
import { EXTERNO_HOJAS_PROCESO_IDS } from "@/lib/externos-envio-brief";
import type { HojaRutaPaso } from "@/lib/hoja-ruta/hoja-ruta-query";

export type PrevistoRealPdfRow = {
  label: string;
  previsto: number;
  real: number;
  merma: number;
};

const SKIP_PROCESO_IDS = new Set([PROCESO_CTP_ID, PROCESO_GUILLOTINA_ID]);
const EXTERNO_HOJAS = new Set<number>(EXTERNO_HOJAS_PROCESO_IDS);

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mermaNonNeg(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function dpNum(paso: HojaRutaPaso | undefined, key: string): number {
  return n(paso?.datosProceso?.[key]);
}

function cantidadesExternoHojas(paso: HojaRutaPaso): {
  previsto: number;
  real: number;
  merma: number;
} {
  const env =
    n(paso.externo?.hojasEnviadas) || n(paso.datosProceso?.hojas_enviadas);
  const rec =
    n(paso.externo?.hojasRecibidasMuelle) ||
    n(paso.datosProceso?.hojas_recibidas_muelle) ||
    n(paso.datosProceso?.numero_hojas);
  const merma = env > 0 && rec > 0 ? Math.max(0, env - rec) : 0;
  return { previsto: env, real: rec, merma };
}

export function buildPrevistoRealPdfRows(pasos: HojaRutaPaso[]): PrevistoRealPdfRow[] {
  const rows: PrevistoRealPdfRow[] = [];

  for (let i = 0; i < pasos.length; i++) {
    const paso = pasos[i];
    const pid = paso.procesoId;
    if (pid == null || SKIP_PROCESO_IDS.has(pid)) continue;

    const dp = paso.datosProceso;
    let previsto = 0;
    let real = 0;
    let merma = 0;

    if (pid === PROCESO_OFFSET_ID || pid === PROCESO_DIGITAL_ID) {
      previsto = dpNum(paso, "hojas_netas") || dpNum(paso, "hojas_brutas");
      real = dpNum(paso, "hojas_impresas");
      merma = mermaNonNeg(dp?.hojas_merma);
    } else if (pid === PROCESO_TROQUEL_ID) {
      previsto = dpNum(paso, "hojas_troquelar");
      if (previsto === 0 && i > 0) {
        const prev = pasos[i - 1];
        previsto =
          n(prev.externo?.hojasRecibidasMuelle) ||
          dpNum(prev, "hojas_recibidas_muelle") ||
          dpNum(prev, "hojas_impresas") ||
          dpNum(prev, "hojas_finales");
      }
      real = dpNum(paso, "hojas_troqueladas");
      merma = mermaNonNeg(dp?.hojas_merma);
    } else if (pid === PROCESO_DESBROCE_ID) {
      const hojas = dpNum(paso, "hojas_entrada");
      const poses = dpNum(paso, "poses");
      previsto = hojas > 0 && poses > 0 ? hojas * poses : hojas;
      real = dpNum(paso, "estuches_desbrozados");
    } else if (pid === PROCESO_ENGOMADO_ID) {
      previsto = dpNum(paso, "estuches_realizar") || dpNum(paso, "cantidad_total");
      real = dpNum(paso, "estuches_engomados");
    } else if (pid === PROCESO_MANIPULADOS_ID) {
      real = dpNum(paso, "unidades");
    } else if (paso.esExterno || EXTERNO_HOJAS.has(pid)) {
      const ext = cantidadesExternoHojas(paso);
      previsto = ext.previsto;
      real = ext.real;
      merma = ext.merma;
    } else {
      continue;
    }

    if (previsto <= 0 && real <= 0 && merma <= 0) continue;

    rows.push({
      label: `${paso.orden} · ${paso.procesoNombre ?? "Proceso"}`,
      previsto,
      real,
      merma,
    });
  }

  return rows;
}
