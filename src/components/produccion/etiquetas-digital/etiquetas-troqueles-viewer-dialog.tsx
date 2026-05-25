"use client";

import {
  AlertTriangle,
  Copy,
  Eye,
  FolderSearch,
  Loader2,
  Printer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProdEtiquetasTroquelRow } from "@/types/prod-etiquetas-troqueles";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  troquel: ProdEtiquetasTroquelRow | null;
};
type FolderMatchType = "exact" | "normalized" | "byCode";

function buildFileUrl(troquelId: number, archivo: string): string {
  return `/api/etiquetas-digital/troquel-archivo?troquel_id=${encodeURIComponent(troquelId)}&archivo=${encodeURIComponent(archivo)}`;
}

function buildListUrl(troquelId: number): string {
  return `/api/etiquetas-digital/troquel-archivo?troquel_id=${encodeURIComponent(troquelId)}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Ruta copiada al portapapeles.");
  } catch {
    toast.error("No se pudo copiar. Copia manualmente.");
  }
}

export function EtiquetasTroquelesViewerDialog({
  open,
  onOpenChange,
  troquel,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderMatchType, setFolderMatchType] =
    useState<FolderMatchType>("exact");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const revokeBlobUrl = useCallback(() => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const loadFilePreview = useCallback(
    async (archivo: string) => {
      if (!troquel?.id) return;

      revokeBlobUrl();
      setLoading(true);
      setError(null);
      setResolvedPath(null);
      setSelectedFile(archivo);

      try {
        const url = buildFileUrl(troquel.id, archivo);
        const res = await fetch(url);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            typeof body.error === "string"
              ? body.error
              : `No se pudo cargar el archivo (${res.status}).`;
          setError(msg);
          setBlobUrl(null);
          return;
        }

        const resolvedEnc = res.headers.get("X-Resolved-Path");
        const resolved = resolvedEnc ? decodeURIComponent(resolvedEnc) : null;
        setResolvedPath(resolved);
        const matchType = res.headers.get("X-Folder-Match-Type");
        if (
          matchType === "exact" ||
          matchType === "normalized" ||
          matchType === "byCode"
        ) {
          setFolderMatchType(matchType);
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setBlobUrl(blobUrl);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo cargar el archivo del troquel."
        );
        setBlobUrl(null);
      } finally {
        setLoading(false);
      }
    },
    [troquel, revokeBlobUrl]
  );

  const loadFileList = useCallback(async () => {
    if (!troquel?.id) return;

    revokeBlobUrl();
    setFiles([]);
    setSelectedFile(null);
    setError(null);
    setListError(null);
    setResolvedPath(null);
    setFolderPath(null);
    setFolderMatchType("exact");
    setListLoading(true);

    try {
      const res = await fetch(buildListUrl(troquel.id));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body.error === "string"
            ? body.error
            : `No se pudo listar la carpeta (${res.status}).`;
        setListError(msg);
        setFolderPath(
          typeof body.localizarHint === "string" ? body.localizarHint : null
        );
        return;
      }

      const nextFiles = Array.isArray(body.files)
        ? body.files
            .map((file: { name?: unknown }) =>
              typeof file.name === "string" ? file.name.trim() : ""
            )
            .filter(Boolean)
        : [];

      setFiles(nextFiles);
      setFolderPath(typeof body.folderPath === "string" ? body.folderPath : null);
      setFolderMatchType(
        body.folderMatchType === "normalized" ||
          body.folderMatchType === "byCode"
          ? body.folderMatchType
          : "exact"
      );

      if (nextFiles.length === 1) {
        await loadFilePreview(nextFiles[0]);
      }
    } catch (e) {
      setListError(
        e instanceof Error
          ? e.message
          : "No se pudo listar la carpeta del troquel."
      );
    } finally {
      setListLoading(false);
    }
  }, [troquel, revokeBlobUrl, loadFilePreview]);

  useEffect(() => {
    if (open && troquel) {
      void loadFileList();
    } else if (!open) {
      revokeBlobUrl();
      setFiles([]);
      setSelectedFile(null);
      setError(null);
      setListError(null);
      setResolvedPath(null);
      setFolderPath(null);
      setFolderMatchType("exact");
    }
  }, [open, troquel, loadFileList, revokeBlobUrl]);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      revokeBlobUrl();
      setFiles([]);
      setSelectedFile(null);
      setError(null);
      setListError(null);
      setResolvedPath(null);
      setFolderPath(null);
      setFolderMatchType("exact");
    }
    onOpenChange(nextOpen);
  }

  function printInModal() {
    const w = iframeRef.current?.contentWindow;
    if (w) w.print();
    else toast.info("Selecciona un archivo o espera a que cargue.");
  }

  const copyTarget = useMemo(() => {
    if (resolvedPath?.trim()) return resolvedPath.trim();
    if (folderPath?.trim() && !selectedFile) return folderPath.trim();
    if (troquel?.carpeta_original && selectedFile) {
      return `[ROOT]\\${troquel.carpeta_original}\\${selectedFile}`;
    }
    return "";
  }, [resolvedPath, folderPath, troquel, selectedFile]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,920px)] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 pr-14">
          <DialogTitle className="text-left text-[#002147]">
            Visor de troquel de etiquetas
            {troquel?.codigo ? ` · ${troquel.codigo}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-3 py-3 sm:px-4">
          {listLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="size-10 animate-spin text-[#002147]/50" />
            </div>
          ) : listError ? (
            <div
              className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-10 text-center"
              role="alert"
            >
              <AlertTriangle
                className="size-14 shrink-0 text-amber-500"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="max-w-lg text-sm leading-relaxed text-slate-700">
                {listError}
              </p>
              {folderPath ? (
                <p className="max-w-xl font-mono text-[10px] leading-snug text-slate-400 break-all">
                  Carpeta intentada: {folderPath}
                </p>
              ) : null}
            </div>
          ) : files.length === 0 ? (
            <div
              className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-10 text-center"
              role="alert"
            >
              <AlertTriangle
                className="size-14 shrink-0 text-amber-500"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="max-w-lg text-sm leading-relaxed text-slate-700">
                No hay archivos PDF o imagen en la carpeta de este troquel.
              </p>
              {folderPath ? (
                <p className="max-w-xl font-mono text-[10px] leading-snug text-slate-400 break-all">
                  Carpeta: {folderPath}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {folderMatchType !== "exact" ? (
                <Alert className="border-amber-200 bg-amber-50/95 text-amber-950">
                  <AlertTitle className="text-sm">
                    Carpeta encontrada por{" "}
                    {folderMatchType === "byCode" ? "código" : "nombre normalizado"}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    La carpeta real no coincide exactamente con la carpeta guardada
                    en el catálogo. El visor la ha localizado automáticamente.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid min-h-[min(62vh,680px)] gap-3 md:grid-cols-[minmax(0,15rem)_1fr]">
                <div className="flex max-h-[min(62vh,680px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <p className="shrink-0 border-b border-slate-100 px-2 py-1.5 text-[11px] font-semibold text-[#002147]">
                    Archivos ({files.length})
                  </p>
                  <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
                    {files.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => void loadFilePreview(name)}
                          className={cn(
                            "w-full rounded px-2 py-1.5 text-left font-mono text-[11px] break-all transition-colors",
                            selectedFile === name
                              ? "bg-[#002147]/12 text-[#002147]"
                              : "hover:bg-slate-50"
                          )}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

              <div className="relative flex min-h-[min(58vh,620px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {loading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85">
                    <Loader2 className="size-9 animate-spin text-[#002147]/50" />
                  </div>
                ) : null}

                {error ? (
                  <Alert className="m-3 shrink-0 border-amber-200 bg-amber-50/95">
                    <AlertTitle className="text-sm">
                      No se pudo cargar el archivo
                    </AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                ) : null}

                {blobUrl ? (
                  <iframe
                    ref={iframeRef}
                    title={`Troquel ${troquel?.codigo ?? ""}`}
                    src={blobUrl}
                    className="min-h-[min(54vh,580px)] w-full flex-1 border-0 bg-white"
                  />
                ) : !loading && files.length > 1 && !blobUrl ? (
                  <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Selecciona un archivo en la lista para previsualizarlo.
                  </div>
                ) : null}
              </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-[#002147]/25"
                disabled={!copyTarget}
                onClick={() => {
                  if (copyTarget) void copyToClipboard(copyTarget);
                  else toast.info("Selecciona primero un archivo.");
                }}
              >
                <Copy className="size-4" aria-hidden />
                Copiar ruta
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 border-[#002147]/20"
                disabled={!copyTarget}
                onClick={() => {
                  if (copyTarget) void copyToClipboard(copyTarget);
                  else toast.info("Selecciona primero un archivo.");
                }}
              >
                <FolderSearch className="size-4" aria-hidden />
                Localizar en Red
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cerrar
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#C69C2B]/90"
                disabled={!blobUrl}
                onClick={() => printInModal()}
              >
                <Printer className="size-4" aria-hidden />
                Imprimir
              </Button>
            </div>
          </div>

          {resolvedPath ? (
            <div className="border-t border-slate-100 pt-2">
              <p className="font-mono text-[10px] text-muted-foreground break-all">
                <span className="text-slate-500">Archivo resuelto (servidor):</span>{" "}
                {resolvedPath}
              </p>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
