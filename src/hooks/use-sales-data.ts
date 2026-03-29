"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { loadVentasCsv } from "@/lib/sales-csv";
import { parseSalesFile } from "@/lib/sales-file";
import {
  SalesParseError,
  type DashboardMode,
} from "@/lib/sales-ingest";
import {
  computeDeliveryTimeStatus,
  isOrderActiveForDelivery,
} from "@/lib/sales-delivery-timing";
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
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("PRO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const sourceRef = useRef<DataSource | null>(null);

  const applyRows = useCallback(
    (
      rows: SalesOrderRow[],
      label: string,
      warnings: string[] = [],
      mode: DashboardMode = "PRO"
    ) => {
      setAllRows(rows);
      setSourceLabel(label);
      setError(null);
      setParseWarnings(warnings);
      setDashboardMode(mode);
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
        applyRows(data.rows, file.name, data.warnings, data.dashboardMode);
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
        applyRows(data.rows, "Datos de ejemplo", data.warnings, data.dashboardMode);
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
      setDashboardMode(data.dashboardMode);
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

  /** LEGACY ignora filtro por comercial (no hay selector). */
  const displayRows = useMemo(() => {
    if (dashboardMode === "LEGACY") return allRows;
    return filteredRows;
  }, [dashboardMode, allRows, filteredRows]);

  const hasData = allRows.length > 0;
  const canReload = sourceLabel !== null;

  const kpis = useMemo(() => {
    const ventasReales = displayRows.reduce((s, r) => s + r.valorReal, 0);
    const margenBruto = displayRows.reduce((s, r) => s + r.margenEuros, 0);
    const potencial = displayRows.reduce((s, r) => s + r.valorPotencial, 0);
    const margenPromedioPct =
      ventasReales > 0 ? (margenBruto / ventasReales) * 100 : 0;
    const ratioEficiencia = potencial > 0 ? ventasReales / potencial : 0;
    const alertasCount = displayRows.filter(isTechnicalMarginAlert).length;

    return {
      ventasReales,
      margenBruto,
      margenPromedioPct,
      ratioEficiencia,
      pedidosCount: displayRows.length,
      alertasCount,
    };
  }, [displayRows]);

  const legacyKpis = useMemo(() => {
    const totalValorPotencial = displayRows.reduce(
      (s, r) => s + r.valorPotencial,
      0
    );
    const pedidosCount = displayRows.length;
    const ticketMedioPotencial =
      pedidosCount > 0 ? totalValorPotencial / pedidosCount : 0;
    return { totalValorPotencial, pedidosCount, ticketMedioPotencial };
  }, [displayRows]);

  const topClientesMargen = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of displayRows) {
      map.set(r.cliente, (map.get(r.cliente) ?? 0) + r.margenEuros);
    }
    return [...map.entries()]
      .map(([name, margen]) => ({ name, margen }))
      .sort((a, b) => b.margen - a.margen)
      .slice(0, 10);
  }, [displayRows]);

  const topClientesPorPotencial = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of displayRows) {
      map.set(r.cliente, (map.get(r.cliente) ?? 0) + r.valorPotencial);
    }
    return [...map.entries()]
      .map(([name, potencial]) => ({ name, potencial }))
      .sort((a, b) => b.potencial - a.potencial)
      .slice(0, 10);
  }, [displayRows]);

  const ventasPorSector = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of displayRows) {
      const key = r.tipoCliente || "Otros";
      map.set(key, (map.get(key) ?? 0) + r.valorReal);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [displayRows]);

  const pedidosPorEstado = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of displayRows) {
      const k = r.estado?.trim() || "Sin estado";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [displayRows]);

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
    for (const r of displayRows) {
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
  }, [displayRows]);

  const rowsWithAlerts = useMemo(
    () =>
      displayRows.map((r) => ({
        row: r,
        critical:
          dashboardMode === "PRO" ? isTechnicalMarginAlert(r) : false,
        timeStatus: computeDeliveryTimeStatus(r),
      })),
    [displayRows, dashboardMode]
  );

  const deliveryRiskKpis = useMemo(() => {
    let late = 0;
    let risk = 0;
    for (const r of displayRows) {
      if (!isOrderActiveForDelivery(r.estado)) continue;
      const ts = computeDeliveryTimeStatus(r);
      if (ts === "late") late += 1;
      else if (ts === "risk") risk += 1;
    }
    return { late, risk };
  }, [displayRows]);

  return {
    allRows,
    filteredRows,
    displayRows,
    dashboardMode,
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
    legacyKpis,
    topClientesMargen,
    topClientesPorPotencial,
    ventasPorSector,
    pedidosPorEstado,
    scatterComerciales,
    evolucionMensual,
    isTechnicalMarginAlert,
    deliveryRiskKpis,
  };
}
