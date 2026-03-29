"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Euro,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  RefreshCw,
  ScatterChart as ScatterIcon,
  TrendingUp,
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

import { useSalesData } from "@/hooks/use-sales-data";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  SALES_ROLE_LABELS,
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
    <Card className="border-slate-200/80 shadow-sm">
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

export function SalesIntelligenceDashboard() {
  const {
    roleView,
    setRoleView,
    loading,
    error,
    reload,
    kpis,
    topClientesMargen,
    ventasPorSector,
    scatterComerciales,
    evolucionMensual,
    rowsWithAlerts,
  } = useSalesData();

  const margenColor =
    kpis.margenPromedioPct >= 30
      ? "text-emerald-700"
      : kpis.margenPromedioPct < 20
        ? "text-red-600"
        : "text-[#002147]";

  return (
    <div className="min-h-dvh bg-slate-50/80">
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-[#002147] sm:text-2xl">
              Minerva Sales Intelligence
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Rentabilidad real y alertas de coste · Oficina Técnica
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect
              label="Vista de datos"
              options={roleOptions}
              value={roleView}
              onChange={(e) => setRoleView(e.target.value as SalesRoleView)}
              className="border-[#002147]/20"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void reload()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("size-3.5", loading && "animate-spin")}
              />
              Actualizar
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

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-red-800">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void reload()}
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {loading && !error ? (
          <div className="text-muted-foreground text-sm">Cargando dataset…</div>
        ) : null}

        {!loading && !error ? (
          <>
            {kpis.alertasCount > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <span>
                  <strong>{kpis.alertasCount}</strong> pedido
                  {kpis.alertasCount === 1 ? "" : "s"} con{" "}
                  <strong>coste estimado &gt; 75%</strong> del valor real (revisión
                  Oficina Técnica).
                </span>
              </div>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

            <section className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-[#002147]">
                    Top 10 clientes · margen bruto
                  </CardTitle>
                  <CardDescription>€ acumulados por cliente</CardDescription>
                </CardHeader>
                <CardContent className="h-80 pl-0">
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

              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-[#002147]">
                    Ventas por sector
                  </CardTitle>
                  <CardDescription>
                    Distribución por Tipo_Cliente (Valor_Real)
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
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

            {roleView === "manager" ? (
              <Card className="border-slate-200/80 shadow-sm">
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
                <CardContent className="h-96">
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

            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-[#002147]">
                  Evolución temporal
                </CardTitle>
                <CardDescription>
                  Ventas reales vs costes estimados (por mes de apertura)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
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

            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-[#002147]">
                  Tabla operativa
                </CardTitle>
                <CardDescription>
                  Estados FSC, Prueba color, PDF · Alertas OT en rojo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Valor real</TableHead>
                      <TableHead className="text-right">Coste est.</TableHead>
                      <TableHead className="text-right">Margen %</TableHead>
                      <TableHead>FSC</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>PDF</TableHead>
                      <TableHead>OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsWithAlerts.map(({ row, critical }) => (
                      <TableRow
                        key={row.idPedido}
                        data-state={critical ? "alert" : undefined}
                        className={cn(
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
                        <TableCell className="text-right tabular-nums">
                          {fmtEuro(row.valorReal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtEuro(row.costeEstimado)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtPct(row.margenPorcentaje)}
                        </TableCell>
                        <TableCell>
                          <SiBadge value={row.fsc} />
                        </TableCell>
                        <TableCell>
                          <SiBadge value={row.pruebaColor} />
                        </TableCell>
                        <TableCell>
                          <SiBadge value={row.pdfOk} />
                        </TableCell>
                        <TableCell>
                          {critical ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="size-3" />
                              Crítico
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
