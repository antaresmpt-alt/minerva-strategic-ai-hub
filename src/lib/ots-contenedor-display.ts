import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchHijasByPadreNumeros,
  formatHijaDisplayLabel,
  isOtVisibleInPlanificacionList,
  matchesPlanificacionOtTipoFiltro,
  normalizeOtTipo,
  type OtContenedorMeta,
  type PlanificacionOtTipoFiltroUi,
} from "@/lib/planificacion-contenedor-query";
import type { ProdOtTipo } from "@/types/prod-ots";

/** Campos de presentación UI para filas contenedor / hija (Bloque 8.1). */
export type OtContenedorDisplayFields = {
  isHijaRow?: boolean;
  padreOt?: string | null;
  displayOtTipo?: ProdOtTipo;
  hijasCount?: number;
  formaDescripcion?: string | null;
  tipoHija?: OtContenedorMeta["tipoHija"];
};

export type WithOtContenedorDisplay<T> = T & OtContenedorDisplayFields;

export function resolveRowOtTipo(
  otTipo: unknown,
  otPadreNumero?: unknown,
): ProdOtTipo {
  const normalized = normalizeOtTipo(otTipo);
  if (normalized !== "simple") return normalized;
  const padre = String(otPadreNumero ?? "").trim();
  if (padre) return "hija";
  return "simple";
}

export function filterRowsByOtTipoFiltro<T>(
  rows: T[],
  getOtTipo: (row: T) => ProdOtTipo,
  filtro: PlanificacionOtTipoFiltroUi,
): T[] {
  return rows.filter((row) => matchesPlanificacionOtTipoFiltro(getOtTipo(row), filtro));
}

export function buildGroupedOtDisplayRows<T>(
  baseRows: T[],
  options: {
    filtro: PlanificacionOtTipoFiltroUi;
    expandedContenedores: Record<string, boolean>;
    hijaRowsByPadre: Record<string, T[]>;
    hijasCountByPadre: Record<string, number>;
    getOtNumero: (row: T) => string;
    getOtTipo: (row: T) => ProdOtTipo;
    getOtPadreNumero?: (row: T) => string | null;
    getFormaDescripcion?: (row: T) => string | null;
    getTipoHija?: (row: T) => OtContenedorMeta["tipoHija"] | null;
    getTitulo?: (row: T) => string | null;
  },
): WithOtContenedorDisplay<T>[] {
  const {
    filtro,
    expandedContenedores,
    hijaRowsByPadre,
    hijasCountByPadre,
    getOtNumero,
    getOtTipo,
    getOtPadreNumero,
    getFormaDescripcion,
    getTipoHija,
    getTitulo,
  } = options;

  const visible = filterRowsByOtTipoFiltro(baseRows, getOtTipo, filtro);

  if (filtro === "todas_planas") {
    return visible.map((row) => ({
      ...row,
      isHijaRow: getOtTipo(row) === "hija",
      padreOt: getOtPadreNumero?.(row) ?? null,
      displayOtTipo: getOtTipo(row),
      formaDescripcion: getFormaDescripcion?.(row) ?? null,
      tipoHija: getTipoHija?.(row) ?? null,
    }));
  }

  const out: WithOtContenedorDisplay<T>[] = [];

  for (const row of visible) {
    const ot = getOtNumero(row);
    const otTipo = getOtTipo(row);
    out.push({
      ...row,
      isHijaRow: false,
      padreOt: null,
      displayOtTipo: otTipo,
      hijasCount: otTipo === "contenedor" ? (hijasCountByPadre[ot] ?? 0) : undefined,
      formaDescripcion: getFormaDescripcion?.(row) ?? null,
      tipoHija: getTipoHija?.(row) ?? null,
    });

    if (filtro === "agrupado" && otTipo === "contenedor" && expandedContenedores[ot]) {
      for (const hija of hijaRowsByPadre[ot] ?? []) {
        const hijaOt = getOtNumero(hija);
        out.push({
          ...hija,
          isHijaRow: true,
          padreOt: ot,
          displayOtTipo: "hija",
          formaDescripcion: getFormaDescripcion?.(hija) ?? null,
          tipoHija: getTipoHija?.(hija) ?? null,
          hijasCount: undefined,
        });
      }
    }
  }

  return out;
}

export function formatOtContenedorHijaSubtitle(row: {
  otNumero: string;
  formaDescripcion?: string | null;
  tipoHija?: OtContenedorMeta["tipoHija"] | null;
  titulo?: string | null;
}): string {
  return formatHijaDisplayLabel({
    ot: row.otNumero,
    tipoHija: row.tipoHija,
    formaDescripcion: row.formaDescripcion,
    trabajo: row.titulo ?? null,
  });
}

