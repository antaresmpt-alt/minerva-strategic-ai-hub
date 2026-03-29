"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  KeyRound,
  Loader2,
  Radar,
  TrendingDown,
  TrendingUp,
  Minus,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type PageSpeedScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

export type PageSpeedOpportunity = {
  title: string;
  description: string;
  savingsMs: number;
};

/** Quita enlaces Markdown [texto](url) y un poco de ruido típico de Lighthouse. */
function stripAuditDescription(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function extractPerformanceOpportunities(data: unknown): PageSpeedOpportunity[] {
  const audits = (
    data as {
      lighthouseResult?: { audits?: Record<string, unknown> };
    }
  ).lighthouseResult?.audits;
  if (!audits || typeof audits !== "object") return [];

  const allAudits = Object.values(audits) as Array<{
    title?: string;
    description?: string;
    score?: number | null;
    details?: {
      type?: string;
      overallSavingsMs?: number;
    };
  }>;

  const opps = allAudits.filter((a) => {
    const d = a?.details;
    const savings = d?.overallSavingsMs ?? 0;
    return (
      d?.type === "opportunity" &&
      a?.score !== 1 &&
      savings > 0
    );
  });

  opps.sort((a, b) => {
    const sa = a?.details?.overallSavingsMs ?? 0;
    const sb = b?.details?.overallSavingsMs ?? 0;
    return sb - sa;
  });

  return opps.slice(0, 3).map((a) => ({
    title: String(a?.title ?? "Sin título"),
    description: stripAuditDescription(String(a?.description ?? "")),
    savingsMs: Math.max(0, Math.round(a?.details?.overallSavingsMs ?? 0)),
  }));
}

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
  value: ReactNode;
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

function scoreColorClasses(percent: number): {
  stroke: string;
  text: string;
} {
  if (percent < 50) {
    return { stroke: "stroke-red-500", text: "text-red-500" };
  }
  if (percent < 90) {
    return { stroke: "stroke-amber-500", text: "text-amber-500" };
  }
  return { stroke: "stroke-emerald-500", text: "text-emerald-500" };
}

function CircularScore({
  title,
  scorePercent,
}: {
  title: string;
  scorePercent: number;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(scorePercent)));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const { stroke, text } = scoreColorClasses(pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-[104px]">
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            className="stroke-slate-200"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            className={cn(stroke, "transition-[stroke-dashoffset] duration-500")}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-heading text-xl font-semibold tabular-nums",
              text
            )}
          >
            {pct}
          </span>
        </div>
      </div>
      <span className="max-w-[7.5rem] text-center text-xs font-medium leading-tight text-slate-600">
        {title}
      </span>
    </div>
  );
}

function parseLighthouseScores(data: unknown): PageSpeedScores | null {
  const root = data as {
    lighthouseResult?: {
      categories?: Record<string, { score: number | null } | undefined>;
    };
  };
  const cats = root.lighthouseResult?.categories;
  if (!cats) return null;

  const pct = (key: string) => {
    const s = cats[key]?.score;
    if (typeof s !== "number" || Number.isNaN(s)) return 0;
    return Math.round(s * 100);
  };

  return {
    performance: pct("performance"),
    accessibility: pct("accessibility"),
    bestPractices: pct("best-practices"),
    seo: pct("seo"),
  };
}

function savingsBadgeClassName(savingsMs: number): string {
  if (savingsMs >= 2000) {
    return "border-0 bg-red-100 text-red-800 hover:bg-red-100";
  }
  return "border-0 bg-amber-100 text-amber-800 hover:bg-amber-100";
}

