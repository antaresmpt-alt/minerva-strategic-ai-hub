"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { FileText, Menu, MessageSquare, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DefaultChatTransport, type UIMessage } from "ai";

import { chatApiFetch } from "@/lib/chat-json-error-to-stream";

import { MinervaThinkingLogo } from "@/components/brand/minerva-thinking-logo";
import { SemContactFooter } from "@/components/layout/sem-contact-footer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MOCK_CHATS = [
  { id: "mock-1", title: "Normativa interna (demo)", updated: "Hoy" },
  { id: "mock-2", title: "Borrador email cliente", updated: "Ayer" },
  { id: "mock-3", title: "Glosario packaging", updated: "Esta semana" },
] as const;

function textFromParts(message: UIMessage): string {
  return message.parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof (p as { text?: string }).text === "string"
    )
    .map((p) => p.text)
    .join("");
}

function ChatSidebarNav({
  onPickChat,
  showSettingsLink,
}: {
  onPickChat?: () => void;
  showSettingsLink: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-3 rounded-lg bg-[#C69C2B] px-3 py-2.5 text-[#002147]">
        <MessageSquare className="size-4 shrink-0 opacity-90" />
        <span className="text-sm font-medium">Minerva AI Assistant</span>
      </div>
      <p className="px-3 pt-4 pb-1 text-[10px] tracking-wide text-white/45 uppercase">
        Historial
      </p>
      <nav className="flex flex-col gap-1">
        {MOCK_CHATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={onPickChat}
            className="rounded-lg px-3 py-2.5 text-left text-sm text-white/90 transition hover:bg-white/10"
          >
            <span className="line-clamp-2 font-medium">{c.title}</span>
            <span className="mt-0.5 block text-xs text-white/50">{c.updated}</span>
          </button>
        ))}
      </nav>
      <div className="mt-4 space-y-2 px-1">
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/35 bg-emerald-950/25 px-3 py-2.5">
          <span
            className="mt-1 size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
            title="Activa"
            aria-hidden
          />
          <p className="text-xs leading-snug text-white/90">
            Base de conocimiento RAG (Supabase).
            {showSettingsLink
              ? " Para añadir PDFs de forma permanente, usa Configuración → Ingesta."
              : " La ingesta de documentos la gestiona el equipo de administración."}
          </p>
        </div>
        {showSettingsLink && (
          <Link
            href="/settings?tab=ingest"
            className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white/90 transition hover:bg-white/15"
          >
            <FileText className="size-4 shrink-0 opacity-90" aria-hidden />
            <span className="font-medium leading-tight">
              Configuración — Ingesta
            </span>
          </Link>
        )}
      </div>
    </>
  );
}

