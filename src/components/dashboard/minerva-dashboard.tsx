"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  FlaskConical,
  Megaphone,
  Presentation,
  Sparkles,
  SquareStop,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  type AppMode,
  getReportForMode,
  useHubStore,
} from "@/lib/store";
import { GlobalModelSelector } from "@/components/layout/header";
import { GenerationProgress } from "@/components/dashboard/generation-progress";
import { ReportBody } from "@/components/dashboard/report-body";
import { DeepDiveChat } from "@/components/dashboard/deep-dive-chat";
import { ExportPdfMenu } from "@/components/dashboard/export-pdf-menu";
import { CreativoIa } from "@/components/dashboard/creativo-ia";
import { MetaProposal } from "@/components/dashboard/meta-proposal";
import { MetaProposalExports } from "@/components/dashboard/meta-proposal-exports";
import { SemCreativeLab } from "@/components/dashboard/sem-creative-lab";
import { SemContactFooter } from "@/components/layout/sem-contact-footer";

const MODES: { id: AppMode; label: string; icon: typeof BarChart3 }[] = [
  { id: "strategic", label: "Análisis Estratégico", icon: BarChart3 },
  { id: "pmax", label: "Generador PMAX", icon: Megaphone },
  { id: "slides", label: "Estructura de Slides", icon: Presentation },
  { id: "creativo", label: "Creativo IA", icon: Sparkles },
  {
    id: "metaProposal",
    label: "Propuesta Meta Ads",
    icon: Target,
  },
  {
    id: "semCreativeLab",
    label: "SEM Creative Lab",
    icon: FlaskConical,
  },
];

