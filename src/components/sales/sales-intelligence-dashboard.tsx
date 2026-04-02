"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import {
  AlertTriangle,
  Clock,
  Download,
  Euro,
  Info,
  Loader2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Printer,
  RefreshCw,
  ScatterChart as ScatterIcon,
  Send,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { GlobalModelSelector } from "@/components/layout/header";
import { LeadsManagementPanel } from "@/components/sales/leads-management-panel";
import { SalesOrdersGestionPanel } from "@/components/sales/sales-orders-gestion-panel";
import { buttonVariants } from "@/components/ui/button-variants";
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
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSalesData } from "@/hooks/use-sales-data";
import {
  buildDelayReportXlsxBlob,
  isOrderActiveForDelivery,
} from "@/lib/sales-delivery-timing";
import { useHubStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types/leads";
import {
  SALES_ROLE_LABELS,
  type DeliveryTimeStatus,
  type SalesOrderRow,
  type SalesRoleView,
} from "@/types/sales";

const PIE_COLORS = ["#002147", "#1e4976", "#C69C2B", "#64748b", "#0f766e"];

const fmtEuro = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) =>
  `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n)} %`;

const roleOptions = (Object.keys(SALES_ROLE_LABELS) as SalesRoleView[]).map(
  (k) => ({ value: k, label: SALES_ROLE_LABELS[k] })
);

function SiBadge({ value }: { value: string }) {
  const ok = value.toLowerCase() === "sí" || value.toLowerCase() === "si";
  return (
    <Badge variant={ok ? "success" : "secondary"} className="font-normal">
      {value || "—"}
    </Badge>
  );
}

function TimingBadge({ status }: { status: DeliveryTimeStatus }) {
  if (status === "late") {
    return (
      <Badge variant="destructive" className="font-normal">
        Retrasado
      </Badge>
    );
  }
  if (status === "risk") {
    return (
      <Badge
        variant="warning"
        className="border-orange-400/50 bg-orange-500/20 font-normal text-orange-950 dark:text-orange-100"
      >
        Riesgo {"<"} 7 días
      </Badge>
    );
  }
  if (status === "ok") {
    return (
      <Badge variant="success" className="font-normal">
        A tiempo
      </Badge>
    );
  }
  return (
    <span className="text-muted-foreground text-xs" title="Sin fecha o pedido cerrado">
      —
    </span>
  );
}

