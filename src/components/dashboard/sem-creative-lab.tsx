"use client";

import { useCallback, useRef, useState } from "react";
import {
  Download,
  FlaskConical,
  ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { MinervaThinkingLogo } from "@/components/brand/minerva-thinking-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PackagingAnalysis } from "@/lib/sem-creative-lab-types";
import { readApiJson } from "@/lib/read-api-json";

const ACCEPT = "application/pdf";

type Phase = "idle" | "analyze" | "prepare" | "render";

function phaseLabel(p: Phase): string {
  if (p === "analyze") return "Analizando troquel con Minerva Vision...";
  if (p === "prepare") return "Preparando estudio fotográfico IA...";
  if (p === "render")
    return "Renderizando mockup publicitario (esto puede tardar 30s)...";
  return "";
}

function phaseProgress(p: Phase): number {
  if (p === "analyze") return 28;
  if (p === "prepare") return 52;
  if (p === "render") return 88;
  return 0;
}

function downloadPng(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SemCreativeLab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PackagingAnalysis | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [promptUsed, setPromptUsed] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lifestyleLoading, setLifestyleLoading] = useState(false);

  const busy = phase !== "idle";

  const onPick = (f: File | null) => {
    setError(null);
    setImageBase64(null);
    setAnalysis(null);
    setPromptUsed(null);
    setModelUsed(null);
    if (!f) {
      setFile(null);
      return;
    }
    const okPdf =
      f.type === "application/pdf" ||
      f.name.toLowerCase().endsWith(".pdf");
    if (!okPdf) {
      setError("Selecciona un archivo PDF.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    onPick(f ?? null);
  }, []);

  const runPipeline = async () => {
    if (!file) {
      setError("Arrastra un PDF o elige un archivo.");
      return;
    }
    setError(null);
    setImageBase64(null);
    try {
      setPhase("analyze");
      const form = new FormData();
      /** Nombre ASCII en el multipart evita fallos de parseo con caracteres no ASCII en el filename (Next/undici). */
      form.append("pdf", file, "sem-creative-lab-upload.pdf");

      const resAnalyze = await fetch("/api/gemini/sem-creative-lab/analyze", {
        method: "POST",
        body: form,
      });
      const dataAnalyze = await readApiJson<{
        analysis?: PackagingAnalysis;
        error?: string;
      }>(resAnalyze);
      const nextAnalysis = dataAnalyze.analysis;
      if (!nextAnalysis) throw new Error("Respuesta sin análisis.");
      setAnalysis(nextAnalysis);

      setPhase("prepare");
      await new Promise((r) => setTimeout(r, 380));

      setPhase("render");
      const resRender = await fetch("/api/gemini/sem-creative-lab/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: nextAnalysis,
          variation: "studio",
        }),
      });
      const dataRender = await readApiJson<{
        imageBase64?: string;
        promptUsed?: string;
        modelUsed?: string;
      }>(resRender);
      if (!dataRender.imageBase64) throw new Error("Respuesta sin imagen.");
      setImageBase64(dataRender.imageBase64);
      setPromptUsed(dataRender.promptUsed ?? null);
      setModelUsed(dataRender.modelUsed ?? null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Error desconocido");
      }
    } finally {
      setPhase("idle");
    }
  };

  const runLifestyle = async () => {
    if (!analysis) {
      setError("Genera primero el mockup de estudio.");
      return;
    }
    setError(null);
    setLifestyleLoading(true);
    try {
      const res = await fetch("/api/gemini/sem-creative-lab/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          variation: "lifestyle",
        }),
      });
      const data = await readApiJson<{
        imageBase64?: string;
        promptUsed?: string;
        modelUsed?: string;
      }>(res);
      if (!data.imageBase64) throw new Error("Respuesta sin imagen.");
      setImageBase64(data.imageBase64);
      setPromptUsed(data.promptUsed ?? null);
      setModelUsed(data.modelUsed ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar la variación.");
    } finally {
      setLifestyleLoading(false);
    }
  };

  const label = phaseLabel(phase);
  const progressVal = busy ? phaseProgress(phase) : 0;

  return (
    <div className="space-y-8">
      <Card className="border-[#002147]/15 bg-white/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-lg text-[#002147]">
            <FlaskConical className="size-5 text-[#C69C2B]" aria-hidden />
            SEM Creative Lab — PDF a mockup publicitario
          </CardTitle>
          <p className="text-muted-foreground text-sm font-normal">
            Sube un PDF técnico de packaging. Minerva Vision (Gemini Flash) extrae
            nombre, colores y formato; Hugging Face genera el render publicitario
            (FLUX.1 Schnell o SDXL como respaldo).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#002147]/25 bg-[#002147]/[0.03] px-6 py-12 text-center transition hover:border-[#C69C2B]/80 hover:bg-[#C69C2B]/5",
              busy && "pointer-events-none opacity-60"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <Upload className="mb-3 size-10 text-[#002147]/50" aria-hidden />
            <p className="text-sm font-medium text-[#002147]">
              Arrastra tu PDF aquí o haz clic para elegir
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Troquel / ficha técnica (máx. 12 MB)
            </p>
            {file && (
              <p className="mt-4 truncate text-sm text-[#002147]/80">
                {file.name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="rounded-xl bg-[#C69C2B] px-5 font-semibold text-[#002147] hover:bg-[#b38a26] disabled:opacity-50"
              disabled={busy || !file}
              onClick={() => void runPipeline()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <ImageIcon className="size-4" />
                  Generar mockup publicitario
                </>
              )}
            </Button>
            {file && !busy && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onPick(null)}
              >
                Quitar PDF
              </Button>
            )}
          </div>

          {busy && (
            <div className="space-y-2">
              <Progress
                value={progressVal}
                className="[&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:bg-[#002147]/12 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-[#002147] [&_[data-slot=progress-indicator]]:to-[#C69C2B]"
              >
                <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 max-w-[min(100%,28rem)] items-center gap-2 md:gap-3">
                    <MinervaThinkingLogo size={36} />
                    <ProgressLabel className="text-xs font-medium text-[#002147] md:text-sm">
                      {label}
                    </ProgressLabel>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    {Math.round(progressVal)}%
                  </span>
                </div>
              </Progress>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {imageBase64 && (
        <Card className="border-[#002147]/15 bg-white/90 shadow-md backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-heading)] text-lg text-[#002147]">
              Resultado
            </CardTitle>
            {modelUsed && (
              <p className="text-muted-foreground text-xs">
                Modelo HF: {modelUsed}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-[#002147]/10 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${imageBase64}`}
                alt="Mockup publicitario generado"
                className="mx-auto max-h-[min(70vh,720px)] w-auto object-contain"
              />
            </div>
            {promptUsed && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-medium text-[#002147]">
                  Prompt enviado a Hugging Face
                </summary>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-100/80 p-3">
                  {promptUsed}
                </p>
              </details>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="rounded-xl bg-[#002147] text-white hover:bg-[#002147]/90"
                onClick={() =>
                  downloadPng(
                    imageBase64,
                    `minerva-sem-google-ads-${Date.now()}.png`
                  )
                }
              >
                <Download className="size-4" />
                Descargar para Google Ads
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-[#C69C2B]/50"
                disabled={lifestyleLoading || !analysis}
                onClick={() => void runLifestyle()}
              >
                {lifestyleLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Generar variación lifestyle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
