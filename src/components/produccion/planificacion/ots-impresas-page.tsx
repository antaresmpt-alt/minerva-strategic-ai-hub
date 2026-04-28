"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Clock,
  PauseCircle,
  RefreshCcw,
} from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildEjecucionEfficiencyReport,
  formatMinutesDuration,
} from "@/lib/planificacion-ejecucion-efficiency";
import {
  loadAnaliticaPlantaData,
  type AnaliticaEstadoFilter,
  type AnaliticaMaquina,
  type AnaliticaPlantaEjecucion,
  type AnaliticaProceso,
} from "@/lib/planificacion-analytics-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { EstadoEjecucionMesa, MesaEjecucionPausa } from "@/types/planificacion-mesa";

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Rango personalizado" },
];

const CATEGORY_COLORS: Record<string, string> = {
  calidad: "#7C3AED",
  suministros: "#2563EB",
  tecnicos: "#DC2626",
  operativos: "#64748B",
};

const CATEGORY_LABELS: Record<string, string> = {
  calidad: "Calidad",
  suministros: "Suministros",
  tecnicos: "Técnicos",
  operativos: "Operativos",
};

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function resolveDateRange(
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (preset === "today") {
    return { start: startOfDay(now), end: endOfDay(now), label: "Hoy" };
  }
  if (preset === "yesterday") {
    const day = subDays(now, 1);
    return { start: startOfDay(day), end: endOfDay(day), label: "Ayer" };
  }
  if (preset === "week") {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
      label: "Esta semana",
    };
  }
  if (preset === "custom") {
    const start = startOfDay(parseInputDate(customStart) ?? now);
    const rawEnd = endOfDay(parseInputDate(customEnd) ?? start);
    const end = rawEnd < start ? endOfDay(start) : rawEnd;
    return {
      start,
      end,
      label: `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`,
    };
  }
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
    label: "Este mes",
  };
}

function estadoLabel(value: EstadoEjecucionMesa): string {
  if (value === "en_curso") return "En curso";
  if (value === "pausada") return "Pausada";
  if (value === "finalizada") return "Finalizada";
  return "Cancelada";
}

function fmtDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd/MM/yyyy HH:mm", { locale: es });
}

function fmtHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1).replace(/\.0$/, "")}h`;
}

function processTitle(proceso: AnaliticaProceso): string {
  if (proceso === "impresion") return "Impresión";
  return proceso;
}

function pageTitle(
  proceso: AnaliticaProceso,
  maquinaId: string | "all",
  maquinas: AnaliticaMaquina[],
): string {
  const base = `Analítica de ${processTitle(proceso)}`;
  if (maquinaId === "all") return `${base} - Todas las máquinas`;
  const machine = maquinas.find((m) => m.id === maquinaId);
  return machine ? `${base} - ${machine.nombre}` : base;
}

function statusBadgeClass(key: string): string {
  if (key === "productiva") return "bg-emerald-500/15 text-emerald-800";
  if (key === "atencion") return "bg-amber-500/15 text-amber-900";
  return "bg-red-500/15 text-red-800";
}

function truncateLabel(value: string, max = 18): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-1 truncate text-2xl font-bold text-[#002147]">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{detail}</p>
        </div>
        <span className={cn("rounded-xl p-2", accent)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}

export function OtsImpresasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [proceso, setProceso] = useState<AnaliticaProceso>("impresion");
  const [maquinaId, setMaquinaId] = useState<string | "all">("all");
  const [estado, setEstado] = useState<AnaliticaEstadoFilter>("todas");
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customStart, setCustomStart] = useState(() => dateInputValue(startOfMonth(new Date())));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));
  const [rows, setRows] = useState<AnaliticaPlantaEjecucion[]>([]);
  const [pausesByExecutionId, setPausesByExecutionId] = useState<Record<string, MesaEjecucionPausa[]>>({});
  const [maquinas, setMaquinas] = useState<AnaliticaMaquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customStart, customEnd),
    [customEnd, customStart, datePreset],
  );
  const report = useMemo(
    () => buildEjecucionEfficiencyReport(rows, pausesByExecutionId),
    [pausesByExecutionId, rows],
  );
  const metricsByExecution = useMemo(
    () => new Map(report.eficienciaPorOt.map((m) => [m.executionId, m] as const)),
    [report.eficienciaPorOt],
  );
  const paretoData = useMemo(
    () =>
      report.topMotivosPausa.slice(0, 8).map((item) => ({
        name: item.motivo,
        shortName: truncateLabel(item.motivo),
        categoriaKey: item.categoria,
        categoria: categoryLabel(item.categoria),
        minutos: item.minutos,
      })),
    [report.topMotivosPausa],
  );
  const categoryData = useMemo(() => {
    const byCategory = new Map(
      report.distribucionCategorias.map((item) => [item.categoria, item.minutos] as const),
    );
    return Object.keys(CATEGORY_LABELS)
      .map((categoria) => ({
        name: categoryLabel(categoria),
        categoria,
        minutos: byCategory.get(categoria) ?? 0,
      }))
      .filter((item) => item.minutos > 0);
  }, [report.distribucionCategorias]);
  const title = pageTitle(proceso, maquinaId, maquinas);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadAnaliticaPlantaData(supabase, {
        proceso,
        maquinaId,
        estado,
        startIso: dateRange.start.toISOString(),
        endIso: dateRange.end.toISOString(),
      });
      setRows(data.rows);
      setPausesByExecutionId(data.pausesByExecutionId);
      setMaquinas(data.maquinas);
      if (maquinaId !== "all" && !data.maquinas.some((m) => m.id === maquinaId)) {
        setMaquinaId("all");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la analítica de planta.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.end, dateRange.start, estado, maquinaId, proceso, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const mainCause = report.causaPrincipal
    ? `${report.causaPrincipal.motivo} · ${formatMinutesDuration(report.causaPrincipal.minutos)}`
    : "Sin pausas registradas";

  return (
    <section className="space-y-3">
      <Card className="border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg text-[#002147] md:text-xl">
                {title}
              </CardTitle>
              <CardDescription>
                Eficiencia operativa basada en ocupación real, marcha, pausas y
                causas principales. Preparado para evolucionar a OEE completo.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="w-full sm:w-fit"
            >
              <RefreshCcw className={cn("mr-1.5 size-4", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Rango de fechas</Label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={datePreset === preset.value ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setDatePreset(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <NativeSelect
              label="Proceso / sección"
              value={proceso}
              onChange={(e) => setProceso(e.target.value as AnaliticaProceso)}
              options={[{ value: "impresion", label: "Impresión" }]}
              className="h-8 text-xs"
            />
            <NativeSelect
              label="Máquina"
              value={maquinaId}
              onChange={(e) => setMaquinaId(e.target.value)}
              options={[
                { value: "all", label: "Todas las máquinas" },
                ...maquinas.map((m) => ({ value: m.id, label: m.nombre })),
              ]}
              className="h-8 text-xs"
            />
            <NativeSelect
              label="Estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as AnaliticaEstadoFilter)}
              options={[
                { value: "todas", label: "Todas" },
                { value: "finalizadas", label: "Finalizadas" },
                { value: "activas", label: "En curso / pausadas" },
              ]}
              className="h-8 text-xs"
            />
            {datePreset === "custom" ? (
              <div className="grid gap-2 md:col-span-2 xl:col-span-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="analitica-start" className="text-xs font-medium">
                      Desde
                    </Label>
                    <Input
                      id="analitica-start"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="analitica-end" className="text-xs font-medium">
                      Hasta
                    </Label>
                    <Input
                      id="analitica-end"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge variant="outline" className="gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {dateRange.label}
            </Badge>
            <Badge className={cn("border-transparent", statusBadgeClass(report.estadoMaquina.key))}>
              {report.estadoMaquina.label} · {report.eficienciaPct}%
            </Badge>
            <span>{rows.length} ejecuciones en el periodo</span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTriangle className="mb-2 size-4" aria-hidden />
          <AlertTitle>No se pudo cargar la analítica</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Eficiencia operativa"
            value={`${report.eficienciaPct}%`}
            detail="Tiempo de marcha / tiempo total de ocupación"
            icon={Activity}
            accent={statusBadgeClass(report.estadoMaquina.key)}
          />
          <KpiCard
            title="Tiempo de marcha"
            value={formatMinutesDuration(report.tiempoMarchaMin)}
            detail="Tiempo productivo estimado en el periodo filtrado"
            icon={Clock}
            accent="bg-emerald-500/15 text-emerald-800"
          />
          <KpiCard
            title="Tiempo de pausa"
            value={formatMinutesDuration(report.tiempoPausaMin)}
            detail={`${report.pauseDetails.length} pausas registradas`}
            icon={PauseCircle}
            accent="bg-amber-500/15 text-amber-900"
          />
          <KpiCard
            title="Causa principal"
            value={report.causaPrincipal?.motivo ?? "Sin pausas"}
            detail={mainCause}
            icon={BarChart3}
            accent="bg-violet-500/15 text-violet-900"
          />
        </div>
      )}

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Top motivos de pausa
            </CardTitle>
            <CardDescription>
              Pareto de minutos perdidos por motivo en el periodo filtrado.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 min-h-[260px] pl-0">
            {loading ? (
              <Skeleton className="ml-6 h-full rounded-xl" />
            ) : paretoData.length === 0 ? (
              <ChartEmpty>Sin pausas registradas para construir el Pareto.</ChartEmpty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={paretoData}
                  layout="vertical"
                  margin={{ left: 12, right: 24, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatMinutesDuration(Number(v))}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip
                    formatter={(v) => [
                      formatMinutesDuration(Number(v)),
                      "Tiempo perdido",
                    ]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="minutos" name="Minutos" fill="#002147" radius={[0, 5, 5, 0]}>
                    {paretoData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_COLORS[entry.categoriaKey] ?? "#002147"}
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Distribución por categorías
            </CardTitle>
            <CardDescription>
              Peso relativo de Calidad, Suministros, Técnicos y Operativos.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 min-h-[260px]">
            {loading ? (
              <Skeleton className="h-full rounded-xl" />
            ) : categoryData.length === 0 ? (
              <ChartEmpty>Sin pausas registradas para distribuir por categoría.</ChartEmpty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="minutos"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={96}
                    innerRadius={52}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {categoryData.map((entry) => (
                      <Cell
                        key={entry.categoria}
                        fill={CATEGORY_COLORS[entry.categoria] ?? "#64748B"}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v) => [
                      formatMinutesDuration(Number(v)),
                      "Tiempo de pausa",
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">Histórico del periodo</CardTitle>
          <CardDescription>
            Detalle de ejecuciones usado para los KPIs y gráficos superiores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
              <BarChart3 className="mx-auto mb-3 size-8 text-slate-400" aria-hidden />
              <p className="font-semibold text-[#002147]">Sin datos para este rango</p>
              <p className="mt-1 text-sm text-slate-600">
                Prueba con otro periodo, estado o máquina para analizar la eficiencia.
              </p>
            </div>
          ) : (
            <Table className="min-w-[1100px] text-xs">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>OT</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Plan</TableHead>
                  <TableHead className="text-right">Ocupación</TableHead>
                  <TableHead className="text-right">Pausa</TableHead>
                  <TableHead className="text-right">Eficiencia</TableHead>
                  <TableHead>Causa principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const metric = metricsByExecution.get(row.id);
                  const cause = metric?.causaPrincipal;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-semibold text-[#002147]">{row.ot}</TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {row.cliente ?? "—"}
                      </TableCell>
                      <TableCell>{row.maquinaNombre}</TableCell>
                      <TableCell>{estadoLabel(row.estadoEjecucion)}</TableCell>
                      <TableCell>{fmtDateTime(row.inicioRealAt)}</TableCell>
                      <TableCell>{fmtDateTime(row.finRealAt)}</TableCell>
                      <TableCell className="text-right">
                        {fmtHours(row.horasPlanificadasSnapshot)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMinutesDuration(metric?.tiempoTotalMin ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMinutesDuration(metric?.tiempoPausaMin ?? 0)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {metric?.eficienciaPct ?? 0}%
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {cause
                          ? `${cause.motivo} · ${formatMinutesDuration(cause.minutos)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
