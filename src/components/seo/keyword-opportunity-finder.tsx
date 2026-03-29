"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

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

function intentBadgeVariant(intent: string): {
  variant: "default" | "secondary" | "success" | "warning" | "outline";
  className?: string;
} {
  const n = intent.trim().toLowerCase();
  if (n.includes("informat")) {
    return {
      variant: "default",
      className:
        "border-blue-200 bg-blue-500/15 text-blue-950 dark:text-blue-100",
    };
  }
  if (n.includes("comercial")) {
    return { variant: "success" };
  }
  if (n.includes("transacc")) {
    return {
      variant: "warning",
      className:
        "border-violet-300 bg-violet-500/15 text-violet-950 dark:text-violet-100",
    };
  }
  return { variant: "outline" };
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

export function KeywordOpportunityFinder() {
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<KeywordIdeaRow[]>([]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    const q = seed.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const res = await fetch("/api/seo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: q }),
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
          <form onSubmit={onGenerate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="seo-seed">
                Introduce un producto o servicio
              </Label>
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

      {items.length > 0 ? (
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Ideas de contenido orgánico
            </CardTitle>
            <CardDescription>
              Cinco palabras long-tail sugeridas para tu estrategia
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="min-w-[200px]">
                    Palabra clave long-tail
                  </TableHead>
                  <TableHead>Intención de búsqueda</TableHead>
                  <TableHead>Dificultad estimada</TableHead>
                  <TableHead className="min-w-[220px]">
                    Idea de artículo / página
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, i) => {
                  const ib = intentBadgeVariant(row.intent);
                  const db = difficultyBadgeProps(row.difficulty);
                  return (
                    <TableRow key={`${row.keyword}-${i}`}>
                      <TableCell className="align-top font-medium text-slate-800">
                        {row.keyword}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant={ib.variant}
                          className={cn("font-normal", ib.className)}
                        >
                          {row.intent}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={db.variant} className="font-normal">
                          {row.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-sm leading-snug text-slate-700">
                        {row.titleIdea}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
