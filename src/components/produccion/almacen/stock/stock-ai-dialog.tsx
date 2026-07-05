"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useHubStore } from "@/lib/store";
import { costeRemanentePalet } from "@/lib/stock-valoracion";
import type { StockPaletAtpConOts } from "@/types/prod-stock";

export function buildStockAsistentePayload(rows: StockPaletAtpConOts[]) {
  return rows.map((r) => ({
    id_stock: r.id_stock,
    codigo: r.codigo_articulo,
    material: r.material_nombre ?? r.descripcion_material,
    gramaje: r.gramaje,
    formato: r.formato,
    libre: r.cantidad_libre,
    reservado: r.cantidad_reservada_total,
    fisico: r.cantidad_fisica,
    unidad: r.unidad,
    ots: r.ots.map((o) => o.ot_numero),
    reservas: r.ots
      .filter((o) => o.cantidad_reservada != null && o.cantidad_reservada > 0)
      .map((o) => ({ ot: o.ot_numero, h: o.cantidad_reservada })),
    estado: r.estado_derivado,
    ubicacion: r.ubicacion_fila,
    coste_eur: costeRemanentePalet(
      r.coste,
      r.cantidad_inicial,
      r.cantidad_fisica,
    ),
    coste_compra_eur: r.coste,
    albaran: r.nota_entrega,
    proveedor: r.proveedor_nombre,
  }));
}

type StockAiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: StockPaletAtpConOts[];
  loadingStock?: boolean;
};

export function StockAiDialog({
  open,
  onOpenChange,
  rows,
  loadingStock = false,
}: StockAiDialogProps) {
  const globalModel = useHubStore((s) => s.globalModel);
  const [pregunta, setPregunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const payload = useMemo(() => buildStockAsistentePayload(rows), [rows]);

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
    try {
      const res = await fetch("/api/gemini/stock-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          rows: payload,
          question: q,
        }),
        signal: ac.signal,
      });
      const data = (await res.json()) as {
        text?: string;
        error?: string;
        truncated?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setText(data.text ?? "");
      if (data.truncated) {
        toast.message("Listado truncado en el contexto IA (máx. 350 palets).");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "No se pudo obtener respuesta.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [globalModel, payload, pregunta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,720px)] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <Sparkles className="size-4 text-[#C69C2B]" aria-hidden />
            Asistente Stock
          </DialogTitle>
          <DialogDescription>
            Pregunta sobre el listado filtrado actual ({rows.length} palet
            {rows.length !== 1 ? "s" : ""}).
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
          placeholder='Ej. «¿Hay folding 300 gr 65×92 con más de 1.500 h libres?» · «Palets sin OT con más de 2.000 h»'
          className="min-h-[4.25rem] resize-y text-sm"
          disabled={loading}
        />

        <Button
          type="button"
          className="bg-[#002147] text-white hover:bg-[#001735]"
          disabled={loading || loadingStock || rows.length === 0}
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

        {text.trim() ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2">
            <div className="prose prose-sm prose-slate max-w-none [&_li]:text-sm [&_p]:text-sm [&_p]:my-1.5">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
