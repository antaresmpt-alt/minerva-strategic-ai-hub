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
import { cn } from "@/lib/utils";

export type KeywordIdeaRow = {
  keyword: string;
  intent: string;
  difficulty: string;
  titleIdea: string;
};

type IntentFilterValue =
  | "all"
  | "informational"
  | "commercial"
  | "transactional";

type DifficultyFilterValue = "any" | "low_only";

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

function difficultyBadgeProps(difficulty: string): {
  variant: "secondary" | "success" | "warning" | "destructive" | "outline";
} {
  const n = difficulty.trim().toLowerCase();
  if (n.startsWith("baj")) return { variant: "success" };
  if (n.startsWith("medi")) return { variant: "warning" };
  if (n.startsWith("alt")) return { variant: "destructive" };
  return { variant: "outline" };
}

function escapeCsvCell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadKeywordIdeasCsv(items: KeywordIdeaRow[]) {
  const headers = [
    "Palabra clave long-tail",
    "Intención",
    "Dificultad estimada",
    "Idea de artículo / página",
  ];
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...items.map((r) =>
      [r.keyword, r.intent, r.difficulty, r.titleIdea]
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

const INTENT_OPTIONS = [
  { value: "all", label: "Todas" },
  {
    value: "informational",
    label: "Informativa (Blog/Educación)",
  },
  {
    value: "commercial",
    label: "Comercial (Comparativas/Reseñas)",
  },
  {
    value: "transactional",
    label: "Transaccional (Compra/Presupuesto)",
  },
] as const;

const COUNT_OPTIONS = [
  { value: "5", label: "5 resultados" },
  { value: "10", label: "10 resultados" },
  { value: "15", label: "15 resultados" },
  { value: "20", label: "20 resultados" },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: "any", label: "Cualquiera" },
  {
    value: "low_only",
    label: "Solo Baja Dificultad (Quick Wins)",
  },
] as const;

function ResultsTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 p-4 sm:p-6">
      <div className="hidden sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,1.1fr)] sm:gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,1.1fr)] sm:border-0 sm:p-0"
        >
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

export function KeywordOpportunityFinder() {
  const [seed, setSeed] = useState("");
  const [intentFilter, setIntentFilter] =
    useState<IntentFilterValue>("all");
  const [count, setCount] = useState<string>("10");
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilterValue>("any");
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
          difficultyFilter,
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
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
              <Button
                type="submit"
                disabled={loading || !seed.trim()}
                className="shrink-0 gap-2 bg-[#002147] hover:bg-[#002147]/90"
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

            <div className="grid gap-4 md:grid-cols-3">
              <NativeSelect
                label="Intención de búsqueda"
                value={intentFilter}
                onChange={(e) =>
                  setIntentFilter(e.target.value as IntentFilterValue)
                }
                disabled={loading}
                options={[...INTENT_OPTIONS]}
              />
              <NativeSelect
                label="Cantidad de resultados"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={loading}
                options={[...COUNT_OPTIONS]}
              />
              <NativeSelect
                label="Dificultad SEO"
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(e.target.value as DifficultyFilterValue)
                }
                disabled={loading}
                options={[...DIFFICULTY_OPTIONS]}
              />
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
            <CardDescription>
              Generando sugerencias…
            </CardDescription>
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
              Exportar CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="min-w-[180px] whitespace-nowrap">
                      Palabra clave long-tail
                    </TableHead>
                    <TableHead className="min-w-[140px] whitespace-nowrap">
                      Intención de búsqueda
                    </TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap">
                      Dificultad estimada
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      Idea de artículo / página
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row, i) => {
                    const db = difficultyBadgeProps(row.difficulty);
                    return (
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
                        <TableCell className="align-top">
                          <Badge variant={db.variant} className="font-normal">
                            {row.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[min(100vw-2rem,28rem)] align-top text-sm leading-snug text-slate-700 sm:max-w-md">
                          {row.titleIdea}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
