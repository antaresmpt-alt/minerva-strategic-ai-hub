"use client";

import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Route,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchPipelineRows,
  type FetchPipelineFilters,
} from "@/lib/pipeline/pipeline-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const STEP_BADGE_STYLES: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-700",
  disponible: "bg-blue-100 text-blue-800",
  en_marcha: "bg-amber-100 text-amber-800",
  pausado: "bg-orange-100 text-orange-800",
  finalizado: "bg-emerald-100 text-emerald-800",
};

function fmtHours(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}h`;
}

export function PlanificacionPipelineTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const didInitFromUrl = useRef(false);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchPipelineRows>>>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [onlyIncidencias, setOnlyIncidencias] = useState(false);
  const [externoFilter, setExternoFilter] = useState<"all" | "yes" | "no">("all");
  const [estadoPasoActual, setEstadoPasoActual] =
    useState<FetchPipelineFilters["estadoPasoActual"]>("all");
  const [quickRiesgo, setQuickRiesgo] = useState(false);
  const [quickBloqueado, setQuickBloqueado] = useState(false);
  const [quickExternoActivo, setQuickExternoActivo] = useState(false);
  const [quickSinItinerario, setQuickSinItinerario] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOt, setDetailOt] = useState<Awaited<ReturnType<typeof fetchPipelineRows>>[number] | null>(null);
  const [selectedOtNumero, setSelectedOtNumero] = useState<string | null>(null);

  useEffect(() => {
    if (didInitFromUrl.current) return;

    const searchQ = searchParams.get("search");
    if (searchQ) {
      setSearchInput(searchQ);
      setSearch(searchQ);
    }

    const onlyIncidenciasQ = searchParams.get("onlyIncidencias");
    if (onlyIncidenciasQ === "1") setOnlyIncidencias(true);

    const externoQ = searchParams.get("externo");
    if (externoQ === "yes" || externoQ === "no" || externoQ === "all") {
      setExternoFilter(externoQ);
    }

    const estadoQ = searchParams.get("estadoPasoActual");
    if (
      estadoQ === "all" ||
      estadoQ === "pendiente" ||
      estadoQ === "disponible" ||
      estadoQ === "en_marcha" ||
      estadoQ === "pausado" ||
      estadoQ === "finalizado"
    ) {
      setEstadoPasoActual(estadoQ);
    }

    if (searchParams.get("quickRiesgo") === "1") setQuickRiesgo(true);
    if (searchParams.get("quickBloqueado") === "1") setQuickBloqueado(true);
    if (searchParams.get("quickExternoActivo") === "1") setQuickExternoActivo(true);
    if (searchParams.get("quickSinItinerario") === "1") setQuickSinItinerario(true);
    if (searchParams.get("compact") === "1") setCompactMode(true);
    const otQ = searchParams.get("ot");
    if (otQ) setSelectedOtNumero(otQ);

    didInitFromUrl.current = true;
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!selectedOtNumero) return;
    const row = rows.find((r) => r.otNumero === selectedOtNumero);
    if (!row) return;
    setDetailOt(row);
    setDetailOpen(true);
  }, [rows, selectedOtNumero]);

  useEffect(() => {
    if (!didInitFromUrl.current) return;

    const next = new URLSearchParams(searchParams.toString());
    const setOrDelete = (k: string, v: string | null | undefined) => {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    };

    setOrDelete("search", search || null);
    setOrDelete("onlyIncidencias", onlyIncidencias ? "1" : null);
    setOrDelete("externo", externoFilter === "all" ? null : externoFilter);
    setOrDelete(
      "estadoPasoActual",
      estadoPasoActual === "all" ? null : estadoPasoActual,
    );
    setOrDelete("quickRiesgo", quickRiesgo ? "1" : null);
    setOrDelete("quickBloqueado", quickBloqueado ? "1" : null);
    setOrDelete("quickExternoActivo", quickExternoActivo ? "1" : null);
    setOrDelete("quickSinItinerario", quickSinItinerario ? "1" : null);
    setOrDelete("compact", compactMode ? "1" : null);
    setOrDelete("ot", detailOpen ? selectedOtNumero : null);

    const nextQuery = next.toString();
    if (nextQuery === searchParamsString) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [
    compactMode,
    detailOpen,
    estadoPasoActual,
    externoFilter,
    onlyIncidencias,
    pathname,
    quickBloqueado,
    quickExternoActivo,
    quickRiesgo,
    quickSinItinerario,
    router,
    searchParamsString,
    selectedOtNumero,
    search,
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPipelineRows(supabase, {
        search,
        onlyIncidencias,
        externo:
          externoFilter === "all" ? undefined : externoFilter === "yes",
        estadoPasoActual,
        limit: 700,
      });
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el pipeline.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [estadoPasoActual, externoFilter, onlyIncidencias, search, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (quickRiesgo && row.riesgo === "ok") return false;
      if (quickBloqueado && !row.badges.includes("bloqueado")) return false;
      if (quickExternoActivo && !row.badges.includes("externo_activo")) return false;
      if (quickSinItinerario && !row.badges.includes("sin_itinerario")) return false;
      return true;
    });
  }, [quickBloqueado, quickExternoActivo, quickRiesgo, quickSinItinerario, rows]);

  const kpis = useMemo(() => {
    const total = visibleRows.length;
    const enMarcha = visibleRows.filter((r) => r.pasoActual?.estadoPaso === "en_marcha").length;
    const enRiesgo = visibleRows.filter((r) => r.riesgo !== "ok").length;
    const bloqueadas = visibleRows.filter((r) => r.badges.includes("bloqueado")).length;
    return { total, enMarcha, enRiesgo, bloqueadas };
  }, [visibleRows]);

  const openDetail = useCallback(
    (row: Awaited<ReturnType<typeof fetchPipelineRows>>[number]) => {
      setDetailOt(row);
      setSelectedOtNumero(row.otNumero);
      setDetailOpen(true);
    },
    [],
  );

  return (
    <TooltipProvider>
      <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg text-[#002147]">Pipeline OT</CardTitle>
              <CardDescription>
                Vista central del itinerario por OT (paso actual, siguiente y riesgo). Click en una OT para ver el detalle.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCcw className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar OT, cliente o trabajo"
              className="h-9 max-w-sm"
            />
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
              value={estadoPasoActual ?? "all"}
              onChange={(e) =>
                setEstadoPasoActual(
                  e.target.value === "all"
                    ? "all"
                    : (e.target.value as FetchPipelineFilters["estadoPasoActual"]),
                )
              }
            >
              <option value="all">Estado paso actual: todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="disponible">Disponible</option>
              <option value="en_marcha">En marcha</option>
              <option value="pausado">Pausado</option>
              <option value="finalizado">Finalizado</option>
            </select>
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
              value={externoFilter}
              onChange={(e) => setExternoFilter(e.target.value as "all" | "yes" | "no")}
            >
              <option value="all">Externos: todos</option>
              <option value="yes">Con externo</option>
              <option value="no">Sin externo</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={onlyIncidencias}
                onChange={(e) => setOnlyIncidencias(e.target.checked)}
              />
              Solo incidencias
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={compactMode}
                onChange={(e) => setCompactMode(e.target.checked)}
              />
              Modo compacto
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Filtros rapidos:</span>
            <Button
              type="button"
              size="sm"
              variant={quickRiesgo ? "default" : "outline"}
              className={quickRiesgo ? "h-8 bg-red-700 text-white hover:bg-red-800" : "h-8"}
              onClick={() => setQuickRiesgo((v) => !v)}
            >
              En riesgo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={quickBloqueado ? "default" : "outline"}
              className={quickBloqueado ? "h-8 bg-amber-700 text-white hover:bg-amber-800" : "h-8"}
              onClick={() => setQuickBloqueado((v) => !v)}
            >
              Bloqueadas
            </Button>
            <Button
              type="button"
              size="sm"
              variant={quickExternoActivo ? "default" : "outline"}
              className={quickExternoActivo ? "h-8 bg-blue-700 text-white hover:bg-blue-800" : "h-8"}
              onClick={() => setQuickExternoActivo((v) => !v)}
            >
              Externo activo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={quickSinItinerario ? "default" : "outline"}
              className={quickSinItinerario ? "h-8 bg-slate-700 text-white hover:bg-slate-800" : "h-8"}
              onClick={() => setQuickSinItinerario((v) => !v)}
            >
              Sin itinerario
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">OTs visibles</p>
              <p className="text-sm font-semibold text-[#002147]">{kpis.total}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] text-amber-700">En marcha</p>
              <p className="text-sm font-semibold text-amber-900">{kpis.enMarcha}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] text-red-700">Con riesgo</p>
              <p className="text-sm font-semibold text-red-900">{kpis.enRiesgo}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] text-amber-700">Bloqueadas</p>
              <p className="text-sm font-semibold text-amber-900">{kpis.bloqueadas}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin" />
              Cargando pipeline...
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              No hay OTs para los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200/90">
              <Table className={compactMode ? "min-w-[68rem]" : "min-w-[72rem]"}>
                <TableHeader>
                  <TableRow className="bg-slate-50/90">
                    <TableHead>OT</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Trabajo</TableHead>
                    <TableHead>Paso actual</TableHead>
                    <TableHead>Siguiente</TableHead>
                    <TableHead>Timeline</TableHead>
                    <TableHead>Plan/Real</TableHead>
                    <TableHead>Desv.</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Riesgo</TableHead>
                    <TableHead>Badges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow
                      key={row.otNumero}
                      className={compactMode ? "h-8 cursor-pointer" : "cursor-pointer"}
                      onClick={() => openDetail(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(row);
                        }
                      }}
                    >
                      <TableCell className={compactMode ? "py-1 font-mono text-[11px] font-semibold text-[#002147]" : "font-mono text-xs font-semibold text-[#002147]"}>
                        {row.otNumero}
                      </TableCell>
                      <TableCell className={compactMode ? "max-w-[10rem] truncate py-1 text-[11px]" : "max-w-[12rem] truncate text-xs"} title={row.cliente ?? ""}>
                        {row.cliente ?? "—"}
                      </TableCell>
                      <TableCell className={compactMode ? "max-w-[12rem] truncate py-1 text-[11px]" : "max-w-[16rem] truncate text-xs"} title={row.trabajo ?? ""}>
                        {row.trabajo ?? "—"}
                      </TableCell>
                      <TableCell>
                        {row.pasoActual ? (
                          <span className={compactMode ? "text-[11px] font-medium" : "text-xs font-medium"}>
                            {row.pasoActual.procesoNombre ?? "—"}{" "}
                            <span className="text-slate-500">({row.pasoActual.estadoPaso})</span>
                          </span>
                        ) : (
                          <span className={compactMode ? "text-[11px] text-slate-500" : "text-xs text-slate-500"}>—</span>
                        )}
                      </TableCell>
                      <TableCell className={compactMode ? "py-1 text-[11px]" : "text-xs"}>
                        {row.siguientePaso?.procesoNombre ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className={compactMode ? "flex max-w-[20rem] flex-wrap gap-0.5" : "flex max-w-[22rem] flex-wrap gap-1"}>
                          {row.pasos.slice(0, compactMode ? 10 : 8).map((p) => {
                            const tooltipLines: string[] = [];
                            tooltipLines.push(`${p.orden}. ${p.procesoNombre ?? "—"} · ${p.estadoPaso}`);
                            if (p.esExterno) {
                              tooltipLines.push(
                                `Externo: ${p.externo?.estado ?? "—"}${p.externo?.proveedorNombre ? ` · ${p.externo?.proveedorNombre}` : ""}`,
                              );
                            }
                            if (p.ejecucion) {
                              tooltipLines.push(
                                `Ejecución: ${p.ejecucion.estado}${p.ejecucion.maquinista ? ` · ${p.ejecucion.maquinista}` : ""}`,
                              );
                              if (p.ejecucion.horasReales != null) tooltipLines.push(`Horas reales: ${p.ejecucion.horasReales}`);
                              if (p.ejecucion.inicioRealAt) tooltipLines.push(`Inicio real: ${p.ejecucion.inicioRealAt}`);
                            }
                            if (p.resumenCorto) tooltipLines.push(p.resumenCorto);
                            return (
                              <Tooltip key={p.pasoId}>
                                <TooltipTrigger asChild>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md ${compactMode ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"} ${
                                      STEP_BADGE_STYLES[p.estadoPaso] ?? STEP_BADGE_STYLES.pendiente
                                    }`}
                                  >
                                    <Route className="size-3" />
                                    {p.orden}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[22rem] whitespace-pre-wrap">
                                  {tooltipLines.join("\n")}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {row.pasos.length > (compactMode ? 10 : 8) ? (
                            <span className="text-[10px] text-slate-500">
                              +{row.pasos.length - (compactMode ? 10 : 8)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={compactMode ? "py-1 text-[11px]" : "text-xs"}>
                        {fmtHours(row.analytics.horasPlanificadasTotal)} / {fmtHours(row.analytics.horasRealesTotal)}
                      </TableCell>
                      <TableCell className={compactMode ? "py-1 text-[11px]" : "text-xs"}>
                        {row.analytics.desviacionHoras != null ? (
                          <span className={row.analytics.desviacionHoras > 0 ? "text-red-700" : "text-emerald-700"}>
                            {row.analytics.desviacionHoras > 0 ? "+" : ""}
                            {row.analytics.desviacionHoras.toFixed(1)}h
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className={compactMode ? "py-1 text-[11px]" : "text-xs"}>
                        {row.analytics.etaPrevista ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            row.analytics.slaStatus === "late"
                              ? "bg-red-100 text-red-800"
                              : row.analytics.slaStatus === "at_risk"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {row.analytics.slaStatus}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            row.riesgo === "overdue"
                              ? "bg-red-100 text-red-800"
                              : row.riesgo === "warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {row.riesgo}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.badges.map((b) => (
                            <span
                              key={b}
                            className={`inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 ${compactMode ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"}`}
                            >
                              <AlertTriangle className="size-3" />
                              {b}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <Dialog
          open={detailOpen}
          onOpenChange={(o) => {
            setDetailOpen(o);
            if (!o) {
              setDetailOt(null);
              setSelectedOtNumero(null);
            }
          }}
        >
          <DialogContent className="flex max-h-[min(94vh,860px)] max-w-[min(96vw,940px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
              <DialogTitle className="text-base">
                OT <span className="font-mono text-sm font-semibold text-[#002147]">{detailOt?.otNumero ?? ""}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Paso actual / siguiente + detalle de ejecución y externo (desde `prod_ot_pasos`).
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {detailOt ? (
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {detailOt.badges.includes("sin_itinerario") ? (
                          <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            <AlertTriangle className="size-4 text-slate-500" />
                            Sin itinerario
                          </span>
                        ) : null}
                        {detailOt.badges.includes("externo_activo") ? (
                          <span className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                            <ExternalLink className="size-4 text-blue-700" />
                            Externo activo
                          </span>
                        ) : null}
                        {detailOt.badges.includes("bloqueado") ? (
                          <span className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                            <Clock className="size-4 text-amber-700" />
                            Bloqueado
                          </span>
                        ) : null}
                        {detailOt.badges.includes("en_riesgo") ? (
                          <span className="inline-flex items-center gap-2 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-900">
                            <Zap className="size-4 text-red-700" />
                            Riesgo
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-slate-700">
                        <div className="font-semibold">{detailOt.cliente ?? "—"} · {detailOt.trabajo ?? "—"}</div>
                        <div className="text-xs text-slate-500">
                          Entrega: {detailOt.fechaCompromiso ?? "—"} · Estado OT: {detailOt.estadoOt ?? "—"}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        Paso actual:{" "}
                        <span className="font-medium">
                          {detailOt.pasoActual?.procesoNombre ?? "—"} ({detailOt.pasoActual?.estadoPaso ?? "—"})
                        </span>{" "}
                        · Siguiente:{" "}
                        <span className="font-medium">
                          {detailOt.siguientePaso?.procesoNombre ?? "—"}
                        </span>
                      </div>
                      <div className="grid gap-1 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 sm:grid-cols-2">
                        <div>
                          <span className="font-medium">Plan / Real:</span>{" "}
                          {fmtHours(detailOt.analytics.horasPlanificadasTotal)} / {fmtHours(detailOt.analytics.horasRealesTotal)}
                        </div>
                        <div>
                          <span className="font-medium">Desviación:</span>{" "}
                          {detailOt.analytics.desviacionHoras != null
                            ? `${detailOt.analytics.desviacionHoras > 0 ? "+" : ""}${detailOt.analytics.desviacionHoras.toFixed(1)}h`
                            : "—"}
                        </div>
                        <div>
                          <span className="font-medium">ETA:</span> {detailOt.analytics.etaPrevista ?? "—"}
                        </div>
                        <div>
                          <span className="font-medium">SLA:</span> {detailOt.analytics.slaStatus}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-[#002147]">Timeline completa</p>
                      {detailOt.pasos.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Esta OT no tiene pasos en base de datos (`prod_ot_pasos`).
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {detailOt.pasos.map((p) => {
                            const pillCls =
                              STEP_BADGE_STYLES[p.estadoPaso] ?? STEP_BADGE_STYLES.pendiente;
                            return (
                              <div key={p.pasoId} className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${pillCls}`}>
                                      {p.orden} · {p.procesoNombre ?? "—"}
                                    </span>
                                    {p.esExterno ? (
                                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                                        Externo
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="text-xs text-slate-500">{p.estadoPaso}</span>
                                </div>
                                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                  <div className="text-xs text-slate-700">
                                    <div className="font-medium">Máquina</div>
                                    <div className="text-slate-600">{p.maquinaNombre ?? "—"}{p.tipoMaquina ? ` · ${p.tipoMaquina}` : ""}</div>
                                  </div>
                                  <div className="text-xs text-slate-700">
                                    <div className="font-medium">Fechas</div>
                                    <div className="text-slate-600">
                                      Disp.: {p.fechaDisponible ?? "—"} · Inicio: {p.fechaInicio ?? "—"} · Fin: {p.fechaFin ?? "—"}
                                    </div>
                                  </div>
                                </div>
                                {p.resumenCorto ? (
                                  <div className="mt-2 text-xs text-slate-700">
                                    <span className="font-medium">Resumen:</span> {p.resumenCorto}
                                  </div>
                                ) : null}
                                {p.ejecucion ? (
                                  <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                                    <p className="text-xs font-semibold text-[#002147]">Ejecución</p>
                                    <p className="text-xs text-slate-600">
                                      Estado: <span className="font-medium">{p.ejecucion.estado}</span> · Maquinista: {p.ejecucion.maquinista ?? "—"}
                                      {p.ejecucion.horasReales != null ? ` · Horas reales: ${p.ejecucion.horasReales}` : ""}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Inicio real: {p.ejecucion.inicioRealAt ?? "—"} · Fin real: {p.ejecucion.finRealAt ?? "—"}
                                    </p>
                                    {p.ejecucion.incidencia ? <p className="text-xs text-red-800">Incidencia: {p.ejecucion.incidencia}</p> : null}
                                    {p.ejecucion.observaciones ? <p className="text-xs text-slate-600">Obs: {p.ejecucion.observaciones}</p> : null}
                                  </div>
                                ) : null}
                                {p.externo ? (
                                  <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/40 p-2">
                                    <p className="text-xs font-semibold text-[#002147]">Externo</p>
                                    <p className="text-xs text-slate-700">
                                      Estado: <span className="font-medium">{p.externo.estado ?? "—"}</span>
                                      {p.externo.proveedorNombre ? ` · Proveedor: ${p.externo.proveedorNombre}` : ""}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                      Envio: {p.externo.fechaEnvio ?? "—"} · Previsto: {p.externo.fechaPrevista ?? "—"}
                                    </p>
                                    {p.externo.observaciones ? <p className="text-xs text-slate-600">Obs: {p.externo.observaciones}</p> : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-[#002147]">Atajos</p>
                      <div className="mt-2 space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailOpen(false);
                            router.push("/produccion/ots?tab=despachadas");
                          }}
                          className="w-full justify-start"
                        >
                          <Route className="mr-2 size-4" />
                          Ver en OTs (Despachadas)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailOpen(false);
                            router.push("/produccion/ots?tab=planificacion");
                          }}
                          className="w-full justify-start"
                        >
                          <Route className="mr-2 size-4" />
                          Ver en Planificacion OT's
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void loadData();
                          }}
                          className="w-full justify-start"
                        >
                          <RefreshCcw className="mr-2 size-4" />
                          Refrescar pipeline
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-xs font-semibold text-[#002147]">Notas</p>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        El “GPS” de la OT se deriva de <code className="rounded bg-white px-1">prod_ot_pasos</code>. La ejecución real y
                        pausas se muestran desde <code className="rounded bg-white px-1">prod_mesa_ejecuciones</code> y <code className="rounded bg-white px-1">prod_mesa_ejecuciones_pausas</code>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-5">
              <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
                Cerrar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#002147] text-white hover:bg-[#001a38]"
                onClick={() => {
                  setDetailOpen(false);
                }}
                disabled={false}
              >
                Listo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
}

