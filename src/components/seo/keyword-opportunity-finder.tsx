"use client";

import { useState, type FormEvent } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHubStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export type KeywordIdeaRow = {
  keyword: string;
  intent: string;
  titleIdea: string;
  monthlyVolume: number;
  difficultyPercent: number;
};

type IntentFilterValue =
  | "all"
  | "informational"
  | "commercial"
  | "transactional";

const volumeFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
});

function formatMonthlyVolume(n: number): string {
  return volumeFormatter.format(Math.max(0, Math.round(n)));
}

function intentBadgeClassName(intent: string): string {
  const n = intent.trim().toLowerCase();
  if (n.includes("informat")) {
    return "border-0 bg-blue-100 text-blue-800 hover:bg-blue-100";
  }
  if (n.includes("comercial")) {
    return "border-0 bg-amber-100 text-amber-800 hover:bg-amber-100";
  }
  if (n.includes("transacc")) {
    return "border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  }
  return "border-0 bg-slate-100 text-slate-800 hover:bg-slate-100";
}

function difficultyProgressClassName(p: number): string {
  const v = Math.min(100, Math.max(0, Math.round(p)));
  if (v < 40) {
    return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
  }
  if (v < 70) {
    return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  }
  return "[&_[data-slot=progress-indicator]]:bg-red-500";
}

function escapeCsvCell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadKeywordIdeasCsv(items: KeywordIdeaRow[]) {
  const headers = [
    "Palabra clave long-tail",
    "Intención",
    "Volumen mensual (estimado)",
    "Dificultad SEO (%)",
    "Idea de artículo / página",
  ];
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...items.map((r) =>
      [
        r.keyword,
        r.intent,
        String(r.monthlyVolume),
        String(r.difficultyPercent),
        r.titleIdea,
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];
  const bom = "\uFEFF";
  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `keywords-minerva-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const INTENT_OPTIONS: { value: IntentFilterValue; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "informational", label: "Informativa" },
  { value: "commercial", label: "Comercial" },
  { value: "transactional", label: "Transaccional" },
];

const COUNT_OPTIONS = [
  { value: "5", label: "5 resultados" },
  { value: "10", label: "10 resultados" },
  { value: "20", label: "20 resultados" },
] as const;

function SeoDifficultyCell({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="flex min-w-[140px] max-w-[200px] flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">SEO</span>
        <span className="text-xs font-medium tabular-nums text-slate-800">
          {v}%
        </span>
      </div>
      <Progress
        value={v}
        className={cn(
          "[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-slate-200/80",
          difficultyProgressClassName(v)
        )}
      >
        <span className="sr-only">Dificultad SEO {v} por ciento</span>
      </Progress>
    </div>
  );
}

function ResultsTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 p-4 sm:p-6">
      <div className="hidden md:grid md:grid-cols-[minmax(6rem,1.1fr)_5.5rem_4.5rem_7rem_minmax(6rem,1fr)] md:gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[minmax(6rem,1.1fr)_5.5rem_4.5rem_7rem_minmax(6rem,1fr)] md:border-0 md:p-0"
        >
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-8 w-full max-w-[180px]" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function KeywordOpportunityFinder() {
  const globalModel = useHubStore((s) => s.globalModel);
  const [seed, setSeed] = useState("");
  const [intentFilter, setIntentFilter] =
    useState<IntentFilterValue>("all");
  const [count, setCount] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<KeywordIdeaRow[]>([]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    const q = seed.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setItems([]);
    const countNum = Number.parseInt(count, 10);
    try {
      const res = await fetch("/api/seo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: q,
          intentFilter,
          count: countNum,
          model: globalModel,
        }),
      });
      const data = (await res.json()) as {
        items?: KeywordIdeaRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      if (!data.items?.length) {
        throw new Error("Respuesta vacía");
      }
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const countNum = Number.parseInt(count, 10) || 10;

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        Introduce un producto o servicio; la IA propondrá ideas long-tail alineadas
        con packaging B2B y Minerva Global.
      </p>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#C69C2B]" aria-hidden />
            <CardTitle className="text-base text-[#002147]">
              Buscador de oportunidades (keywords)
            </CardTitle>
          </div>
          <CardDescription>
            Generación asistida con Gemini · resultados orientativos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seo-seed">Palabra clave semilla</Label>
              <Input
                id="seo-seed"
                placeholder="ej. cajas para cosmética"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                disabled={loading}
                className="border-[#002147]/20"
              />
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seo-intent">Intención</Label>
                  <Select
                    value={intentFilter}
                    onValueChange={(v) =>
                      setIntentFilter(v as IntentFilterValue)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger
                      id="seo-intent"
                      className="h-9 w-full min-w-0 border-[#002147]/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo-count">Cantidad</Label>
                  <Select
                    value={count}
                    onValueChange={(v) => {
                      if (v) setCount(v);
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger
                      id="seo-count"
                      className="h-9 w-full min-w-0 border-[#002147]/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !seed.trim()}
                className="h-9 shrink-0 gap-2 self-stretch bg-[#002147] hover:bg-[#002147]/90 lg:self-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Generando…
                  </>
                ) : (
                  "Generar Estrategia SEO"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Ideas de contenido orgánico
            </CardTitle>
            <CardDescription>Generando sugerencias…</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <ResultsTableSkeleton rows={Math.min(countNum, 6)} />
          </CardContent>
        </Card>
      ) : null}

      {!loading && items.length > 0 ? (
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base text-[#002147]">
                Ideas de contenido orgánico
              </CardTitle>
              <CardDescription>
                {items.length} palabra{items.length === 1 ? "" : "s"} long-tail
                sugerida{items.length === 1 ? "" : "s"} para tu estrategia
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 border-[#002147]/25"
              onClick={() => downloadKeywordIdeasCsv(items)}
            >
              <Download className="size-4" aria-hidden />
              Descargar CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="min-w-[160px] whitespace-nowrap">
                      Palabra clave long-tail
                    </TableHead>
                    <TableHead className="min-w-[100px] whitespace-nowrap">
                      Intención
                    </TableHead>
                    <TableHead className="min-w-[110px] whitespace-nowrap text-right">
                      Volumen / mes
                    </TableHead>
                    <TableHead className="min-w-[160px] whitespace-nowrap">
                      Dificultad
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      Idea de artículo / página
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row, i) => (
                    <TableRow key={`${row.keyword}-${i}`}>
                      <TableCell className="align-top font-medium text-slate-800">
                        {row.keyword}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            intentBadgeClassName(row.intent)
                          )}
                        >
                          {row.intent}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-right font-medium tabular-nums text-slate-800">
                        {formatMonthlyVolume(row.monthlyVolume)}
                      </TableCell>
                      <TableCell className="align-top">
                        <SeoDifficultyCell value={row.difficultyPercent} />
                      </TableCell>
                      <TableCell className="max-w-[min(100vw-2rem,28rem)] align-top text-sm leading-snug text-slate-700 sm:max-w-md">
                        {row.titleIdea}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
