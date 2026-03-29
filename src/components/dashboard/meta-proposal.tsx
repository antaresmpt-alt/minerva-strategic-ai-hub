"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { MinervaThinkingLogo } from "@/components/brand/minerva-thinking-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  META_OBJECTIVE_OPTIONS,
  type MetaProposalPayload,
} from "@/lib/meta-proposal-types";
import { useHubStore } from "@/lib/store";

function adKey(c: number, a: number, d: number) {
  return `${c}-${a}-${d}`;
}

function downloadImageBase64(base64: string, filename: string) {
  const dataUrl = base64.startsWith("data:")
    ? base64
    : `data:image/png;base64,${base64}`;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function MetaProposal() {
  const setMetaProposalPayload = useHubStore((s) => s.setMetaProposalPayload);

  const [websiteText, setWebsiteText] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [budgetMonthly, setBudgetMonthly] = useState("");
  const [geo, setGeo] = useState("");
  const [objectiveIds, setObjectiveIds] = useState<string[]>([]);

  const [proposal, setProposal] = useState<MetaProposalPayload | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [loadingText, setLoadingText] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleObjective = (id: string) => {
    setObjectiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const fetchAdImage = useCallback(async (prompt: string, key: string) => {
    setImageLoading((m) => ({ ...m, [key]: true }));
    try {
      const res = await fetch("/api/gemini/meta-proposal-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar imagen");
      const b64 = data.imageBase64 as string;
      setImages((m) => ({ ...m, [key]: b64 }));
    } catch (e) {
      setImages((m) => ({ ...m, [key]: "" }));
      console.error(e);
    } finally {
      setImageLoading((m) => ({ ...m, [key]: false }));
    }
  }, []);

  const runGenerate = async () => {
    setError(null);
    setProposal(null);
    setImages({});
    setMetaProposalPayload(null);
    setLoadingText(true);

    try {
      const res = await fetch("/api/gemini/meta-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteText,
          businessType,
          budgetMonthly,
          geo,
          objectiveIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar");
      const p = data.proposal as MetaProposalPayload;
      setProposal(p);
      setMetaProposalPayload(p);
      setLoadingText(false);
      setLoadingImages(true);

      for (let ci = 0; ci < p.campaigns.length; ci++) {
        const camp = p.campaigns[ci];
        for (let ai = 0; ai < camp.adSets.length; ai++) {
          const adSet = camp.adSets[ai];
          for (let di = 0; di < adSet.ads.length; di++) {
            const ad = adSet.ads[di];
            const key = adKey(ci, ai, di);
            await fetchAdImage(ad.imagePrompt, key);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setLoadingText(false);
    } finally {
      setLoadingImages(false);
    }
  };

  const regenerateImage = (prompt: string, key: string) => {
    void fetchAdImage(prompt, key);
  };

  const resetForm = () => {
    setProposal(null);
    setImages({});
    setError(null);
    setMetaProposalPayload(null);
  };

  const showForm =
    (!proposal || error) && !loadingText && !loadingImages;

  return (
    <div className="space-y-8">
      {(loadingText || loadingImages) && (
        <div
          className="flex items-center gap-3 rounded-xl border border-[#002147]/15 bg-[#002147]/[0.04] px-4 py-3 text-sm text-[#002147]"
          role="status"
        >
          <MinervaThinkingLogo size={40} />
          <span>
            {loadingText
              ? "Generando tu propuesta… Esto puede tardar un momento."
              : "Generando creatividades para cada anuncio…"}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Algo salió mal</p>
          <p className="mt-1">{error}</p>
          <Button
            type="button"
            className="mt-3 rounded-lg bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#b38a26]"
            onClick={() => {
              setError(null);
              void runGenerate();
            }}
          >
            Volver a intentar
          </Button>
        </div>
      )}

      {showForm && !loadingText && (
        <Card className="border-[#002147]/15 shadow-sm">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-heading)] text-lg text-[#002147]">
              Datos del cliente
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Pega el contexto de la web, define el negocio y los objetivos. La IA
              elaborará una propuesta lista para presentar.
            </p>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div>
              <Label htmlFor="mp-web">Información de la web / empresa</Label>
              <Textarea
                id="mp-web"
                placeholder="Quiénes son, qué venden, tono de marca, productos clave…"
                value={websiteText}
                onChange={(e) => setWebsiteText(e.target.value)}
                className="mt-1.5 min-h-[140px] rounded-xl border-[#002147]/25"
                disabled={loadingText || loadingImages}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="mp-type">Tipo de negocio</Label>
                <Input
                  id="mp-type"
                  placeholder="ej. tienda de ropa online, SaaS B2B…"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="mt-1.5 rounded-xl border-[#002147]/25"
                  disabled={loadingText || loadingImages}
                />
              </div>
              <div>
                <Label htmlFor="mp-budget">Presupuesto mensual (anuncios)</Label>
                <Input
                  id="mp-budget"
                  placeholder="ej. 1.500 €"
                  value={budgetMonthly}
                  onChange={(e) => setBudgetMonthly(e.target.value)}
                  className="mt-1.5 rounded-xl border-[#002147]/25"
                  disabled={loadingText || loadingImages}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mp-geo">Ciudad o país objetivo</Label>
              <Input
                id="mp-geo"
                placeholder="ej. Madrid, México, LATAM…"
                value={geo}
                onChange={(e) => setGeo(e.target.value)}
                className="mt-1.5 rounded-xl border-[#002147]/25"
                disabled={loadingText || loadingImages}
              />
            </div>
            <div>
              <span className="text-sm font-medium text-[#002147]">
                Objetivos principales
              </span>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {META_OBJECTIVE_OPTIONS.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                      objectiveIds.includes(o.id)
                        ? "border-[#C69C2B] bg-[#C69C2B]/10"
                        : "border-[#002147]/15 hover:border-[#002147]/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-[#002147]/40"
                      checked={objectiveIds.includes(o.id)}
                      onChange={() => toggleObjective(o.id)}
                      disabled={loadingText || loadingImages}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              type="button"
              className="h-12 rounded-xl bg-[#C69C2B] text-base font-semibold text-[#002147] hover:bg-[#b38a26] disabled:opacity-50"
              onClick={() => void runGenerate()}
              disabled={loadingText || loadingImages}
            >
              Generar propuesta con IA
            </Button>
          </CardContent>
        </Card>
      )}

      {proposal && !error && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Propuesta generada. Puedes exportar el informe desde la barra
              superior (PDF, Word, Excel).
            </p>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-[#002147]/25"
              onClick={resetForm}
            >
              Nueva propuesta
            </Button>
          </div>

          <Card className="border-[#002147]/15 shadow-sm">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-heading)] text-[#002147]">
                Análisis del negocio
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm leading-relaxed">
              <div>
                <p className="font-semibold text-[#002147]">Resumen</p>
                <p className="mt-1">{proposal.businessAnalysis.summary}</p>
              </div>
              <div>
                <p className="font-semibold text-[#002147]">
                  Problemas que resuelve
                </p>
                <p className="mt-1">{proposal.businessAnalysis.problemsSolved}</p>
              </div>
              <div>
                <p className="font-semibold text-[#002147]">Valor diferencial</p>
                <p className="mt-1">{proposal.businessAnalysis.uniqueValue}</p>
              </div>
              <div>
                <p className="font-semibold text-[#002147]">Cliente ideal</p>
                <p className="mt-1">{proposal.businessAnalysis.buyerPersona}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[#002147]">
              Estrategia de campañas
            </h2>
            {proposal.campaigns.map((camp, ci) => (
              <Card
                key={`${camp.campaignName}-${ci}`}
                className="border-[#002147]/15 shadow-sm"
              >
                <CardHeader>
                  <CardTitle className="text-lg text-[#002147]">
                    {camp.campaignName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {camp.adSets.map((adSet, ai) => (
                    <div
                      key={`${adSet.name}-${ai}`}
                      className="rounded-xl border border-[#002147]/10 bg-slate-50/50 p-4"
                    >
                      <p className="font-semibold text-[#002147]">{adSet.name}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {adSet.targeting}
                      </p>
                      <div className="mt-4 grid gap-6 md:grid-cols-2">
                        {adSet.ads.map((ad, di) => {
                          const key = adKey(ci, ai, di);
                          const b64 = images[key];
                          const loading = imageLoading[key];
                          return (
                            <div
                              key={key}
                              className="overflow-hidden rounded-lg border border-[#002147]/10 bg-white shadow-sm"
                            >
                              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                                <div className="size-8 rounded-full bg-[#002147]/10" />
                                <div className="text-xs">
                                  <span className="font-semibold text-[#002147]">
                                    Tu marca
                                  </span>
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · Patrocinado
                                  </span>
                                </div>
                              </div>
                              <div className="relative aspect-square w-full bg-slate-100">
                                {loading && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                                    <MinervaThinkingLogo size={44} />
                                  </div>
                                )}
                                {!loading && b64 && (
                                  <Image
                                    src={`data:image/png;base64,${b64}`}
                                    alt="Creativo generado"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                )}
                                {!loading && !b64 && (
                                  <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
                                    Imagen no disponible. Usa Regenerar o revisa
                                    la consola.
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2 p-3 text-sm">
                                <p className="whitespace-pre-wrap text-[#1c1e21]">
                                  {ad.copy}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 rounded-md text-xs"
                                    disabled={loading}
                                    onClick={() =>
                                      regenerateImage(ad.imagePrompt, key)
                                    }
                                  >
                                    <RefreshCw className="size-3.5" />
                                    Regenerar imagen
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 rounded-md text-xs"
                                    disabled={!b64 || loading}
                                    onClick={() =>
                                      downloadImageBase64(
                                        b64,
                                        `meta-ad-${ci}-${ai}-${di}.png`
                                      )
                                    }
                                  >
                                    <Download className="size-3.5" />
                                    Descargar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-[#002147]/15 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#002147]">Más ideas visuales</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-sm">
                {proposal.visualIdeas.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-[#002147]/15 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#002147]">
                Métricas de éxito (KPIs)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#002147]/15 bg-[#002147]/5">
                    <th className="px-3 py-2 text-left font-semibold text-[#002147]">
                      Métrica
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-[#002147]">
                      Qué vigilar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.kpis.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-2 align-top">{row.metric}</td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {row.whatToWatch}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-[#002147]/15 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#002147]">
                Recomendaciones adicionales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-sm">
                {proposal.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
