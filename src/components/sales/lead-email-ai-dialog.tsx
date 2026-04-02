"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Copy, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { leadRowToEmailPayload } from "@/lib/lead-email-payload";
import { useHubStore } from "@/lib/store";
import { parseSalesEmailText } from "@/lib/lead-email-parse-response";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types/leads";

type Props = {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeadEmailAiDialog({ lead, open, onOpenChange }: Props) {
  const globalModel = useHubStore((s) => s.globalModel);
  const titleId = useId();
  const descId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copyOk, setCopyOk] = useState(false);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setRawText(null);
    setSubject("");
    setBody("");
    setCopyOk(false);
  }, []);

  const payloadKey = useMemo(
    () => (lead ? JSON.stringify(leadRowToEmailPayload(lead)) : ""),
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
      setRawText(null);
      setSubject("");
      setBody("");
      setCopyOk(false);
      try {
        const res = await fetch("/api/sales-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadData: leadRowToEmailPayload(leadRow),
            model: globalModel,
          }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        if (typeof data.text === "string") {
          setRawText(data.text);
          const parsed = parseSalesEmailText(data.text);
          setSubject(parsed.subject);
          setBody(parsed.body);
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
  }, [open, lead, payloadKey, globalModel]);

  const copyAll = useCallback(async () => {
    const text = `Asunto: ${subject}\n\n${body}`.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2800);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }, [subject, body]);

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
        className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-2xl flex-col border-slate-200/90 bg-white shadow-xl"
      >
        <CardHeader className="shrink-0 space-y-1 border-b border-slate-200/80 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#002147]/10 text-[#002147]">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle
                  id={titleId}
                  className="text-lg font-semibold text-[#002147]"
                >
                  Email comercial con IA
                </CardTitle>
                <CardDescription id={descId}>
                  {lead?.empresa ? (
                    <>
                      Borrador para{" "}
                      <span className="font-medium text-slate-800">
                        {lead.empresa}
                      </span>
                    </>
                  ) : (
                    "Borrador generado según el lead"
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
                Generando borrador con Gemini…
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="email-subject" className="text-slate-700">
                  Asunto
                </Label>
                <input
                  id="email-subject"
                  readOnly
                  value={subject}
                  className={cn(
                    "border-input bg-background h-9 w-full rounded-lg border px-3 text-sm shadow-xs",
                    "text-slate-900"
                  )}
                />
              </div>
              <div className="grid min-h-0 flex-1 gap-2">
                <Label htmlFor="email-body" className="text-slate-700">
                  Cuerpo
                </Label>
                <Textarea
                  id="email-body"
                  readOnly
                  value={body}
                  rows={12}
                  className="min-h-[200px] resize-y text-sm leading-relaxed"
                />
              </div>
              {rawText && (subject === "" || body === "") ? (
                <details className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
                  <summary className="cursor-pointer font-medium">
                    Ver respuesta completa (parseo parcial)
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-snug">
                    {rawText}
                  </pre>
                </details>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  className="gap-2 bg-[#002147] hover:bg-[#002147]/90"
                  onClick={() => void copyAll()}
                  disabled={!subject && !body}
                >
                  <Copy className="size-4" aria-hidden />
                  Copiar asunto y cuerpo
                </Button>
                {copyOk ? (
                  <span className="text-sm font-medium text-emerald-700">
                    Copiado al portapapeles
                  </span>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
