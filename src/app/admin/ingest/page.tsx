"use client";

import { useState } from "react";

export default function AdminIngestPage() {
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [chunksSaved, setChunksSaved] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-2 inline-flex items-center rounded-md border border-amber-600/40 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Uso interno — no enlazar desde producción pública
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Panel de Ingesta de Conocimiento (RAG)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pega el manual y asigna un nombre de origen para vectorizar y almacenar
          en Supabase.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label
              htmlFor="source"
              className="text-sm font-medium text-foreground"
            >
              Nombre del Documento / Origen
            </label>
            <input
              id="source"
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
              htmlFor="text"
              className="text-sm font-medium text-foreground"
            >
              Contenido del manual
            </label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
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
                  Parcialmente guardados antes del error: {chunksSaved} chunk(s).
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