export function MinervaChatPage({
  showSettingsLink,
}: {
  showSettingsLink: boolean;
}) {
  const [input, setInput] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        fetch: chatApiFetch,
      }),
    []
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, scrollToBottom]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const showTyping =
    status === "submitted" ||
    (status === "streaming" &&
      (last?.role !== "assistant" || textFromParts(last).trim() === ""));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSubmit(e);
    }
  }

  const closeSheet = () => setSheetOpen(false);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Móvil: barra superior tipo SEM */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#002147]/15 bg-[#002147] p-2 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-white hover:bg-white/10"
                aria-label="Menú"
              />
            }
          >
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[min(100%,300px)] flex-col border-[#002147] bg-[#002147] p-0 text-white"
            showCloseButton
          >
            <SheetHeader className="border-b border-white/10 px-4 py-4 text-left">
              <SheetTitle className="font-heading text-white">
                Minerva Chat
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              <ChatSidebarNav
                onPickChat={closeSheet}
                showSettingsLink={showSettingsLink}
              />
            </div>
            <div className="mt-auto border-t border-white/10 p-4">
              <Link
                href="/"
                onClick={closeSheet}
                className="text-xs font-medium text-[#C69C2B]/95 underline-offset-4 hover:text-white hover:underline"
              >
                ← Volver al portal
              </Link>
            </div>
          </SheetContent>
        </Sheet>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          Minerva AI Assistant
        </span>
        <Link
          href="/"
          className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-[#C69C2B] hover:text-white"
        >
          Portal
        </Link>
      </div>

      {/* Desktop: barra lateral SEM */}
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
        <p className="px-5 font-[family-name:var(--font-heading)] text-xs leading-snug tracking-wide text-[#C69C2B]/95 uppercase">
          Strategic AI Hub
        </p>
        <Separator className="my-4 bg-white/15" />
        <div className="flex flex-1 flex-col gap-1 px-3">
          <ChatSidebarNav showSettingsLink={showSettingsLink} />
        </div>
        <div className="mt-auto space-y-3 p-4">
          <Link
            href="/"
            className="block text-xs font-medium text-[#C69C2B]/95 underline-offset-4 hover:text-white hover:underline"
          >
            ← Volver al portal
          </Link>
          <p className="text-[10px] leading-relaxed text-white/55">
            Respuestas concisas.
            {showSettingsLink
              ? " Los PDFs se ingieren desde Configuración → Ingesta de conocimiento."
              : " La ingesta de PDFs la coordina administración."}
          </p>
        </div>
      </aside>

      {/* Área principal con mármol (misma pila que SEM) */}
      <div className="relative isolate flex min-h-0 min-h-dvh flex-1 flex-col md:min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div className="sem-workspace-marble" />
          <div className="sem-workspace-overlay" />
        </div>

        <header className="relative z-10 border-b border-[#002147]/10 bg-white/80 px-4 py-6 shadow-sm backdrop-blur-md md:px-10">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#002147] md:text-3xl">
            Minerva AI Assistant
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Asistente corporativo para consultas generales, redacción y soporte.
            Respuestas breves y profesionales, alineadas con Minerva Global.
          </p>
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col px-4 py-6 md:px-10 md:py-8">
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="mx-auto max-w-3xl space-y-4 pb-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#002147]/20 bg-white/50 px-4 py-8 text-center text-sm leading-relaxed text-slate-600 backdrop-blur-sm">
                  Escribe una consulta. Minerva AI responde de forma breve y
                  profesional, alineada con el tono corporativo de Minerva
                  Global.
                </div>
              )}

              {messages.map((m) => {
                const text = textFromParts(m);
                const isUser = m.role === "user";
                if (!isUser && text.trim() === "" && busy) {
                  return null;
                }
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[min(100%,36rem)] rounded-2xl px-4 py-3 text-sm shadow-sm",
                        isUser
                          ? "rounded-br-md bg-[#002147] text-white"
                          : "rounded-bl-md border border-slate-200/90 bg-white/90 text-foreground backdrop-blur-sm"
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{text}</p>
                      ) : (
                        <div className="prose prose-sm prose-slate max-w-none dark:prose-invert [&_p]:my-2 [&_ul]:my-2">
                          <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {showTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 backdrop-blur-sm">
                    <MinervaThinkingLogo size={28} />
                    Generando…
                  </div>
                </div>
              )}

              {error && (
                <p className="text-destructive text-center text-sm" role="alert">
                  {error.message}
                </p>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="relative z-10 mt-4 shrink-0 border-t border-[#002147]/10 bg-white/85 px-0 py-4 backdrop-blur-md md:mt-6">
            <form
              onSubmit={onSubmit}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje… (Enter envía, Shift+Enter salto)"
                disabled={busy}
                rows={1}
                className="min-h-11 max-h-[200px] resize-none rounded-xl border-[#002147]/25 bg-white/90 py-3 text-sm"
              />
              {busy ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 rounded-xl px-3"
                  onClick={() => void stop()}
                >
                  Detener
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon-lg"
                  disabled={!input.trim()}
                  className="shrink-0 rounded-xl bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#b38a26]"
                  aria-label="Enviar"
                >
                  <Send className="size-5" />
                </Button>
              )}
            </form>
          </div>
        </main>

        <SemContactFooter />
      </div>
    </div>
  );
}
