"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, KeyRound, ShieldCheck, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const VISIBILITY_DATA = [
  { month: "Sep", visibilidad: 42 },
  { month: "Oct", visibilidad: 48 },
  { month: "Nov", visibilidad: 55 },
  { month: "Dic", visibilidad: 61 },
  { month: "Ene", visibilidad: 68 },
  { month: "Feb", visibilidad: 74 },
];

const KEYWORD_ROWS = [
  {
    keyword: "packaging farmacéutico",
    position: 2,
    trend: 1 as const,
    volume: 1200,
  },
  {
    keyword: "cajas rígidas cosmética",
    position: 5,
    trend: -2 as const,
    volume: 850,
  },
  {
    keyword: "estuches fsc personalizados",
    position: 1,
    trend: 0 as const,
    volume: 450,
  },
];

function TrendCell({ trend }: { trend: number }) {
  if (trend > 0) {
    return (
      <div className="flex items-center justify-end gap-1 text-emerald-600">
        <TrendingUp className="size-4" aria-hidden />
        <span className="tabular-nums font-medium">+{trend}</span>
      </div>
    );
  }
  if (trend < 0) {
    return (
      <div className="flex items-center justify-end gap-1 text-red-600">
        <TrendingDown className="size-4" aria-hidden />
        <span className="tabular-nums font-medium">{trend}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1 text-slate-500">
      <Minus className="size-4" aria-hidden />
      <span>=</span>
    </div>
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
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          {subtitle ? (
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          ) : null}
        </div>
        <Icon className="text-muted-foreground size-4 text-[#002147]/70" />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "font-heading text-2xl font-semibold tabular-nums text-[#002147]",
            valueClassName
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export function RankingMonitor() {
  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        Vista simulada de indicadores para{" "}
        <span className="font-medium text-[#002147]">www.minervaglobal.es</span>{" "}
        (datos de demostración).
      </p>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Tráfico orgánico estimado"
          subtitle="Sesiones / mes (modelo)"
          value="12,4k"
          icon={Activity}
        />
        <KpiCard
          title="Posición media"
          subtitle="Top palabras monitorizadas"
          value="4,2"
          icon={BarChart3}
        />
        <KpiCard
          title="Palabras clave en Top 3"
          subtitle="Cohorte estratégica"
          value="18"
          icon={KeyRound}
          valueClassName="text-emerald-700"
        />
        <KpiCard
          title="Salud del sitio"
          subtitle="Auditoría técnica (demo)"
          value="86/100"
          icon={ShieldCheck}
        />
      </section>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Evolución de visibilidad (últimos 6 meses)
          </CardTitle>
          <CardDescription>
            Índice compuesto simulado (0–100) · tendencia alcista
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[280px] min-w-0 pl-0 sm:pl-2">
          <div className="h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={VISIBILITY_DATA}
              margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[35, 80]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                formatter={(v) => [`${v}`, "Visibilidad"]}
                contentStyle={{ borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="visibilidad"
                name="Visibilidad"
                stroke="#002147"
                strokeWidth={2}
                dot={{ r: 4, fill: "#C69C2B", stroke: "#002147", strokeWidth: 1 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Palabras clave estratégicas
          </CardTitle>
          <CardDescription>
            Sector packaging pharma / cosmética (datos demo)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Keyword</TableHead>
                <TableHead className="text-right">Posición</TableHead>
                <TableHead className="text-right">Tendencia</TableHead>
                <TableHead className="text-right">Volumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {KEYWORD_ROWS.map((row) => (
                <TableRow key={row.keyword}>
                  <TableCell className="font-medium text-slate-800">
                    {row.keyword}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge variant="outline" className="font-mono tabular-nums">
                      {row.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TrendCell trend={row.trend} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-600">
                    {row.volume.toLocaleString("es-ES")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
