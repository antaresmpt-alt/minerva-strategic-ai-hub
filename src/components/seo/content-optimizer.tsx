"use client";

import { useMemo, useState } from "react";
import { BookOpen, Gauge, Hash, Timer } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyzeSeoContent } from "@/lib/seo-content-analysis";
import { cn } from "@/lib/utils";

function ScoreBar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums text-slate-800">
          {value.toFixed(0)} / {max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ContentOptimizer() {
  const [content, setContent] = useState("");
  const [keyword, setKeyword] = useState("");

  const analysis = useMemo(
    () => analyzeSeoContent(content, keyword),
    [content, keyword]
  );

  const densityLabel =
    analysis.densityStatus === "good"
      ? "Óptimo (1–3 %)"
      : analysis.densityStatus === "high"
        ? "Alto · riesgo keyword stuffing"
        : analysis.densityStatus === "low"
          ? "Bajo · refuerza la clave"
          : "Sin clave objetivo";

  const densityBarColor =
    analysis.densityStatus === "good"
      ? "bg-emerald-600"
      : analysis.densityStatus === "high"
        ? "bg-red-600"
        : analysis.densityStatus === "low"
          ? "bg-amber-500"
          : "bg-slate-300";

  const densityProgress =
    analysis.densityStatus === "none"
      ? 0
      : Math.min(100, (analysis.densityPercent / 5) * 100);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        Pega un borrador de contenido y define la palabra clave objetivo. El
        análisis se actualiza al escribir.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/90 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Contenido a analizar
            </CardTitle>
            <CardDescription>
              Texto largo recomendado (≥300 palabras para piezas SEO).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seo-keyword">Palabra clave objetivo</Label>
              <Input
                id="seo-keyword"
                placeholder="ej. packaging farmacéutico sostenible"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="border-[#002147]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-content">Contenido</Label>
              <Textarea
                id="seo-content"
                placeholder="Pega aquí el texto de tu landing, artículo o ficha de producto…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="min-h-[280px] resize-y border-[#002147]/20 text-sm leading-relaxed"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="size-5 text-[#002147]" aria-hidden />
              <CardTitle className="text-base text-[#002147]">
                Métricas rápidas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ScoreBar
              label="Progreso hacia 300 palabras (mínimo orientativo)"
              value={Math.min(analysis.wordCount, 300)}
              max={300}
              colorClass={
                analysis.meetsMinimumWords ? "bg-emerald-600" : "bg-[#002147]"
              }
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Hash className="size-4" aria-hidden />
                  Densidad de la clave
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    analysis.densityStatus === "good" && "text-emerald-700",
                    analysis.densityStatus === "high" && "text-red-600",
                    analysis.densityStatus === "low" && "text-amber-700",
                    analysis.densityStatus === "none" && "text-slate-500"
                  )}
                >
                  {keyword.trim()
                    ? `${analysis.densityPercent.toFixed(2)} %`
                    : "—"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full transition-all", densityBarColor)}
                  style={{
                    width: `${analysis.densityStatus === "none" ? 0 : densityProgress}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">{densityLabel}</p>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <BookOpen className="size-4" aria-hidden />
                Palabras
              </span>
              <span
                className={cn(
                  "font-heading text-xl font-semibold tabular-nums",
                  analysis.meetsMinimumWords
                    ? "text-emerald-700"
                    : "text-amber-700"
                )}
              >
                {analysis.wordCount}
                {!analysis.meetsMinimumWords && analysis.wordCount > 0 ? (
                  <span className="ml-2 text-xs font-normal text-amber-700">
                    (recomendado ≥300)
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <Timer className="size-4" aria-hidden />
                Lectura estimada
              </span>
              <span className="font-medium tabular-nums text-[#002147]">
                {analysis.readingMinutes} min
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Resumen SEO
            </CardTitle>
            <CardDescription>
              Referencia: densidad objetivo ~1–3 %; evita saturar (&gt;3 %).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              <strong className="text-[#002147]">Apariciones de la clave:</strong>{" "}
              {keyword.trim() ? analysis.keywordOccurrences : "—"}
            </p>
            <p>
              <strong className="text-[#002147]">Legibilidad:</strong> lectura
              aproximada de{" "}
              <span className="font-medium">{analysis.readingMinutes} min</span>{" "}
              (~200 palabras/min).
            </p>
            {!analysis.meetsMinimumWords && analysis.wordCount > 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-amber-950">
                El texto es corto para una pieza SEO competitiva; amplía secciones
                con valor (beneficios, casos de uso, especificaciones).
              </p>
            ) : null}
            {analysis.densityStatus === "high" ? (
              <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-red-950">
                Densidad alta: reduce repeticiones y usa sinónimos y variantes
                naturales.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
