"use client";

import { Camera, Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

async function descargarFoto(url: string, baseName: string, index: number) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  const blob = await res.blob();
  const ext =
    blob.type.includes("png")
      ? "png"
      : blob.type.includes("webp")
        ? "webp"
        : "jpg";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}-foto-${index + 1}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export type RecepcionFotosPanelProps = {
  urls: string[];
  /** Etiqueta secundaria (albarán, OT, etc.) */
  subtitle?: string | null;
  /** compact = solo botón; inline = miniaturas en fila */
  variant?: "compact" | "inline";
  className?: string;
};

export function RecepcionFotosPanel({
  urls,
  subtitle,
  variant = "compact",
  className,
}: RecepcionFotosPanelProps) {
  const [open, setOpen] = useState(false);
  const uniqueUrls = useMemo(
    () => [...new Set(urls.map((u) => u.trim()).filter(Boolean))],
    [urls]
  );

  if (uniqueUrls.length === 0) return null;

  const baseName = (subtitle ?? "recepcion")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 96);

  return (
    <>
      {variant === "inline" ? (
        <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
          {uniqueUrls.slice(0, 3).map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setOpen(true)}
              className="size-14 rounded-md border border-slate-200 overflow-hidden bg-white hover:ring-2 hover:ring-blue-200 transition-shadow"
              title="Ver fotos del muelle"
            >
              <img
                src={url}
                alt={`Foto muelle ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
          {uniqueUrls.length > 3 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setOpen(true)}
            >
              +{uniqueUrls.length - 3} más
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => setOpen(true)}
            >
              <Camera className="size-3" />
              Ver fotos ({uniqueUrls.length})
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`h-8 text-xs gap-1.5 ${className ?? ""}`}
          onClick={() => setOpen(true)}
        >
          <Camera className="size-3.5" />
          Fotos muelle ({uniqueUrls.length})
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,760px)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base font-normal text-[#002147]">
              Fotos de recepción (muelle)
            </DialogTitle>
            <DialogDescription className="text-xs font-normal">
              {subtitle ? <span>{subtitle}</span> : null}
              {subtitle ? " · " : null}
              {uniqueUrls.length} imagen
              {uniqueUrls.length === 1 ? "" : "es"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[12rem] flex-1 overflow-y-auto px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {uniqueUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="rounded-lg border border-slate-200/90 bg-slate-50/90 p-2 shadow-xs"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-white">
                    <img
                      src={url}
                      alt={`Foto recepción ${i + 1}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 font-normal"
                      onClick={() => {
                        void descargarFoto(url, baseName, i).catch(() => {
                          toast.error("No se pudo descargar la imagen.");
                        });
                      }}
                    >
                      <Download className="size-3.5" />
                      Descargar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-100 px-4 py-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RecepcionFotosPanelLoading() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <Loader2 className="size-3 animate-spin" />
      Fotos…
    </span>
  );
}