export function RankingMonitor() {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<PageSpeedScores | null>(null);
  const [opportunities, setOpportunities] = useState<PageSpeedOpportunity[]>(
    []
  );

  useEffect(() => {
    setScores(null);
    setError(null);
    setOpportunities([]);
  }, [device]);

  const runPageSpeedAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScores(null);
    setOpportunities([]);
    try {
      const res = await fetch(
        `/api/pagespeed?strategy=${encodeURIComponent(device)}`,
        { method: "GET", cache: "no-store" }
      );
      const data = (await res.json()) as {
        error?: string;
        detail?: string;
        lighthouseResult?: unknown;
      };
      if (!res.ok) {
        throw new Error(
          data.error ??
            data.detail ??
            `Error ${res.status}`
        );
      }
      const parsed = parseLighthouseScores(data);
      if (!parsed) {
        throw new Error(
          "No se pudieron leer las puntuaciones (lighthouseResult.categories)."
        );
      }
      setScores(parsed);
      setOpportunities(extractPerformanceOpportunities(data));
    } catch (e) {
      setScores(null);
      setOpportunities([]);
      setError(
        e instanceof Error ? e.message : "No se pudo completar la auditoría."
      );
    } finally {
      setLoading(false);
    }
  }, [device]);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        Vista simulada de indicadores para{" "}
        <span className="font-medium text-[#002147]">www.minervaglobal.es</span>{" "}
        (datos de demostración salvo auditoría PageSpeed).
      </p>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      </section>

      <Card className="border-2 border-[#002147]/15 bg-gradient-to-br from-white to-slate-50/90 shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg text-[#002147]">
            Auditoría técnica · Google PageSpeed
          </CardTitle>
          <CardDescription>
            Puntuaciones Lighthouse (rendimiento, accesibilidad, buenas prácticas
            y SEO) para{" "}
            <span className="font-medium text-slate-700">
              minervaglobal.es
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Dispositivo
              </span>
              <div
                className={cn(
                  "inline-flex rounded-full border border-[#002147]/20 bg-white p-1 shadow-sm",
                  loading && "pointer-events-none opacity-60"
                )}
                role="group"
                aria-label="Estrategia de análisis"
              >
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setDevice("mobile")}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    device === "mobile"
                      ? "bg-[#002147] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Móvil
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setDevice("desktop")}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    device === "desktop"
                      ? "bg-[#002147] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Ordenador
                </button>
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              disabled={loading}
              onClick={() => void runPageSpeedAudit()}
              className="gap-2 bg-[#002147] hover:bg-[#002147]/90"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Radar className="size-5" aria-hidden />
              )}
              Analizar minervaglobal.es
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            El análisis en tiempo real puede tardar entre 10 y 15 segundos.
          </p>

          {error ? (
            <div
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/80 py-12">
              <Loader2
                className="size-10 animate-spin text-[#002147]"
                aria-hidden
              />
              <p className="text-sm font-medium text-[#002147]">
                Consultando Google PageSpeed Insights…
              </p>
              <p className="text-muted-foreground max-w-sm text-center text-xs">
                Generando informe Lighthouse. Esto puede tardar un poco.
              </p>
            </div>
          ) : null}

          {!loading && scores ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <CircularScore
                  title="Rendimiento (Performance)"
                  scorePercent={scores.performance}
                />
                <CircularScore
                  title="Accesibilidad"
                  scorePercent={scores.accessibility}
                />
                <CircularScore
                  title="Mejores prácticas"
                  scorePercent={scores.bestPractices}
                />
                <CircularScore title="SEO" scorePercent={scores.seo} />
              </div>

              {opportunities.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Wrench
                      className="size-5 shrink-0 text-[#C69C2B]"
                      aria-hidden
                    />
                    <h3 className="font-heading text-base font-semibold text-[#002147]">
                      Oportunidades de Mejora (Rendimiento)
                    </h3>
                  </div>
                  <ul className="grid gap-3">
                    {opportunities.map((opp, idx) => (
                      <li key={`${opp.title}-${idx}`}>
                        <Card className="border-slate-200/90 bg-white/95 shadow-sm">
                          <CardHeader className="space-y-2 pb-2 pt-4">
                            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                              <CardTitle className="text-sm font-semibold leading-snug text-[#002147]">
                                {opp.title}
                              </CardTitle>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "shrink-0 font-medium tabular-nums",
                                  savingsBadgeClassName(opp.savingsMs)
                                )}
                              >
                                Ahorro est.:{" "}
                                {(opp.savingsMs / 1000).toFixed(1)}s
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-4 pt-0">
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {opp.description || "—"}
                            </p>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && !scores && !error ? (
            <p className="text-muted-foreground text-center text-sm">
              Pulsa &quot;Analizar minervaglobal.es&quot; para ver las
              puntuaciones.
            </p>
          ) : null}
        </CardContent>
      </Card>

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
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200"
                />
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
                  dot={{
                    r: 4,
                    fill: "#C69C2B",
                    stroke: "#002147",
                    strokeWidth: 1,
                  }}
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
