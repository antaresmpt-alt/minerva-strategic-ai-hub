"use client";

import {
  Database,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type IngestPdfStreamMsg =
  | { type: "progress"; percent: number; step: string }
  | { type: "complete"; chunksProcessed: number; source: string }
  | { type: "error"; message: string };

type RagDocumentSummary = { nombre: string; chunks: number };

export function IngestKnowledgeTab() {
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [chunksSaved, setChunksSaved] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [pdfSource, setPdfSource] = useState("");
  const [pdfStatus, setPdfStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState("");
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [docsSheetOpen, setDocsSheetOpen] = useState(false);
  const [ragDocuments, setRagDocuments] = useState<RagDocumentSummary[]>([]);
  const [ragDocsLoading, setRagDocsLoading] = useState(false);
  const [ragDocsError, setRagDocsError] = useState<string | null>(null);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  const fetchRagDocuments = useCallback(async () => {
    setRagDocsLoading(true);
    setRagDocsError(null);
    try {
      const res = await fetch("/api/rag-documents");
      const data = (await res.json()) as {
        documents?: RagDocumentSummary[];
        error?: string;
      };
      if (!res.ok) {
        setRagDocsError(data.error ?? `Error ${res.status}`);
        setRagDocuments([]);
        return;
      }
      setRagDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      setRagDocsError("No se pudo cargar la lista.");
      setRagDocuments([]);
    } finally {
      setRagDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!docsSheetOpen) return;
    void fetchRagDocuments();
  }, [docsSheetOpen, fetchRagDocuments]);

  async function handleDeleteRagDocument(nombre: string) {
    const ok = window.confirm(
      `¿Eliminar todos los fragmentos vectoriales de «${nombre}»? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setDeletingSource(nombre);
    setRagDocsError(null);
    try {
      const res = await fetch(
        `/api/rag-documents?source=${encodeURIComponent(nombre)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { error?: string; deleted?: number };
      if (!res.ok) {
        setRagDocsError(data.error ?? `Error ${res.status}`);
        return;
      }
      await fetchRagDocuments();
    } catch {
      setRagDocsError("No se pudo eliminar el documento.");
    } finally {
      setDeletingSource(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("processing");
    setMessage(null);
    setChunksSaved(null);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(
          typeof data.error === "string" ? data.error : "Error al procesar"
        );
        if (typeof data.chunksSaved === "number") {
          setChunksSaved(data.chunksSaved);
        }
        return;
      }

      const n =
        typeof data.chunksProcessed === "number" ? data.chunksProcessed : 0;
      setChunksSaved(n);
      setStatus("success");
      setMessage(
        `Se han guardado correctamente ${n} párrafo${n === 1 ? "" : "s"} (chunks) en la base vectorial.`
      );
    } catch {
      setStatus("error");
      setMessage("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  }

  const ingestPdfStream = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", pdfSource.trim() || file.name);

    const res = await fetch("/api/ingest-pdf", {
      method: "POST",
      body: formData,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      let msg = `Error ${res.status}`;
      try {
        const j = JSON.parse(errText) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        if (errText) msg = errText;
      }
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as IngestPdfStreamMsg;
        if (msg.type === "progress") {
          setPdfProgress(msg.percent);
          setPdfStep(msg.step);
        } else if (msg.type === "complete") {
          setPdfProgress(100);
          setPdfStep("Completado");
          setPdfMessage(
            `Ingesta permanente: ${msg.chunksProcessed} chunk(s) guardados en \`minerva_documents\` (origen: ${msg.source}).`
          );
          setPdfStatus("success");
        } else if (msg.type === "error") {
          throw new Error(msg.message);
        }
      }
    }
  }, [pdfSource]);

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = pdfInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setPdfStatus("error");
      setPdfMessage("Selecciona un archivo PDF.");
      return;
    }

    setPdfStatus("processing");
    setPdfMessage(null);
    setPdfProgress(0);
    setPdfStep("Iniciando…");

    try {
      await ingestPdfStream(file);
    } catch (err) {
      setPdfStatus("error");
      setPdfMessage(
        err instanceof Error ? err.message : "Error al ingerir el PDF."
      );
      setPdfProgress(0);
      setPdfStep("");
    } finally {
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="inline-flex items-center rounded-md border border-amber-600/40 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Uso interno — ingesta RAG (Supabase)
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ingesta de texto manual o PDF permanente en Supabase (vectorización).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => setDocsSheetOpen(true)}
        >
          <Database className="size-4 opacity-80" aria-hidden />
          Ver documentos subidos
        </Button>
      </div>

      <Sheet open={docsSheetOpen} onOpenChange={setDocsSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-xl"
          showCloseButton
        >
          <SheetHeader className="border-b border-border pb-4 text-left">
            <SheetTitle>Documentos en Base de Datos</SheetTitle>
            <SheetDescription>
              Chunks agrupados por origen en{" "}
              <code className="rounded bg-muted px-1 text-xs">minerva_documents</code>{" "}
              (PDF y texto manual).
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {ragDocsLoading ? (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[min(100%,14rem)]" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : ragDocsError ? (
              <p className="text-sm text-destructive" role="alert">
                {ragDocsError}
              </p>
            ) : ragDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay documentos con origen en metadata, o la tabla está vacía.
              </p>
            ) : (
              <ul className="space-y-2">
                {ragDocuments.map((doc) => (
                  <li
                    key={doc.nombre}
                    className="flex items-end gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                  >
                    <FileText
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {doc.nombre}
                      </p>
                      <Badge variant="outline" className="mt-1 font-normal text-muted-foreground">
                        ({doc.chunks} fragmento
                        {doc.chunks === 1 ? "" : "s"})
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-[#b91c1c] hover:bg-[#b91c1c]/10 hover:text-[#991b1b] dark:text-red-400 dark:hover:bg-red-950/50"
                      title={`Eliminar todos los fragmentos de ${doc.nombre}`}
                      disabled={deletingSource === doc.nombre}
                      onClick={() => void handleDeleteRagDocument(doc.nombre)}
                      aria-label={`Eliminar ${doc.nombre}`}
                    >
                      {deletingSource === doc.nombre ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Ingesta permanente de PDF
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El PDF se procesa en el servidor (pdf-parse), se estructura en Markdown
          con Gemini           y se vectoriza en la tabla{" "}
          <code className="rounded bg-muted px-1 text-xs">minerva_documents</code>.
        </p>

        <form onSubmit={handlePdfSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="pdf-source-settings"
              className="text-sm font-medium text-foreground"
            >
              Nombre de origen / documento
            </label>
            <input
              id="pdf-source-settings"
              type="text"
              value={pdfSource}
              onChange={(e) => setPdfSource(e.target.value)}
              placeholder="ej. ALASKA-STRONG_ficha.pdf (vacío = nombre del archivo)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px]"
              disabled={pdfStatus === "processing"}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Archivo PDF
            </label>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              disabled={pdfStatus === "processing"}
            />
          </div>

          <button
            type="submit"
            disabled={pdfStatus === "processing"}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {pdfStatus === "processing"
              ? "Procesando PDF…"
              : "Ingerir PDF en base vectorial"}
          </button>

          {pdfStatus === "processing" && (
            <div className="space-y-2" aria-live="polite">
              <progress
                className="h-2 w-full overflow-hidden rounded-full accent-[#002147]"
                value={pdfProgress}
                max={100}
              />
              <p className="text-xs text-muted-foreground">
                {pdfProgress}% — {pdfStep}
              </p>
            </div>
          )}

          {pdfStatus === "success" && pdfMessage && (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
              role="status"
            >
              {pdfMessage}
            </p>
          )}

          {pdfStatus === "error" && pdfMessage && (
            <p className="text-destructive text-sm" role="alert">
              {pdfMessage}
            </p>
          )}
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Ingesta por texto (manual)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pega el manual y asigna un nombre de origen. Se guarda en{" "}
          <code className="rounded bg-muted px-1 text-xs">minerva_documents</code>{" "}
          vía <code className="rounded bg-muted px-1 text-xs">/api/ingest</code>.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label
              htmlFor="source-settings"
              className="text-sm font-medium text-foreground"
            >
              Nombre del Documento / Origen
            </label>
            <input
              id="source-settings"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="ej. Manual_Tolerancias.txt"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px]"
              required
              disabled={status === "processing"}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="text-settings"
              className="text-sm font-medium text-foreground"
            >
              Contenido del manual
            </label>
            <textarea
              id="text-settings"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Pega aquí el texto completo. Los párrafos se separan por líneas en blanco (doble salto de línea)."
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed shadow-xs outline-none ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px]"
              disabled={status === "processing"}
            />
          </div>

          <button
            type="submit"
            disabled={status === "processing"}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {status === "processing" ? "Procesando…" : "Procesar y Vectorizar"}
          </button>

          {status === "processing" && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Procesando… generando embeddings y guardando en la base de datos.
            </p>
          )}

          {status === "success" && message && (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
              role="status"
            >
              {message}
            </p>
          )}

          {status === "error" && message && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <p>{message}</p>
              {chunksSaved !== null && chunksSaved > 0 && (
                <p className="mt-1 text-muted-foreground">
                  Parcialmente guardados antes del error: {chunksSaved}{" "}
                  chunk(s).
                </p>
              )}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
