"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppMode, useHubStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  mode: AppMode;
  originalReport: string | null;
};

export function DeepDiveChat({ mode, originalReport }: Props) {
  const appendChat = useHubStore((s) => s.appendChat);
  const history = useHubStore((s) =>
    mode === "strategic"
      ? s.chatStrategic
      : mode === "pmax"
        ? s.chatPmax
        : mode === "slides"
          ? s.chatSlides
          : []
  );

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  if (!originalReport?.trim()) return null;

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    appendChat(mode, { role: "user", content: q });
    setInput("");
    setLoading(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalReport,
          question: q,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ctrl.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en el chat");

      appendChat(mode, { role: "model", content: data.text as string });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      appendChat(mode, {
        role: "model",
        content:
          e instanceof Error
            ? `No se pudo completar la respuesta: ${e.message}`
            : "Error desconocido.",
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <Card className="mt-10 overflow-hidden border-[#002147]/15 shadow-sm">
      <CardHeader className="border-b border-[#002147]/10 bg-gradient-to-r from-[#002147]/[0.06] to-transparent py-4">
        <CardTitle className="font-[family-name:var(--font-heading)] text-lg text-[#002147]">
          🗨️ PROFUNDIZAR EN EL ANÁLISIS
        </CardTitle>
        <p className="text-muted-foreground text-sm font-normal">
          Preguntas con contexto del informe y del historial (estilo estudio de
          IA). Las respuestas usan Gemini con el informe completo.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[min(420px,50vh)] bg-slate-50/80">
          <div className="space-y-3 p-4">
            {history.length === 0 && (
              <p className="text-muted-foreground text-center text-sm">
                Escribe una pregunta sobre el informe mostrado arriba.
              </p>
            )}
            {history.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "rounded-br-md bg-[#002147] text-white"
                      : "rounded-bl-md border border-slate-200/80 bg-white text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-muted-foreground flex justify-start text-sm">
                <span className="rounded-2xl rounded-bl-md border bg-white px-4 py-2">
                  Generando respuesta…
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="flex gap-2 border-t border-[#002147]/10 bg-white p-3">
          <Textarea
            placeholder="Escribe tu pregunta…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[44px] flex-1 resize-none rounded-xl border-[#002147]/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={loading}
          />
          <Button
            type="button"
            size="icon-lg"
            className="shrink-0 rounded-xl bg-[#C69C2B] text-[#002147] hover:bg-[#b38a26]"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            aria-label="Enviar"
          >
            <Send className="size-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
