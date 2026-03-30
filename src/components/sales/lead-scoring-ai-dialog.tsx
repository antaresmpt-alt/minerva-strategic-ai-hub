"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Loader2, Target, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { leadRowToScoringPayload } from "@/lib/lead-email-payload";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types/leads";

type Props = {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function scoreColorClass(score: number): string {
  if (score < 30) return "text-red-600";
  if (score <= 70) return "text-orange-600";
  return "text-emerald-600";
}

export function LeadScoringAiDialog({ lead, open, onOpenChange }: Props) {
  const titleId = useId();
  const descId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setScore(null);
    setAdvice(null);
  }, []);

  const payloadKey = useMemo(
    () => (lead ? JSON.stringify(leadRowToScoringPayload(lead)) : ""),
    [lead]
  );

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || !lead || !payloadKey) return;

    const leadRow = lead;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setScore(null);
      setAdvice(null);
      try {
        const res = await fetch("/api/lead-scoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadData: leadRowToScoringPayload(leadRow),
          }),
        });
        const data = (await res.json()) as {
          score?: number;
          advice?: string;
          error?: string;
        };
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        if (
          typeof data.score === "number" &&
          typeof data.advice === "string"
        ) {
          setScore(data.score);
          setAdvice(data.advice);
        } else {
          setError("Respuesta inesperada del servidor.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error de red");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, lead, payloadKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#002147]/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Cerrar"
        onClick={() => onOpenChange(false)}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 flex max-h-[min(90vh,520px)] w-full max-w-md flex-col border-slate-200/90 bg-white shadow-xl"
      >
        <CardHeader className="shrink-0 space-y-1 border-b border-slate-200/80 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#002147]/10 text-[#002147]">
                <Target className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle
                  id={titleId}
                  className="text-lg font-semibold text-[#002147]"
                >
                  Probabilidad de cierre
                </CardTitle>
                <CardDescription id={descId}>
                  {lead?.empresa ? (
                    <>
                      Análisis para{" "}
                      <span className="font-medium text-slate-800">
                        {lead.empresa}
                      </span>
                    </>
                  ) : (
                    "Análisis según el lead"
                  )}
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-slate-600"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-5">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-live="polite">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin text-[#002147]" />
                Analizando…
              </div>
              <Skeleton className="mx-auto h-16 w-28 rounded-lg" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : score !== null && advice !== null ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p
                className={cn(
                  "text-5xl font-bold tabular-nums tracking-tight",
                  scoreColorClass(score)
                )}
                aria-label={`Probabilidad estimada ${score} por ciento`}
              >
                {score}%
              </p>
              <p className="w-full text-sm italic leading-relaxed text-slate-700">
                {advice}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