function KpiCard({
  title,
  subtitle,
  value,
  icon: Icon,
  valueClassName,
}: {
  title: string;
  subtitle?: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
}) {
  return (
    <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          {subtitle ? (
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          ) : null}
        </div>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div
          className={cn("font-heading text-2xl font-semibold tabular-nums", valueClassName)}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

const CHAT_ROW_CAP = 280;

function capRows<T>(arr: T[], n: number): T[] {
  return arr.length <= n ? arr : arr.slice(0, n);
}

function slimOrderForChat(r: SalesOrderRow) {
  return {
    idPedido: r.idPedido,
    estado: r.estado,
    cliente: r.cliente,
    comercial: r.comercial,
    fechaEntrega: r.fechaEntrega,
    valorReal: r.valorReal,
    margenPorcentaje: r.margenPorcentaje,
  };
}

function slimLeadForChat(l: LeadRow) {
  return {
    idLead: l.idLead,
    empresa: l.empresa,
    contacto: l.contacto,
    comercial: l.comercial,
    estado: l.estado,
    prioridad: l.prioridad,
    ultimoContacto: l.ultimoContacto,
    proximaAccion: l.proximaAccion,
  };
}

const FILE_ACCEPT =
  ".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export function SalesIntelligenceDashboard() {
  const globalModel = useHubStore((s) => s.globalModel);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const salesPrintRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: salesPrintRef,
    documentTitle: `Minerva-Ventas-${new Date().toISOString().slice(0, 10)}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 12mm; }
    `,
  });
  const {
    roleView,
    setRoleView,
    dashboardMode,
    loading,
    error,
    parseWarnings,
    hasData,
    canReload,
    sourceLabel,
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
    rowsWithAlerts,
    deliveryRiskKpis,
    displayRows,
  } = useSalesData();

  const [deliveryTableFilter, setDeliveryTableFilter] = useState<
    "all" | "alerts"
  >("all");

  const tableRowsFiltered = useMemo(() => {
    if (deliveryTableFilter === "all") return rowsWithAlerts;
    return rowsWithAlerts.filter(({ row, timeStatus }) => {
      if (!isOrderActiveForDelivery(row.estado)) return false;
      return timeStatus === "late" || timeStatus === "risk";
    });
  }, [rowsWithAlerts, deliveryTableFilter]);

  const [salesTab, setSalesTab] = useState("dashboard");
  const [filteredPedidos, setFilteredPedidos] = useState<SalesOrderRow[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadRow[]>([]);

  const [dataChatQuery, setDataChatQuery] = useState("");
  const [dataChatLoading, setDataChatLoading] = useState(false);
  const [dataChatError, setDataChatError] = useState<string | null>(null);
  const [dataChatReply, setDataChatReply] = useState<string | null>(null);
  const [dataChatPanelOpen, setDataChatPanelOpen] = useState(false);

  const onFilteredPedidosChange = useCallback((rows: SalesOrderRow[]) => {
    setFilteredPedidos(rows);
  }, []);

  const onFilteredLeadsChange = useCallback((rows: LeadRow[]) => {
    setFilteredLeads(rows);
  }, []);

  const buildChatTableData = useCallback((): string => {
    if (salesTab === "gestion" && hasData) {
      const filas = capRows(filteredPedidos, CHAT_ROW_CAP).map(slimOrderForChat);
      return JSON.stringify({
        vista: "gestion_pedidos",
        descripcion:
          "Pedidos visibles según filtros de la pestaña Gestión de Pedidos",
        totalFilasCoinciden: filteredPedidos.length,
        filas,
      });
    }
    if (salesTab === "leads") {
      const filas = capRows(filteredLeads, CHAT_ROW_CAP).map(slimLeadForChat);
      return JSON.stringify({
        vista: "gestion_leads",
        descripcion:
          "Leads visibles según filtros de la pestaña Gestión de Leads",
        totalFilasCoinciden: filteredLeads.length,
        filas,
      });
    }
    if (!hasData) {
      return JSON.stringify({
        vista: "dashboard",
        sinDatosVentas: true,
        nota:
          "No hay informe de ventas cargado en esta sesión. La pestaña Leads puede tener datos si se cargó un archivo ahí.",
      });
    }
    return JSON.stringify({
      vista: "dashboard_resumen",
      descripcion:
        "Resumen del dashboard de ventas y muestra de pedidos con timing de entrega",
      archivo: sourceLabel,
      kpis: {
        ventasRealesEUR: kpis.ventasReales,
        margenBrutoEUR: kpis.margenBruto,
        margenPromedioPct: kpis.margenPromedioPct,
        ratioEficiencia: kpis.ratioEficiencia,
        pedidosCount: kpis.pedidosCount,
        alertasCosteOT: kpis.alertasCount,
        retrasosEntrega: deliveryRiskKpis.late,
        riesgoPlazoMenos7d: deliveryRiskKpis.risk,
      },
      pedidosPorEstado,
      topClientesPorMargen: topClientesMargen.slice(0, 12),
      muestraPedidos: capRows(displayRows, 200).map(slimOrderForChat),
      alertasEntregaYtiming: capRows(tableRowsFiltered, 180).map(
        ({ row, timeStatus, critical }) => ({
          ...slimOrderForChat(row),
          estadoPlazoEntrega: timeStatus,
          alertaCosteOT: critical,
        })
      ),
    });
  }, [
    salesTab,
    hasData,
    filteredPedidos,
    filteredLeads,
    sourceLabel,
    kpis,
    deliveryRiskKpis,
    pedidosPorEstado,
    topClientesMargen,
    displayRows,
    tableRowsFiltered,
  ]);

  const submitDataChat = useCallback(async () => {
    const q = dataChatQuery.trim();
    if (!q) return;
    setDataChatLoading(true);
    setDataChatError(null);
    setDataChatReply(null);
    setDataChatPanelOpen(true);
    try {
      const tableData = buildChatTableData();
      const res = await fetch("/api/sales-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, tableData, model: globalModel }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.error) {
        setDataChatError(data.error);
        return;
      }
      if (typeof data.text === "string") {
        setDataChatReply(data.text);
      } else {
        setDataChatError("Respuesta inesperada del servidor.");
      }
    } catch (e) {
      setDataChatError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setDataChatLoading(false);
    }
  }, [dataChatQuery, buildChatTableData, globalModel]);

  const delayExportCount = deliveryRiskKpis.late + deliveryRiskKpis.risk;

  const exportDelayXlsx = () => {
    const blob = buildDelayReportXlsxBlob(displayRows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minerva-retrasos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isPro = dashboardMode === "PRO";

  const margenColor =
    kpis.margenPromedioPct >= 30
      ? "text-emerald-700"
      : kpis.margenPromedioPct < 20
        ? "text-red-600"
        : "text-[#002147]";

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void loadFromFile(f);
  };

  return (
    <div className="relative isolate min-h-dvh print:min-h-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden print:hidden"
      >
        <div className="sem-workspace-marble" />
        <div className="sem-workspace-overlay" />
      </div>

      <div className="relative z-10 print:bg-white">
        <header className="border-b border-slate-200/60 bg-white/75 backdrop-blur-md print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <h1 className="font-heading text-xl font-bold tracking-tight text-[#002147] sm:text-2xl">
                Minerva Sales Intelligence
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                {hasData && !isPro
                  ? "Análisis básico de volumen y estados (formato clásico)"
                  : "Rentabilidad real y alertas de coste · Oficina Técnica"}
              </p>
              <button
                type="button"
                onClick={() => void loadDemo()}
                disabled={loading}
                className="mt-1.5 text-left text-xs text-[#002147]/80 underline-offset-2 hover:underline disabled:opacity-50 print:hidden"
              >
                Cargar datos de ejemplo
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <GlobalModelSelector layout="row" className="shrink-0" />
              {hasData ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 print:hidden"
                  onClick={() => void handlePrint()}
                  disabled={loading}
                  title="Abre el cuadro de impresión del navegador; elige «Guardar como PDF»"
                >
                  <Printer className="size-3.5" aria-hidden />
                  Exportar PDF
                </Button>
              ) : null}
              {hasData && isPro ? (
                <NativeSelect
                  label="Vista de datos"
                  options={roleOptions}
                  value={roleView}
                  onChange={(e) =>
                    setRoleView(e.target.value as SalesRoleView)
                  }
                  className="border-[#002147]/20"
                  disabled={!hasData}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void reload()}
                disabled={loading || !canReload}
                title={
                  canReload
                    ? "Volver a leer el último archivo o ejemplo"
                    : "Sube un archivo primero"
                }
              >
                <RefreshCw
                  className={cn("size-3.5", loading && "animate-spin")}
                />
                Volver a cargar
              </Button>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Portal
              </Link>
              <Link
                href="/sem"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                SEM
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:px-3 print:py-4">
        {error ? (
          <Card className="border-red-200 bg-red-50/80 shadow-sm backdrop-blur-sm">
            <CardContent className="pt-6">
              <p className="whitespace-pre-line text-sm font-medium text-red-800">
                {error}
              </p>
              {canReload ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void reload()}
                  disabled={loading}
                >
                  Reintentar
                </Button>
              ) : (
                <p className="mt-2 text-xs text-red-900/80">
                  Prueba con otro CSV o Excel (.xlsx) con las columnas del informe
                  corporativo.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <div className="text-muted-foreground text-sm">
            {hasData ? "Actualizando datos…" : "Leyendo archivo…"}
          </div>
        ) : null}

        {!error ? (
          <>
            <Card className="print:hidden border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
              <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#002147]">
                    Centro de mando comercial
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Archivo activo:{" "}
                    <span className="font-medium text-slate-800" title={sourceLabel ?? ""}>
                      {sourceLabel ?? "—"}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 border-[#002147]/25"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Upload className="size-4" aria-hidden />
                  Subir otro Excel / CSV
                </Button>
              </CardContent>
            </Card>

            <Card className="print:hidden border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
              <CardContent className="flex flex-col gap-3 py-4 sm:py-5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#002147]">
                  <Sparkles className="size-3.5 shrink-0" aria-hidden />
                  Asistente de datos IA
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input
                    value={dataChatQuery}
                    onChange={(e) => setDataChatQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitDataChat();
                      }
                    }}
                    placeholder='✨ Pregúntale a Minerva sobre estos datos... (Ej: ¿Cuántos pedidos retrasados tiene el Comercial 2?)'
                    className="min-h-10 flex-1 border-[#002147]/20 bg-white text-sm"
                    disabled={dataChatLoading}
                    aria-label="Pregunta al asistente de datos"
                  />
                  <Button
                    type="button"
                    className="shrink-0 gap-2 bg-[#002147] hover:bg-[#002147]/90 sm:min-w-[7rem]"
                    onClick={() => void submitDataChat()}
                    disabled={dataChatLoading || !dataChatQuery.trim()}
                  >
                    {dataChatLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    Enviar
                  </Button>
                </div>
                {dataChatPanelOpen ? (
                  <Alert className="border-[#002147]/15 bg-white/95">
                    <div className="flex items-start justify-between gap-2">
                      <AlertTitle className="pr-6">Respuesta</AlertTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-1 -mt-1 shrink-0 text-slate-600"
                        onClick={() => setDataChatPanelOpen(false)}
                        aria-label="Cerrar respuesta"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    {dataChatLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 className="size-4 animate-spin text-[#002147]" />
                        Analizando los datos…
                      </div>
                    ) : dataChatError ? (
                      <AlertDescription className="text-red-800">
                        {dataChatError}
                      </AlertDescription>
                    ) : dataChatReply ? (
                      <AlertDescription>{dataChatReply}</AlertDescription>
                    ) : null}
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <Tabs
              value={salesTab}
              onValueChange={setSalesTab}
              className="w-full"
            >
              <TabsList
                variant="line"
                className="print:hidden mb-6 h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-slate-200/60 bg-slate-50/90 p-1 sm:w-fit"
              >
                <TabsTrigger value="dashboard" className="px-4 py-2 text-sm">
                  Dashboard Resumen
                </TabsTrigger>
                <TabsTrigger value="gestion" className="px-4 py-2 text-sm">
                  Gestión de Pedidos
                </TabsTrigger>
                <TabsTrigger value="leads" className="px-4 py-2 text-sm">
                  Gestión de Leads
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard" className="mt-0 outline-none">
          {hasData ? (
          <div ref={salesPrintRef} className="space-y-8 print:space-y-5">
            <div className="hidden border-b border-slate-200 pb-3 print:block">
              <h1 className="font-heading text-xl font-bold tracking-tight text-[#002147] print:text-2xl">
                Minerva Sales Intelligence
              </h1>
              <p className="text-sm text-slate-600">
                {isPro
                  ? "Rentabilidad real y alertas de coste · Oficina Técnica"
                  : "Análisis básico de volumen y estados · formato clásico"}
              </p>
              {sourceLabel ? (
                <p className="mt-1 text-xs text-slate-500">Origen: {sourceLabel}</p>
              ) : null}
            </div>
            <div
              data-sales-pdf-root
              className="space-y-8 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5 print:rounded-lg print:border print:border-slate-200 print:bg-white print:p-4 print:shadow-none"
            >
            {!isPro ? (
              <div className="print:hidden flex break-inside-avoid items-start gap-3 rounded-lg border border-blue-200/90 bg-gradient-to-r from-blue-50/95 to-amber-50/90 px-4 py-3 text-sm text-slate-800 shadow-sm">
                <Info
                  className="mt-0.5 size-5 shrink-0 text-[#002147]"
                  aria-hidden
                />
                <p className="leading-snug">
                  ℹ️ Estás viendo el análisis Básico. Utiliza el nuevo formato de
                  Excel de Ventas para desbloquear los datos de Rentabilidad y
                  Alertas de la Oficina Técnica.
                </p>
              </div>
            ) : null}

            {isPro && parseWarnings.length > 0 ? (
              <div className="flex break-inside-avoid items-start gap-2 rounded-lg border border-amber-300/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div>
                  <p className="font-medium text-amber-950">
                    Archivo cargado con diferencias respecto al formato corporativo
                  </p>
                  <ul className="mt-2 list-inside list-disc text-xs text-amber-900/90">
                    {parseWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {isPro && kpis.alertasCount > 0 ? (
              <div className="flex break-inside-avoid items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <span>
                  <strong>{kpis.alertasCount}</strong> pedido
                  {kpis.alertasCount === 1 ? "" : "s"} con{" "}
                  <strong>coste estimado &gt; 75%</strong> del valor real (revisión
                  Oficina Técnica).
                </span>
              </div>
            ) : null}

            <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start gap-3">
                  <Clock
                    className="mt-0.5 size-5 shrink-0 text-[#002147]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <CardTitle className="text-base text-[#002147]">
                      Riesgo de Entregas
                    </CardTitle>
                    <CardDescription>
                      Pedidos activos (excluye Entregado y Cancelado) · según
                      Fecha_Entrega
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-8 pb-6 pt-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-3xl font-bold tabular-nums text-red-600">
                    {deliveryRiskKpis.late}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    Retrasados
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-3xl font-bold tabular-nums text-orange-600">
                    {deliveryRiskKpis.risk}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    En riesgo (plazo {"<"} 7 días)
                  </span>
                </div>
              </CardContent>
            </Card>

            {isPro ? (
            <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:gap-3">
              <KpiCard
                title="Ventas reales"
                subtitle="Suma Valor_Real"
                value={fmtEuro(kpis.ventasReales)}
                icon={Euro}
              />
              <KpiCard
                title="Margen bruto"
                subtitle="Σ Margen €"
                value={fmtEuro(kpis.margenBruto)}
                icon={TrendingUp}
              />
              <KpiCard
                title="Margen medio"
                subtitle="Sobre ventas reales"
                value={fmtPct(kpis.margenPromedioPct)}
                icon={PieChartIcon}
                valueClassName={margenColor}
              />
              <KpiCard
                title="Ratio eficiencia"
                subtitle="Real / potencial"
                value={fmtPct(kpis.ratioEficiencia * 100)}
                icon={LineChartIcon}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2 print:gap-4">
              <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
                <CardHeader>
                  <CardTitle className="text-base text-[#002147]">
                    Top 10 clientes · margen bruto
                  </CardTitle>
                  <CardDescription>€ acumulados por cliente</CardDescription>
                </CardHeader>
                <CardContent className="h-80 min-h-[240px] pl-0 print:h-[260px] print:min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topClientesMargen}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        className="text-xs"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 11 }}
                        className="text-xs"
                      />
                      <Tooltip
                        formatter={(v) => [
                          fmtEuro(typeof v === "number" ? v : Number(v)),
                          "Margen",
                        ]}
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <Bar
                        dataKey="margen"
                        name="Margen €"
                        fill="#002147"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
                <CardHeader>
                  <CardTitle className="text-base text-[#002147]">
                    Ventas por sector
                  </CardTitle>
                  <CardDescription>
                    Distribución por Tipo_Cliente (Valor_Real)
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80 min-h-[240px] print:h-[260px] print:min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ventasPorSector}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {ventasPorSector.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) =>
                          fmtEuro(typeof v === "number" ? v : Number(v))
                        }
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            {isPro && roleView === "manager" ? (
              <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ScatterIcon className="size-5 text-[#002147]" />
                    <div>
                      <CardTitle className="text-base text-[#002147]">
                        Comerciales · calidad del margen
                      </CardTitle>
                      <CardDescription>
                        Eje X: ventas (€) · Eje Y: % margen medio (solo vista
                        Manager)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-96 min-h-[280px] print:h-[300px] print:min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                      <XAxis
                        type="number"
                        dataKey="ventas"
                        name="Ventas"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`}
                        className="text-xs"
                      />
                      <YAxis
                        type="number"
                        dataKey="margenPct"
                        name="% Margen"
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        className="text-xs"
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(v, name) => {
                          const n = typeof v === "number" ? v : Number(v);
                          return name === "ventas"
                            ? [fmtEuro(n), "Ventas"]
                            : [fmtPct(n), "% Margen"];
                        }}
                        labelFormatter={(_, p) => {
                          const pl = Array.isArray(p) ? p[0] : p;
                          const payload = pl?.payload as
                            | { comercial?: string }
                            | undefined;
                          return payload?.comercial ?? "";
                        }}
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <Scatter
                        name="Comerciales"
                        data={scatterComerciales}
                        fill="#002147"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
              <CardHeader>
                <CardTitle className="text-base text-[#002147]">
                  Evolución temporal
                </CardTitle>
                <CardDescription>
                  Ventas reales vs costes estimados (por mes de apertura)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 min-h-[240px] print:h-[260px] print:min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucionMensual} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v) =>
                        fmtEuro(typeof v === "number" ? v : Number(v))
                      }
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      name="Ventas reales"
                      stroke="#002147"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="costes"
                      name="Costes estimados"
                      stroke="#C69C2B"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </>
            ) : (
              <>
                <section className="grid gap-4 sm:grid-cols-3 print:gap-3">
                  <KpiCard
                    title="Total valor potencial"
                    subtitle="Σ Valor potencial"
                    value={fmtEuro(legacyKpis.totalValorPotencial)}
                    icon={Euro}
                  />
                  <KpiCard
                    title="Número de pedidos"
                    subtitle="Filas importadas"
                    value={legacyKpis.pedidosCount}
                    icon={PieChartIcon}
                  />
                  <KpiCard
                    title="Ticket medio potencial"
                    subtitle="Potencial ÷ pedidos"
                    value={fmtEuro(legacyKpis.ticketMedioPotencial)}
                    icon={TrendingUp}
                  />
                </section>

                <section className="grid gap-6 lg:grid-cols-2 print:gap-4">
                  <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-[#002147]">
                        Top clientes por volumen potencial
                      </CardTitle>
                      <CardDescription>
                        Suma de valor potencial por cliente
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 min-h-[240px] pl-0 print:h-[260px] print:min-h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topClientesPorPotencial}
                          layout="vertical"
                          margin={{ left: 8, right: 16 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                            className="text-xs"
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            tick={{ fontSize: 11 }}
                            className="text-xs"
                          />
                          <Tooltip
                            formatter={(v) => [
                              fmtEuro(typeof v === "number" ? v : Number(v)),
                              "Potencial",
                            ]}
                            contentStyle={{ borderRadius: 8 }}
                          />
                          <Bar
                            dataKey="potencial"
                            name="Potencial €"
                            fill="#1e4976"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-[#002147]">
                        Distribución por estado del pedido
                      </CardTitle>
                      <CardDescription>Número de pedidos por estado</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 min-h-[240px] print:h-[260px] print:min-h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pedidosPorEstado}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) =>
                              `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                            }
                          >
                            {pedidosPorEstado.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v) => [
                              `${typeof v === "number" ? v : Number(v)} pedidos`,
                              "Cantidad",
                            ]}
                            contentStyle={{ borderRadius: 8 }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </section>
              </>
            )}
            </div>

            <Card className="border-slate-200/80 bg-white/85 break-inside-avoid shadow-sm backdrop-blur-sm print:border-slate-300 print:bg-white print:shadow-none">
              <CardHeader>
                <CardTitle className="text-base text-[#002147]">
                  Tabla operativa
                </CardTitle>
                <CardDescription>
                  {isPro
                    ? "Estados FSC, Prueba color, PDF · Alertas OT en rojo · timing de entrega"
                    : "Resumen de pedidos (sin alertas de rentabilidad)"}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 print:hidden">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={
                      deliveryTableFilter === "all" ? "default" : "outline"
                    }
                    size="sm"
                    className={
                      deliveryTableFilter === "all"
                        ? "bg-[#002147] hover:bg-[#002147]/90"
                        : ""
                    }
                    onClick={() => setDeliveryTableFilter("all")}
                  >
                    Todos los pedidos
                  </Button>
                  <Button
                    type="button"
                    variant={
                      deliveryTableFilter === "alerts" ? "default" : "outline"
                    }
                    size="sm"
                    className={
                      deliveryTableFilter === "alerts"
                        ? "bg-[#002147] hover:bg-[#002147]/90"
                        : ""
                    }
                    onClick={() => setDeliveryTableFilter("alerts")}
                  >
                    Solo retrasados / en riesgo
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 border-amber-300/80 bg-amber-50 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                  disabled={delayExportCount === 0}
                  onClick={exportDelayXlsx}
                  title={
                    delayExportCount === 0
                      ? "No hay pedidos retrasados o en riesgo en tu vista"
                      : `Exportar ${delayExportCount} pedido(s) a Excel`
                  }
                >
                  <Download className="size-4 shrink-0" aria-hidden />
                  Exportar Informe de Retrasos (Excel)
                </Button>
              </div>
              <CardContent className="p-0 sm:p-0 print:overflow-visible [&>div]:print:overflow-visible [&_table]:print:text-[10px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Timing</TableHead>
                      {isPro ? (
                        <>
                          <TableHead className="text-right">Valor real</TableHead>
                          <TableHead className="text-right">Coste est.</TableHead>
                          <TableHead className="text-right">Margen %</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-right">
                            Valor potencial
                          </TableHead>
                          <TableHead className="text-right">Valor real</TableHead>
                        </>
                      )}
                      <TableHead>FSC</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>PDF</TableHead>
                      {isPro ? <TableHead>OT</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRowsFiltered.map(({ row, critical, timeStatus }) => (
                      <TableRow
                        key={row.idPedido}
                        data-state={critical ? "alert" : undefined}
                        className={cn(
                          "break-inside-avoid",
                          isPro &&
                            critical &&
                            "border-l-4 border-l-red-500 bg-red-50/60 hover:bg-red-50/80"
                        )}
                      >
                        <TableCell className="font-mono text-xs">
                          {row.pedidoCliente}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate">
                          {row.cliente}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {row.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TimingBadge status={timeStatus} />
                        </TableCell>
                        {isPro ? (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {fmtEuro(row.valorReal)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtEuro(row.costeEstimado)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtPct(row.margenPorcentaje)}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {fmtEuro(row.valorPotencial)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtEuro(row.valorReal)}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <SiBadge value={row.fsc} />
                        </TableCell>
                        <TableCell>
                          <SiBadge value={row.pruebaColor} />
                        </TableCell>
                        <TableCell>
                          <SiBadge value={row.pdfOk} />
                        </TableCell>
                        {isPro ? (
                          <TableCell>
                            {critical ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="size-3" />
                                Crítico
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          ) : (
            <Card className="border-slate-200/80 bg-white/90 shadow-sm">
              <CardContent className="py-10 text-center">
                <p className="mx-auto max-w-md text-sm text-slate-700">
                  Sube el informe mensual de ventas (CSV o Excel) con el botón inferior
                  o &quot;Cargar datos de ejemplo&quot; en la cabecera. El formato completo
                  desbloquea KPIs y alertas OT.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  También puedes abrir la pestaña <strong>Gestión de Leads</strong> para
                  trabajar con el pipeline comercial sin cargar ventas.
                </p>
              </CardContent>
            </Card>
          )}
              </TabsContent>
              <TabsContent value="gestion" className="mt-0 print:hidden outline-none">
                {hasData ? (
                  <SalesOrdersGestionPanel
                    rows={displayRows}
                    onFilteredRowsChange={onFilteredPedidosChange}
                  />
                ) : (
                  <Card className="border-slate-200/80 bg-white/90 shadow-sm">
                    <CardContent className="py-10 text-center text-sm text-slate-600">
                      Carga primero un informe de ventas para ver y filtrar pedidos.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              <TabsContent value="leads" className="mt-0 print:hidden outline-none">
                <LeadsManagementPanel
                  onFilteredLeadsChange={onFilteredLeadsChange}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        onChange={onFilePicked}
      />
      <div className="pointer-events-auto fixed bottom-4 right-4 z-30 flex max-w-[min(11rem,42vw)] flex-col items-end gap-1.5 print:hidden">
        <Button
          type="button"
          size="icon"
          className="size-11 shrink-0 rounded-full border-[#002147]/20 bg-[#002147] text-white shadow-lg hover:bg-[#002147]/90"
          onClick={() => fileInputRef.current?.click()}
          title="Subir informe mensual (CSV o Excel)"
        >
          <Upload className="size-5" aria-hidden />
          <span className="sr-only">Subir informe mensual</span>
        </Button>
        {sourceLabel ? (
          <p
            className="w-full truncate rounded-md border border-slate-200/80 bg-white/90 px-2 py-1 text-center text-[10px] leading-tight text-slate-600 shadow-sm backdrop-blur-sm"
            title={sourceLabel}
          >
            {sourceLabel}
          </p>
        ) : null}
      </div>
      </div>
    </div>
  );
}