type UseOtContenedorGroupedDisplayArgs<T> = {
  supabase: SupabaseClient;
  rows: T[];
  otTipoFilter: PlanificacionOtTipoFiltroUi;
  getOtNumero: (row: T) => string;
  getOtTipo: (row: T) => ProdOtTipo;
  getOtPadreNumero?: (row: T) => string | null;
  getFormaDescripcion?: (row: T) => string | null;
  getTipoHija?: (row: T) => OtContenedorMeta["tipoHija"] | null;
  getTitulo?: (row: T) => string | null;
  /** Carga filas hijas completas al expandir (p. ej. query BD o slice del listado). */
  loadHijaRows: (padreOt: string, hijasMeta: OtContenedorMeta[]) => Promise<T[]>;
};

export function useOtContenedorGroupedDisplay<T>({
  supabase,
  rows,
  otTipoFilter,
  getOtNumero,
  getOtTipo,
  getOtPadreNumero,
  getFormaDescripcion,
  getTipoHija,
  getTitulo,
  loadHijaRows,
}: UseOtContenedorGroupedDisplayArgs<T>) {
  const [expandedContenedores, setExpandedContenedores] = useState<Record<string, boolean>>(
    {},
  );
  const [hijaRowsByPadre, setHijaRowsByPadre] = useState<Record<string, T[]>>({});
  const [hijasCountByPadre, setHijasCountByPadre] = useState<Record<string, number>>({});
  const [loadingHijasPadre, setLoadingHijasPadre] = useState<string | null>(null);

  useEffect(() => {
    const padres = [
      ...new Set(
        rows
          .filter((r) => getOtTipo(r) === "contenedor")
          .map((r) => getOtNumero(r))
          .filter(Boolean),
      ),
    ];
    if (padres.length === 0) {
      setHijasCountByPadre({});
      return;
    }
    let cancelled = false;
    void fetchHijasByPadreNumeros(supabase, padres).then((map) => {
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const [padre, list] of map) {
        counts[padre] = list.length;
      }
      setHijasCountByPadre(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [rows, supabase, getOtNumero, getOtTipo]);

  const loadHijasForContenedor = useCallback(
    async (padreOt: string) => {
      if (hijaRowsByPadre[padreOt]?.length) return;
      setLoadingHijasPadre(padreOt);
      try {
        const fromList = rows.filter(
          (r) => getOtTipo(r) === "hija" && (getOtPadreNumero?.(r) ?? "") === padreOt,
        );
        if (fromList.length > 0) {
          setHijaRowsByPadre((prev) => ({ ...prev, [padreOt]: fromList }));
          return;
        }
        const hijasMap = await fetchHijasByPadreNumeros(supabase, [padreOt]);
        const hijasMeta = hijasMap.get(padreOt) ?? [];
        const loaded = await loadHijaRows(padreOt, hijasMeta);
        setHijaRowsByPadre((prev) => ({ ...prev, [padreOt]: loaded }));
      } finally {
        setLoadingHijasPadre((cur) => (cur === padreOt ? null : cur));
      }
    },
    [hijaRowsByPadre, rows, supabase, getOtTipo, getOtPadreNumero, loadHijaRows],
  );

  const toggleContenedorExpand = useCallback(
    (padreOt: string) => {
      const next = !expandedContenedores[padreOt];
      setExpandedContenedores((prev) => ({ ...prev, [padreOt]: next }));
      if (next) void loadHijasForContenedor(padreOt);
    },
    [expandedContenedores, loadHijasForContenedor],
  );

  const displayRows = useMemo(
    () =>
      buildGroupedOtDisplayRows(rows, {
        filtro: otTipoFilter,
        expandedContenedores,
        hijaRowsByPadre,
        hijasCountByPadre,
        getOtNumero,
        getOtTipo,
        getOtPadreNumero,
        getFormaDescripcion,
        getTipoHija,
        getTitulo,
      }),
    [
      rows,
      otTipoFilter,
      expandedContenedores,
      hijaRowsByPadre,
      hijasCountByPadre,
      getOtNumero,
      getOtTipo,
      getOtPadreNumero,
      getFormaDescripcion,
      getTipoHija,
      getTitulo,
    ],
  );

  return {
    displayRows,
    expandedContenedores,
    loadingHijasPadre,
    hijasCountByPadre,
    toggleContenedorExpand,
  };
}

/** Filtro PostgREST por `ot_tipo` (maestro OTs paginado). */
export function applyMasterOtsOtTipoServerFilter<
  T extends { or: (filter: string) => T; eq: (column: string, value: string) => T },
>(query: T, filtro: PlanificacionOtTipoFiltroUi): T {
  switch (filtro) {
    case "agrupado":
      return query.or("ot_tipo.is.null,ot_tipo.eq.simple,ot_tipo.eq.contenedor");
    case "solo_simples":
      return query.or("ot_tipo.is.null,ot_tipo.eq.simple");
    case "solo_contenedores":
      return query.eq("ot_tipo", "contenedor");
    default:
      return query;
  }
}

export function isOtRowSelectableInGroupedList(row: {
  isHijaRow?: boolean;
  displayOtTipo?: ProdOtTipo;
}): boolean {
  if (row.displayOtTipo === "contenedor") return false;
  return true;
}

export { isOtVisibleInPlanificacionList };