export function MinervaDashboard() {
  const url = useHubStore((s) => s.url);
  const country = useHubStore((s) => s.country);
  const targetClient = useHubStore((s) => s.targetClient);
  const activeMode = useHubStore((s) => s.activeMode);
  const strategicAnalysis = useHubStore((s) => s.strategicAnalysis);
  const pmaxContent = useHubStore((s) => s.pmaxContent);
  const slidesContent = useHubStore((s) => s.slidesContent);
  const metaProposalPayload = useHubStore((s) => s.metaProposalPayload);
  const setUrl = useHubStore((s) => s.setUrl);
  const setCountry = useHubStore((s) => s.setCountry);
  const setTargetClient = useHubStore((s) => s.setTargetClient);
  const setActiveMode = useHubStore((s) => s.setActiveMode);
  const setStrategicAnalysis = useHubStore((s) => s.setStrategicAnalysis);
  const setPmaxContent = useHubStore((s) => s.setPmaxContent);
  const setSlidesContent = useHubStore((s) => s.setSlidesContent);
  const globalModel = useHubStore((s) => s.globalModel);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(6 + (elapsed / 40000) * 88, 94);
      setProgress(next);
    }, 260);
    return () => clearInterval(id);
  }, [loading]);

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setProgress(0);
  };

  const runStrategic = async () => {
    setError(null);
    const u = url.trim();
    if (!u) {
      setError("Indica una URL válida.");
      return;
    }
    try {
      new URL(u);
    } catch {
      setError("La URL no es válida (usa https://…).");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setProgress(10);

    try {
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: u,
          country: country.trim() || undefined,
          targetClient: targetClient.trim() || undefined,
          model: globalModel,
        }),
        signal: ctrl.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 499) throw new Error("cancelado");
        throw new Error(data.error || "No se pudo generar el análisis");
      }

      setStrategicAnalysis(data.text as string);
      setProgress(100);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError(null);
      } else if (e instanceof Error && e.message === "cancelado") {
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Error desconocido");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const runPmax = async () => {
    if (!strategicAnalysis?.trim()) {
      setError("Genera primero el Análisis Estratégico.");
      return;
    }
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setProgress(8);

    try {
      const res = await fetch("/api/gemini/pmax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategicAnalysis, model: globalModel }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 499) throw new Error("cancelado");
        throw new Error(data.error || "Error PMAX");
      }
      setPmaxContent(data.text as string);
      setProgress(100);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setError(null);
      else if (e instanceof Error && e.message === "cancelado") setError(null);
      else setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const runSlides = async () => {
    if (!strategicAnalysis?.trim()) {
      setError("Genera primero el Análisis Estratégico.");
      return;
    }
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setProgress(8);

    try {
      const res = await fetch("/api/gemini/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategicAnalysis, model: globalModel }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 499) throw new Error("cancelado");
        throw new Error(data.error || "Error slides");
      }
      setSlidesContent(data.text as string);
      setProgress(100);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setError(null);
      else if (e instanceof Error && e.message === "cancelado") setError(null);
      else setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handlePrimaryAction = () => {
    if (activeMode === "strategic") void runStrategic();
    else if (activeMode === "pmax") void runPmax();
    else if (activeMode === "slides") void runSlides();
  };

  const primaryLabel =
    activeMode === "strategic"
      ? "Generar análisis estratégico"
      : activeMode === "pmax"
        ? "Generar activos PMAX"
        : activeMode === "slides"
          ? "Generar estructura de slides"
          : "";

  const report = getReportForMode(activeMode, {
    strategicAnalysis,
    pmaxContent,
    slidesContent,
  });

  const canRun =
    activeMode === "creativo" ||
    activeMode === "metaProposal" ||
    activeMode === "semCreativeLab"
      ? false
      : activeMode === "strategic" ||
        (!!strategicAnalysis?.trim() &&
          (activeMode === "pmax" || activeMode === "slides"));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile mode tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[#002147]/15 bg-[#002147] p-2 md:hidden">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveMode(m.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition",
              activeMode === m.id
                ? "bg-[#C69C2B] text-[#002147]"
                : "text-white/85 hover:bg-white/10"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#002147]/15 bg-[#002147] text-white md:flex">
        <div className="flex items-center gap-3 p-5">
          <div className="relative h-10 w-32 shrink-0 overflow-hidden rounded-md bg-white/10">
            <Image
              src="/images/brand-minerva-wordmark.png"
              alt="Minerva"
              fill
              className="object-contain object-left"
              sizes="128px"
              priority
            />
          </div>
        </div>
        <p className="font-[family-name:var(--font-heading)] px-5 text-xs leading-snug tracking-wide text-[#C69C2B]/95 uppercase">
          Strategic AI Hub
        </p>
        <Separator className="my-4 bg-white/15" />
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMode(m.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                  activeMode === m.id
                    ? "bg-[#C69C2B] text-[#002147]"
                    : "text-white/90 hover:bg-white/10"
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" />
                {m.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 p-4">
          <Link
            href="/"
            className="block text-xs font-medium text-[#C69C2B]/95 underline-offset-4 hover:text-white hover:underline"
          >
            ← Volver al portal
          </Link>
          <p className="text-[10px] leading-relaxed text-white/55">
            Análisis, PMAX y slides comparten contexto en memoria. Creativo IA,
            Propuesta Meta Ads y SEM Creative Lab son módulos independientes.
          </p>
        </div>
      </aside>

      <div className="relative isolate flex min-h-0 min-h-dvh flex-1 flex-col md:min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div className="sem-workspace-marble" />
          <div className="sem-workspace-overlay" />
        </div>

        <header className="relative z-10 border-b border-[#002147]/10 bg-white/80 px-4 py-6 shadow-sm backdrop-blur-md md:px-10">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#002147] md:text-3xl">
                {activeMode === "creativo"
                  ? "Creativo IA"
                  : activeMode === "metaProposal"
                    ? "Propuesta Meta Ads"
                    : activeMode === "semCreativeLab"
                      ? "SEM Creative Lab"
                      : "Minerva Strategic AI Hub"}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                {activeMode === "creativo"
                  ? "Diseñador de anuncios con IA: sube tu producto, define el copy y obtén tres formatos optimizados para Google y Meta. Edita cada pieza con instrucciones en lenguaje natural."
                  : activeMode === "metaProposal"
                    ? "Genera propuestas completas para Facebook e Instagram: estrategia por objetivo, segmentación, copys con emojis y creatividades con IA, listas para presentar al cliente."
                    : activeMode === "semCreativeLab"
                      ? "Convierte PDFs técnicos de packaging en mockups publicitarios: visión con Gemini Flash y render con Hugging Face (FLUX / SDXL), con reintentos ante cold start."
                      : "Consultoría estratégica asistida por IA: diagnóstico B2B, activos PMAX y narrativa ejecutiva en formato McKinsey-style."}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap items-start justify-end gap-3">
              <GlobalModelSelector layout="row" className="shrink-0" />
              {activeMode === "metaProposal" && metaProposalPayload ? (
                <MetaProposalExports payload={metaProposalPayload} />
              ) : activeMode !== "creativo" &&
                activeMode !== "metaProposal" &&
                activeMode !== "semCreativeLab" ? (
                <ExportPdfMenu mode={activeMode} />
              ) : null}
            </div>
          </div>

          {activeMode !== "creativo" &&
            activeMode !== "metaProposal" &&
            activeMode !== "semCreativeLab" && (
            <>
              <Card className="border-[#002147]/15 bg-white/60 shadow-sm backdrop-blur-sm">
                <CardContent className="grid gap-4 p-4 md:grid-cols-3 md:gap-5 md:p-5">
                  <div className="md:col-span-1">
                    <Label htmlFor="url" className="text-[#002147]">
                      URL del sitio / empresa
                    </Label>
                    <Input
                      id="url"
                      placeholder="https://www.ejemplo.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="mt-1.5 rounded-xl border-[#002147]/25"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">País / mercado (opcional)</Label>
                    <Input
                      id="country"
                      placeholder="ej. España, LATAM…"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="mt-1.5 rounded-xl border-[#002147]/25"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="target">Cliente objetivo (opcional)</Label>
                    <Input
                      id="target"
                      placeholder="Sector o perfil B2B…"
                      value={targetClient}
                      onChange={(e) => setTargetClient(e.target.value)}
                      className="mt-1.5 rounded-xl border-[#002147]/25"
                      disabled={loading}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  className="rounded-xl bg-[#C69C2B] px-5 font-semibold text-[#002147] hover:bg-[#b38a26] disabled:opacity-50"
                  onClick={handlePrimaryAction}
                  disabled={loading || !canRun}
                >
                  {primaryLabel}
                </Button>
                {loading && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-xl border-red-400/60 text-red-700 hover:bg-red-50"
                    onClick={stopGeneration}
                  >
                    <SquareStop className="size-4" />
                    {activeMode === "strategic"
                      ? "Parar análisis"
                      : "Parar generación"}
                  </Button>
                )}
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              {loading && (
                <div className="mt-6">
                  <GenerationProgress value={progress} />
                </div>
              )}
            </>
          )}
        </header>

        <main className="relative z-10 flex-1 px-4 py-8 md:px-10 md:py-10">
          {activeMode === "creativo" ? (
            <div className="mx-auto max-w-6xl">
              <CreativoIa />
            </div>
          ) : activeMode === "metaProposal" ? (
            <div className="mx-auto max-w-6xl">
              <MetaProposal />
            </div>
          ) : activeMode === "semCreativeLab" ? (
            <div className="mx-auto max-w-6xl">
              <SemCreativeLab />
            </div>
          ) : (
            <>
              {!report && !loading && (
                <div className="rounded-2xl border border-dashed border-[#002147]/20 bg-white/45 px-6 py-16 text-center backdrop-blur-sm">
                  <p className="text-muted-foreground text-sm">
                    {activeMode === "strategic" &&
                      "Introduce la URL y genera el informe estratégico. Los demás módulos reutilizarán ese análisis sin volver a consumir el prompt inicial completo."}
                    {activeMode === "pmax" &&
                      !strategicAnalysis &&
                      "El Generador PMAX usa el análisis estratégico guardado. Ejecuta primero el módulo principal."}
                    {activeMode === "slides" &&
                      !strategicAnalysis &&
                      "La estructura de slides se nutre del análisis guardado. Genera antes el Análisis Estratégico."}
                    {(activeMode === "pmax" || activeMode === "slides") &&
                      strategicAnalysis &&
                      "Pulsa el botón de generación para crear contenido en este módulo."}
                  </p>
                </div>
              )}

              {report && (
                <article className="mx-auto max-w-4xl rounded-2xl border border-[#002147]/10 bg-white/85 p-5 shadow-sm backdrop-blur-sm md:p-8">
                  <ReportBody content={report} />
                </article>
              )}

              <div className="mx-auto max-w-4xl">
                <DeepDiveChat mode={activeMode} originalReport={report} />
              </div>
            </>
          )}
        </main>

        <SemContactFooter />
      </div>
    </div>
  );
}
