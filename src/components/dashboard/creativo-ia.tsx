"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clapperboard,
  Copy,
  Download,
  ImagePlus,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { MinervaThinkingLogo } from "@/components/brand/minerva-thinking-logo";
import { ReportBody } from "@/components/dashboard/report-body";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CREATIVO_IMAGE_MODEL_OPTIONS } from "@/lib/creativo-image-models";
import { compressImageForApi } from "@/lib/compress-product-image-client";
import { readApiJson } from "@/lib/read-api-json";
import {
  CREATIVO_VARIANT_STORAGE_KEY,
  VARIANT_META,
  VARIANT_ORDER,
  type CreativoVariant,
} from "@/lib/creativo-variants";

type ProductState = {
  base64: string;
  mime: string;
  preview: string;
};

type AdSlot = {
  base64?: string;
  mime?: string;
  loading?: boolean;
  editText?: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

async function fileToPayload(file: File): Promise<ProductState> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error("Formato de imagen no soportado");
  return { mime: m[1], base64: m[2], preview: dataUrl };
}

function downloadImage(base64: string, mime: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const emptySlots = (): Record<CreativoVariant, AdSlot> => ({
  square: { editText: "" },
  horizontal: { editText: "" },
  vertical: { editText: "" },
});

type CreativoTab = "static" | "video";

export function CreativoIa() {
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [product, setProduct] = useState<ProductState | null>(null);
  const [productName, setProductName] = useState("");
  const [cta, setCta] = useState("");
  const [description, setDescription] = useState("");
  /** Modo manual: se fusiona con el análisis automático del pack (visión). */
  const [extraInstructions, setExtraInstructions] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("");

  const [ads, setAds] = useState<Record<CreativoVariant, AdSlot>>(emptySlots);
  const [batchRunning, setBatchRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedVariant, setSelectedVariant] =
    useState<CreativoVariant>("square");
  const [panelError, setPanelError] = useState<string | null>(null);

  const [creativoTab, setCreativoTab] = useState<CreativoTab>("static");
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CREATIVO_VARIANT_STORAGE_KEY);
      if (
        stored &&
        VARIANT_ORDER.includes(stored as CreativoVariant)
      ) {
        setSelectedVariant(stored as CreativoVariant);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CREATIVO_VARIANT_STORAGE_KEY, selectedVariant);
    } catch {
      /* ignore */
    }
  }, [selectedVariant]);

  const anyAdSlotLoading = ads[selectedVariant].loading;

  const ingestFile = useCallback(async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPanelError(null);
    try {
      const p = await fileToPayload(file);
      setProduct(p);
      setAds(emptySlots());
      setStarted(false);
    } catch (e) {
      setPanelError(
        e instanceof Error ? e.message : "No se pudo cargar la imagen"
      );
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          e.preventDefault();
          const f = it.getAsFile();
          if (f) void ingestFile(f);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestFile]);

  const canGenerate =
    !!product?.base64 &&
    productName.trim().length > 0 &&
    cta.trim().length > 0;

  const canGenerateVideo =
    canGenerate &&
    originalPrice.trim().length > 0 &&
    offerPrice.trim().length > 0;

  const buildBody = (variant: CreativoVariant, imageBase64: string, imageMime: string) => ({
    action: "generate" as const,
    variant,
    imageBase64,
    imageMime,
    imageModel: CREATIVO_IMAGE_MODEL_OPTIONS[0].id,
    productName: productName.trim(),
    cta: cta.trim(),
    description: description.trim() || undefined,
    extraInstructions: extraInstructions.trim() || undefined,
    originalPrice: originalPrice.trim() || undefined,
    offerPrice: offerPrice.trim() || undefined,
    discountPct: discountPct.trim() || undefined,
  });

  const runGenerateAll = async () => {
    setPanelError(null);
    if (!product) {
      setPanelError("Por favor, sube una imagen del producto.");
      return;
    }
    if (!productName.trim()) {
      setPanelError("Indica el nombre del producto.");
      return;
    }
    if (!cta.trim()) {
      setPanelError("Indica la llamada a la acción (CTA).");
      return;
    }

    let payload: { base64: string; mime: string };
    try {
      payload = await compressImageForApi(product.base64, product.mime);
    } catch (e) {
      setPanelError(
        e instanceof Error
          ? e.message
          : "No se pudo preparar la imagen para el envío."
      );
      return;
    }

    const variant = selectedVariant;

    setStarted(true);
    setBatchRunning(true);
    setAds((s) => ({
      ...s,
      [variant]: { ...s[variant], loading: true },
    }));

    try {
      const res = await fetch("/api/gemini/creativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildBody(variant, payload.base64, payload.mime)
        ),
      });
      const data = await readApiJson<{
        imageBase64: string;
        mimeType?: string;
      }>(res);

      setAds((s) => ({
        ...s,
        [variant]: {
          ...s[variant],
          loading: false,
          base64: data.imageBase64,
          mime: data.mimeType || "image/png",
        },
      }));
    } catch (e) {
      setAds((s) => ({
        ...s,
        [variant]: { ...s[variant], loading: false },
      }));
      setPanelError(e instanceof Error ? e.message : "Error de generación");
    } finally {
      setBatchRunning(false);
    }
  };

  const runEdit = async (variant: CreativoVariant) => {
    const slot = ads[variant];
    const instruction = (slot.editText ?? "").trim();
    if (!instruction) {
      setPanelError("Escribe una instrucción para editar este anuncio.");
      return;
    }
    if (!product) {
      setPanelError("Sube la imagen del producto para analizar el pack con visión profunda.");
      return;
    }
    if (!slot.base64) return;
    setPanelError(null);
    setAds((s) => ({
      ...s,
      [variant]: { ...s[variant], loading: true },
    }));

    try {
      const payload = await compressImageForApi(product.base64, product.mime);
      const res = await fetch("/api/gemini/creativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          variant,
          imageBase64: payload.base64,
          imageMime: payload.mime,
          imageModel: CREATIVO_IMAGE_MODEL_OPTIONS[0].id,
          editInstruction: instruction,
          productName: productName.trim(),
          cta: cta.trim(),
          description: description.trim() || undefined,
          extraInstructions: extraInstructions.trim() || undefined,
          originalPrice: originalPrice.trim() || undefined,
          offerPrice: offerPrice.trim() || undefined,
          discountPct: discountPct.trim() || undefined,
        }),
      });
      const data = await readApiJson<{
        imageBase64: string;
        mimeType?: string;
      }>(res);

      setAds((s) => ({
        ...s,
        [variant]: {
          ...s[variant],
          loading: false,
          base64: data.imageBase64,
          mime: data.mimeType || "image/png",
        },
      }));
    } catch (e) {
      setAds((s) => ({
        ...s,
        [variant]: { ...s[variant], loading: false },
      }));
      setPanelError(e instanceof Error ? e.message : "Error al editar");
    }
  };

  const runRegenerate = async (variant: CreativoVariant) => {
    if (!product) return;
    setPanelError(null);
    setAds((s) => ({
      ...s,
      [variant]: { ...s[variant], loading: true },
    }));

    try {
      const payload = await compressImageForApi(product.base64, product.mime);
      const res = await fetch("/api/gemini/creativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          variant,
          imageBase64: payload.base64,
          imageMime: payload.mime,
          imageModel: CREATIVO_IMAGE_MODEL_OPTIONS[0].id,
          productName: productName.trim(),
          cta: cta.trim(),
          description: description.trim() || undefined,
          extraInstructions: extraInstructions.trim() || undefined,
          originalPrice: originalPrice.trim() || undefined,
          offerPrice: offerPrice.trim() || undefined,
          discountPct: discountPct.trim() || undefined,
        }),
      });
      const data = await readApiJson<{
        imageBase64: string;
        mimeType?: string;
      }>(res);

      setAds((s) => ({
        ...s,
        [variant]: {
          ...s[variant],
          loading: false,
          base64: data.imageBase64,
          mime: data.mimeType || "image/png",
        },
      }));
    } catch (e) {
      setAds((s) => ({
        ...s,
        [variant]: { ...s[variant], loading: false },
      }));
      setPanelError(e instanceof Error ? e.message : "Error al regenerar");
    }
  };

  const clearProduct = () => {
    setProduct(null);
    setAds(emptySlots());
    setStarted(false);
    setPanelError(null);
    setVideoScript(null);
    setVideoStarted(false);
  };

  const runVideoScript = async () => {
    setPanelError(null);
    if (!product) {
      setPanelError("Por favor, sube una imagen del producto.");
      return;
    }
    if (!productName.trim()) {
      setPanelError("Indica el nombre del producto.");
      return;
    }
    if (!cta.trim()) {
      setPanelError("Indica la llamada a la acción (CTA).");
      return;
    }
    if (!originalPrice.trim() || !offerPrice.trim()) {
      setPanelError(
        "Para el guion de vídeo indica precio original y precio de oferta."
      );
      return;
    }

    setVideoLoading(true);
    try {
      const payload = await compressImageForApi(product.base64, product.mime);
      setVideoStarted(true);
      const res = await fetch("/api/gemini/creativo-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: payload.base64,
          imageMime: payload.mime,
          productName: productName.trim(),
          cta: cta.trim(),
          description: description.trim() || undefined,
          originalPrice: originalPrice.trim(),
          offerPrice: offerPrice.trim(),
          discountPct: discountPct.trim() || undefined,
        }),
      });
      const data = await readApiJson<{ text: string }>(res);
      setVideoScript(data.text);
    } catch (e) {
      setVideoStarted(false);
      setPanelError(
        e instanceof Error ? e.message : "Error al generar el guion"
      );
    } finally {
      setVideoLoading(false);
    }
  };

  const copyVideoScript = async () => {
    if (!videoScript?.trim()) return;
    try {
      await navigator.clipboard.writeText(videoScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setPanelError("No se pudo copiar al portapapeles.");
    }
  };

  const progressLabel = VARIANT_META[selectedVariant].title;
  const resultMeta = VARIANT_META[selectedVariant];
  const resultSlot = ads[selectedVariant];
  const resultSrc =
    resultSlot.base64 && resultSlot.mime
      ? `data:${resultSlot.mime};base64,${resultSlot.base64}`
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#002147]/15 bg-white/75 shadow-md backdrop-blur-md">
      <div
        className="flex gap-1 border-b border-[#002147]/10 bg-slate-50/90 p-2"
        role="tablist"
        aria-label="Tipo de creatividad"
      >
        <button
          type="button"
          role="tab"
          aria-selected={creativoTab === "static"}
          onClick={() => setCreativoTab("static")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition",
            creativoTab === "static"
              ? "bg-[#C69C2B] text-[#002147] shadow-sm"
              : "text-slate-600 hover:bg-white hover:text-[#002147]"
          )}
        >
          <LayoutGrid className="size-4 shrink-0" aria-hidden />
          Creatividades estáticas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={creativoTab === "video"}
          onClick={() => setCreativoTab("video")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition",
            creativoTab === "video"
              ? "bg-[#C69C2B] text-[#002147] shadow-sm"
              : "text-slate-600 hover:bg-white hover:text-[#002147]"
          )}
        >
          <Clapperboard className="size-4 shrink-0" aria-hidden />
          Guion vídeo 10 s
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,440px)_1fr] lg:items-stretch">
        {/* Panel de control */}
        <section className="border-b border-[#002147]/10 bg-slate-50/50 p-6 lg:border-r lg:border-b-0 lg:border-[#002147]/10 lg:p-8">
          <div className="mb-6 flex items-center gap-2 text-[#C69C2B]">
            <Sparkles className="size-5" aria-hidden />
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold tracking-tight text-[#002147]">
              Panel de control
            </h2>
          </div>

          <div className="space-y-8">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Paso 1 · Imagen del producto
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => void ingestFile(e.target.files?.[0] ?? null)}
              />
              {!product ? (
                <div
                  ref={dropRef}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      fileRef.current?.click();
                  }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void ingestFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#002147]/25 bg-white px-4 py-10 text-center transition hover:border-[#C69C2B]/70 hover:bg-slate-50"
                  )}
                >
                  <ImagePlus className="mb-3 size-10 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">
                    Arrastra una imagen, haz clic para buscar o pega con{" "}
                    <kbd className="rounded border border-[#002147]/20 bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                      Ctrl+V
                    </kbd>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    JPG, PNG o WebP · recomendado buena iluminación
                  </p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-[#002147]/15 bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={clearProduct}
                    className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-lg border border-[#002147]/10 bg-white text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-700"
                    aria-label="Quitar imagen"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.preview}
                    alt="Vista previa del producto"
                    className="mx-auto max-h-52 w-auto object-contain"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Paso 2 · Textos{" "}
                {creativoTab === "video"
                  ? "del vídeo"
                  : "del anuncio"}
              </p>
              <div>
                <Label htmlFor="creativo-name" className="text-[#002147]">
                  Nombre del producto <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="creativo-name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="ej. Zapatilla Urban Pro"
                  className="mt-1.5 rounded-xl border-[#002147]/25 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <Label htmlFor="creativo-cta" className="text-[#002147]">
                  Llamada a la acción (CTA){" "}
                  <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="creativo-cta"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder='ej. Compra ahora · 50% dto.'
                  className="mt-1.5 rounded-xl border-[#002147]/25 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <Label htmlFor="creativo-desc" className="text-[#002147]">
                  Descripción (opcional)
                </Label>
                <Textarea
                  id="creativo-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles extra que quieras reflejar en el diseño…"
                  rows={3}
                  className="mt-1.5 resize-none rounded-xl border-[#002147]/25 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              {creativoTab === "static" && (
                <div>
                  <Label htmlFor="creativo-extra" className="text-[#002147]">
                    Instrucciones extra{" "}
                    <span className="font-normal text-slate-500">(opcional)</span>
                  </Label>
                  <Textarea
                    id="creativo-extra"
                    value={extraInstructions}
                    onChange={(e) => setExtraInstructions(e.target.value)}
                    placeholder="Ej. fondo degradado azul noche, sensación premium, sin sombras duras…"
                    rows={2}
                    className="mt-1.5 resize-none rounded-xl border-[#002147]/25 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Se combinan con el análisis automático de tu foto (colores,
                    textos del pack y forma) para el prompt final hacia FLUX.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Paso 3 · Precios{" "}
                {creativoTab === "video"
                  ? "(obligatorios para el guion)"
                  : "(opcional)"}
              </p>
              {creativoTab === "video" && (
                <p className="text-xs leading-relaxed text-amber-900/90">
                  El guion transaccional de 10 s usa el contraste precio
                  tachado / oferta en pantalla. Indica ambos importes con el
                  formato exacto que quieres en el vídeo (ej. 169&nbsp;€).
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="p-orig" className="text-xs text-slate-600">
                    Precio original
                    {creativoTab === "video" && (
                      <span className="text-red-600"> *</span>
                    )}
                  </Label>
                  <Input
                    id="p-orig"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="—"
                    className="mt-1 rounded-xl border-[#002147]/25 bg-white text-sm text-slate-900"
                  />
                </div>
                <div>
                  <Label htmlFor="p-off" className="text-xs text-slate-600">
                    Oferta
                    {creativoTab === "video" && (
                      <span className="text-red-600"> *</span>
                    )}
                  </Label>
                  <Input
                    id="p-off"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder="—"
                    className="mt-1 rounded-xl border-[#002147]/25 bg-white text-sm text-slate-900"
                  />
                </div>
                <div>
                  <Label htmlFor="p-disc" className="text-xs text-slate-600">
                    % dto.
                  </Label>
                  <Input
                    id="p-disc"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                    placeholder="—"
                    className="mt-1 rounded-xl border-[#002147]/25 bg-white text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            {creativoTab === "static" && (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="creativo-output-variant"
                    className="text-[#002147]"
                  >
                    Formato de salida
                  </Label>
                  <select
                    id="creativo-output-variant"
                    value={selectedVariant}
                    onChange={(e) =>
                      setSelectedVariant(e.target.value as CreativoVariant)
                    }
                    disabled={batchRunning || anyAdSlotLoading}
                    className="w-full rounded-xl border border-[#002147]/25 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#C69C2B]/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {VARIANT_ORDER.map((v) => {
                      const m = VARIANT_META[v];
                      return (
                        <option key={v} value={v}>
                          {m.title} · {m.short}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-slate-500">
                    Un anuncio por generación. La elección se guarda en este
                    navegador.
                  </p>
                </div>
                <div className="space-y-2 rounded-xl border border-[#002147]/15 bg-white/80 px-3 py-3">
                  <p className="text-sm font-medium text-[#002147]">
                    Modelo de imagen
                  </p>
                  <p className="text-sm text-slate-800">
                    {CREATIVO_IMAGE_MODEL_OPTIONS[0].label}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {CREATIVO_IMAGE_MODEL_OPTIONS[0].hint}
                  </p>
                </div>
              </>
            )}

            {panelError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {panelError}
              </p>
            )}

            {creativoTab === "static" ? (
              <Button
                type="button"
                disabled={!canGenerate || batchRunning}
                onClick={() => void runGenerateAll()}
                className="h-12 w-full rounded-xl bg-[#C69C2B] text-base font-semibold text-[#002147] hover:bg-[#b38a26] disabled:opacity-45"
              >
                {batchRunning ? (
                  <span className="inline-flex items-center gap-2">
                    <MinervaThinkingLogo size={22} />
                    Generando con IA de alta precisión…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Wand2 className="size-5" />
                    Generar anuncio
                  </span>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canGenerateVideo || videoLoading}
                onClick={() => void runVideoScript()}
                className="h-12 w-full rounded-xl bg-[#C69C2B] text-base font-semibold text-[#002147] hover:bg-[#b38a26] disabled:opacity-45"
              >
                {videoLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <MinervaThinkingLogo size={22} />
                    Generando guion (IA de alta precisión)…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Clapperboard className="size-5" />
                    Generar guion de vídeo (10 s)
                  </span>
                )}
              </Button>
            )}
          </div>
        </section>

        {/* Galería (estáticos) o guion (vídeo) */}
        <section className="flex flex-col bg-white/60 p-6 backdrop-blur-sm lg:p-8">
          {creativoTab === "static" ? (
            <>
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="size-5 text-[#C69C2B]" />
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#002147]">
              Resultado
            </h2>
          </div>

          {batchRunning && (
            <div className="mb-6 overflow-hidden rounded-xl border border-[#C69C2B]/30 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                  <MinervaThinkingLogo size={44} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#002147]">
                    Generando{" "}
                    <span className="text-[#C69C2B]">{progressLabel}</span>{" "}
                    con IA de alta precisión…
                  </p>
                  <p className="text-xs text-slate-600">
                    Primero analizamos tu foto del producto (visión profunda);
                    luego FLUX.1-schnell genera el creativo fiel al pack.
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-full rounded-full bg-[#C69C2B] transition-all duration-500 ease-out" />
              </div>
            </div>
          )}

          {!started && !batchRunning && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#002147]/20 bg-slate-50/50 px-6 py-16 text-center">
              <p className="max-w-md text-sm leading-relaxed text-slate-600">
                Tu anuncio aparecerá aquí. Completa los pasos de la izquierda y
                elige el formato de salida; obtendrás una imagen lista para
                publicar.
              </p>
            </div>
          )}

          {(started || batchRunning) && (
            <div className="grid gap-6 sm:grid-cols-1 xl:grid-cols-1">
              <article className="overflow-hidden rounded-xl border border-[#002147]/10 bg-white shadow-sm">
                <div className="border-b border-[#002147]/10 bg-slate-50/50 px-4 py-3">
                  <h3 className="font-medium text-[#002147]">{resultMeta.title}</h3>
                  <p className="text-xs text-slate-500">{resultMeta.short}</p>
                </div>
                <div className="relative bg-slate-100/60 p-4">
                  {resultSlot.loading ? (
                    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
                      <MinervaThinkingLogo size={44} />
                      <p className="text-sm text-slate-600">
                        Aplicando IA de alta precisión…
                      </p>
                    </div>
                  ) : resultSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resultSrc}
                      alt={resultMeta.title}
                      className="mx-auto max-h-[min(420px,55vh)] w-auto rounded-lg object-contain shadow-md"
                    />
                  ) : (
                    <div className="flex min-h-[120px] items-center justify-center text-sm text-slate-500">
                      Pendiente…
                    </div>
                  )}
                </div>
                <div className="space-y-3 border-t border-[#002147]/10 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor={`edit-${selectedVariant}`}
                        className="text-xs text-slate-500"
                      >
                        Instrucción de edición
                      </Label>
                      <Input
                        id={`edit-${selectedVariant}`}
                        value={resultSlot.editText ?? ""}
                        onChange={(e) =>
                          setAds((s) => ({
                            ...s,
                            [selectedVariant]: {
                              ...s[selectedVariant],
                              editText: e.target.value,
                            },
                          }))
                        }
                        placeholder='ej. "Cambia el fondo a azul marino"'
                        disabled={resultSlot.loading || !resultSlot.base64}
                        className="mt-1 rounded-xl border-[#002147]/25 bg-white text-slate-900 placeholder:text-slate-400 disabled:opacity-50"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        resultSlot.loading ||
                        !resultSlot.base64 ||
                        !product ||
                        batchRunning
                      }
                      onClick={() => void runEdit(selectedVariant)}
                      className="shrink-0 rounded-lg border-[#002147]/20 bg-slate-100 text-[#002147] hover:bg-slate-200"
                    >
                      Editar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        resultSlot.loading || !product || batchRunning
                      }
                      onClick={() => void runRegenerate(selectedVariant)}
                      className="gap-1.5 rounded-lg border-[#002147]/25 text-[#002147] hover:bg-slate-50"
                    >
                      <RefreshCw className="size-3.5" />
                      Regenerar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!resultSlot.base64 || resultSlot.loading}
                      onClick={() =>
                        resultSlot.base64 &&
                        downloadImage(
                          resultSlot.base64,
                          resultSlot.mime ?? "image/png",
                          `creativo-${selectedVariant}-${resultMeta.w}x${resultMeta.h}.png`
                        )
                      }
                      className="gap-1.5 rounded-lg bg-[#C69C2B] text-[#002147] hover:bg-[#b38a26]"
                    >
                      <Download className="size-3.5" />
                      Descargar
                    </Button>
                  </div>
                </div>
              </article>
            </div>
          )}
            </>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clapperboard className="size-5 text-[#C69C2B]" />
                  <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#002147]">
                    Guion y descripción visual
                  </h2>
                </div>
                {videoScript && !videoLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyVideoScript()}
                    className="gap-2 rounded-lg border-[#002147]/25 text-[#002147] hover:bg-slate-50"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4 text-emerald-400" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        Copiar guion
                      </>
                    )}
                  </Button>
                )}
              </div>
              <p className="mb-4 text-xs text-slate-600">
                Formato de referencia:{" "}
                <strong className="text-[#002147]">1080×1920 px</strong> (9:16),
                duración total{" "}
                <strong className="text-[#002147]">10 segundos</strong>. El
                modelo analiza tu foto y redacta escenas con tiempos, cámara,
                luz y música sugerida.
              </p>

              {videoLoading && (
                <div className="mb-6 overflow-hidden rounded-xl border border-[#C69C2B]/30 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-6">
                  <div className="flex items-center gap-3">
                    <MinervaThinkingLogo size={44} className="shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#002147]">
                        Redactando guion transaccional de 10 s (IA de alta
                        precisión)…
                      </p>
                      <p className="text-xs text-slate-600">
                        Analizando la imagen del producto y tus precios.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!videoStarted && !videoLoading && (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#002147]/20 bg-slate-50/50 px-6 py-16 text-center">
                  <p className="max-w-md text-sm leading-relaxed text-slate-600">
                    El guion aparecerá aquí. Completa imagen, nombre, CTA y
                    precios (original y oferta), luego pulsa{" "}
                    <span className="font-medium text-[#C69C2B]">
                      Generar guion de vídeo
                    </span>
                    .
                  </p>
                </div>
              )}

              {videoScript && (
                <article className="rounded-xl border border-[#002147]/10 bg-white p-5 shadow-sm">
                  <ReportBody content={videoScript} />
                </article>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
