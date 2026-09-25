"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { GlobalModelSelector } from "@/components/layout/header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useHubStore } from "@/lib/store";
import type { StockArticulosQueryResultRow } from "@/lib/stock-articulos-atp-query";

type StockArticulosAiResponse = {
  text?: string;
  error?: string;
  interpretacion?: string;
  rows?: StockArticulosQueryResultRow[];
  totalMatches?: number;
  truncated?: boolean;
};

type StockArticulosAiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextHint?: string;
  loadingStock?: boolean;
};

function formatNum(n: number): string {
  return n.toLocaleString("es-ES");
}

export function StockArticulosAiDialog({
  open,
  onOpenChange,
  contextHint,
  loadingStock = false,
}: StockArticulosAiDialogProps) {
  const globalModel = useHubStore((s) => s.globalModel);
  const [pregunta, setPregunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [resultRows, setResultRows] = useState<StockArticulosQueryResultRow[]>(
    []
  );
  const [interpretacion, setInterpretacion] = useState<string | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runAsistente = useCallback(async () => {
    const q = pregunta.trim();
    if (!q) {
      toast.error("Escribe una pregunta.");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setText("");
    setResultRows([]);
    setInterpretacion(null);
    setTotalMatches(null);
    try {
      const res = await fetch("/api/gemini/stock-articulos-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          question: q,
          contextHint: contextHint?.trim() || undefined,
        }),
        signal: ac.signal,
      });
      const data = (await res.json()) as StockArticulosAiResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setText(data.text ?? "");
      setInterpretacion(data.interpretacion ?? null);
      setResultRows(data.rows ?? []);
      setTotalMatches(
        typeof data.totalMatches === "number" ? data.totalMatches : null
      );
      if (data.truncated) {
        toast.message("Resultados truncados — hay más lotes en el conjunto.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      const msg =
        e instanceof Error ? e.message : "No se pudo obtener respuesta.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [contextHint, globalModel, pregunta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[min(90vh,800px)] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <Sparkles className="size-4 text-[#C69C2B]" aria-hidden />
            Asistente Stock artículos
          </DialogTitle>
          <DialogDescription>
            Pregunta en lenguaje natural — consulta sobre producto terminado y
            WIP (no material/palets).
          </DialogDescription>
        </DialogHeader>

        <GlobalModelSelector
          layout="stack"
          className="[&_span]:text-[10px] [&_select]:h-8 [&_select]:text-xs"
        />

        <Textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          rows={3}
          placeholder='Ej. «¿Hay stock terminado de CHMLAB?» · «¿Cuánto hay libre de M-01632?» · «Lotes impresos en hojas» · «OT origen 35519»'
          className="min-h-[4.25rem] resize-y text-sm"
          disabled={loading}
        />

        <Button
          type="button"
          className="bg-[#002147] text-white hover:bg-[#001735]"
          disabled={loading || loadingStock}
          onClick={() => void runAsistente()}
        >
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 size-4" aria-hidden />
          )}
          Preguntar
        </Button>

        {error ? (
          <Alert className="border-red-200 bg-red-50/95 py-2 text-red-950">
            <AlertTitle className="text-xs">No se pudo responder</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        {interpretacion ? (
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Interpretación:</span>{" "}
            {interpretacion}
            {totalMatches != null ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium">
                  {formatNum(totalMatches)} coincidencia
                  {totalMatches !== 1 ? "s" : ""}
                </span>
              </>
            ) : null}
          </p>
        ) : null}

        {text.trim() ? (
          <div className="min-h-0 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2">
            <div className="prose prose-sm prose-slate max-w-none [&_li]:text-sm [&_p]:text-sm [&_p]:my-1.5 [&_table]:text-xs">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          </div>
        ) : null}

        {resultRows.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-xs">Minerva</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Proceso</TableHead>
                  <TableHead className="w-16 text-xs text-right">Libre</TableHead>
                  <TableHead className="w-16 text-xs text-right">Físico</TableHead>
                  <TableHead className="w-14 text-xs">Ud.</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {r.referencia_codigo}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">
                      {r.cliente ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {r.proceso}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatNum(r.libre)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatNum(r.fisico)}
                    </TableCell>
                    <TableCell className="text-xs">{r.unidad}</TableCell>
                    <TableCell className="text-xs capitalize">{r.estado}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
