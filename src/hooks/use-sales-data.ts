"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { loadVentasCsv } from "@/lib/sales-csv";
import { parseSalesFile } from "@/lib/sales-file";
import { SalesParseError } from "@/lib/sales-ingest";
import {
  type SalesOrderRow,
  type SalesRoleView,
  comercialLabelFromRole,
  isTechnicalMarginAlert,
} from "@/types/sales";

export type CommercialScatterPoint = {
  comercial: string;
  ventas: number;
  margenPct: number;
};

export type MonthlyTrendPoint = {
  month: string;
  ventas: number;
  costes: number;
};

type DataSource =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string };

function filterByRole(rows: SalesOrderRow[], role: SalesRoleView): SalesOrderRow[] {
  const label = comercialLabelFromRole(role);
  if (!label) return rows;
  return rows.filter((r) => r.comercial === label);
}

function formatParseError(e: unknown): string {
  if (e instanceof SalesParseError) {
    const headers =
      e.detectedHeaders.length > 0
        ? `\n\nCabeceras detectadas (${e.detectedHeaders.length}): ${e.detectedHeaders
            .slice(0, 28)
            .join(", ")}${e.detectedHeaders.length > 28 ? "…" : ""}`
        : "";
    const hint = e.hint ? `\n\n${e.hint}` : "";
    return `${e.message}${headers}${hint}`;
  }
  return e instanceof Error ? e.message : "Error desconocido";
}

export function useSalesData() {
  const [allRows, setAllRows] = useState<SalesOrderRow[]>([]);
  const [roleView, setRoleView] = useState<SalesRoleView>("manager");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const sourceRef = useRef<DataSource | null>(null);

  const applyRows = useCallback(
    (rows: SalesOrderRow[], label: string, warnings: string[] = []) => {
      setAllRows(rows);
      setSourceLabel(label);
      setError(null);
      setParseWarnings(warnings);
    },
    []
  );

  const loadFromFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setParseWarnings([]);
      try {
        const data = await parseSalesFile(file);
        sourceRef.current = { kind: "file", file };
        applyRows(data.rows, file.name, data.warnings);
      } catch (e) {
        setError(formatParseError(e));
        setAllRows([]);
        sourceRef.current = null;
        setSourceLabel(null);
        setParseWarnings([]);
      } finally {
        setLoading(false);
      }
    },
    [applyRows]
  );

  const loadDemo = useCallback(
    async (url = "/data/ventasDataSet_mejorado.csv") => {
      setLoading(true);
      setError(null);
      setParseWarnings([]);
      try {
        const data = await loadVentasCsv(url);
        sourceRef.current = { kind: "url", url };
        applyRows(data.rows, "Datos de ejemplo", data.warnings);
      } catch (e) {
        setError(formatParseError(e));
        setAllRows([]);
        sourceRef.current = null;
        setSourceLabel(null);
        setParseWarnings([]);
      } finally {
        setLoading(false);
      }
    },
    [applyRows]
  );

  const reload = useCallback(async () => {
    const src = sourceRef.current;
    if (!src) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        src.kind === "file"
          ? await parseSalesFile(src.file)
          : await loadVentasCsv(src.url);
      setAllRows(data.rows);
      setParseWarnings(data.warnings);
      setError(null);
    } catch (e) {
      setError(formatParseError(e));
      setAllRows([]);
      setParseWarnings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredRows = useMemo(
    () => filterByRole(allRows, roleView),
    [allRows, roleView]
  );

  const hasData = allRows.length > 0;
  const canReload = sourceLabel !== null;

  const kpis = useMemo(() => {
    const ventasReales = filteredRows.reduce((s, r) => s + r.valorReal, 0);
    const margenBruto = filteredRows.reduce((s, r) => s + r.margenEuros, 0);
    const potencial = filteredRows.reduce((s, r) => s + r.valorPotencial, 0);
    const margenPromedioPct =
      ventasReales > 0 ? (margenBruto / ventasReales) * 100 : 0;
    const ratioEficiencia = potencial > 0 ? ventasReales / potencial : 0;
    const alertasCount = filteredRows.filter(isTechnicalMarginAlert).length;

    return {
      ventasReales,
      margenBruto,
      margenPromedioPct,
      ratioEficiencia,
      pedidosCount: filteredRows.length,
      alertasCount,
    };
  }, [filteredRows]);

  const topClientesMargen = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows) {
      map.set(r.cliente, (map.get(r.cliente) ?? 0) + r.margenEuros);
    }
    return [...map.entries()]
      .map(([name, margen]) => ({ name, margen }))
      .sort((a, b) => b.margen - a.margen)
      .slice(0, 10);
  }, [filteredRows]);

  const ventasPorSector = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows) {
      const key = r.tipoCliente || "Otros";
      map.set(key, (map.get(key) ?? 0) + r.valorReal);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  const scatterComerciales = useMemo((): CommercialScatterPoint[] => {
    const map = new Map<string, { ventas: number; margen: number }>();
    for (const r of allRows) {
      const prev = map.get(r.comercial) ?? { ventas: 0, margen: 0 };
      prev.ventas += r.valorReal;
      prev.margen += r.margenEuros;
      map.set(r.comercial, prev);
    }
    return [...map.entries()]
      .map(([comercial, { ventas, margen }]) => ({
        comercial,
        ventas,
        margenPct: ventas > 0 ? (margen / ventas) * 100 : 0,
      }))
      .sort((a, b) => a.comercial.localeCompare(b.comercial, "es"));
  }, [allRows]);

  const evolucionMensual = useMemo((): MonthlyTrendPoint[] => {
    const map = new Map<string, { ventas: number; costes: number }>();
    for (const r of filteredRows) {
      const d = r.fechaApertura.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(d)) continue;
      const prev = map.get(d) ?? { ventas: 0, costes: 0 };
      prev.ventas += r.valorReal;
      prev.costes += r.costeEstimado;
      map.set(d, prev);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { ventas, costes }]) => ({
        month,
        ventas,
        costes,
      }));
  }, [filteredRows]);

  const rowsWithAlerts = useMemo(
    () =>
      filteredRows.map((r) => ({
        row: r,
        critical: isTechnicalMarginAlert(r),
      })),
    [filteredRows]
  );

  return {
    allRows,
    filteredRows,
    rowsWithAlerts,
    roleView,
    setRoleView,
    loading,
    error,
    parseWarnings,
    hasData,
    sourceLabel,
    canReload,
    loadFromFile,
    loadDemo,
    reload,
    kpis,
    topClientesMargen,
    ventasPorSector,
    scatterComerciales,
    evolucionMensual,
    isTechnicalMarginAlert,
  };
}
