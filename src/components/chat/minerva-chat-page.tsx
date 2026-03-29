"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { History, Menu, PanelLeftClose, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";

import { MinervaThinkingLogo } from "@/components/brand/minerva-thinking-logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button-variants";
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

function SidebarBody({
  onSelectMock,
}: {
  onSelectMock?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Historial
      </p>
      <nav className="flex flex-1 flex-col gap-1">
        {MOCK_CHATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={onSelectMock}
            className="hover:bg-muted/80 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition-colors"
          >
            <span className="text-foreground line-clamp-2 font-medium">
              {c.title}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              {c.updated}
            </span>
          </button>
        ))}
      </nav>
      <Button
        type="button"
        variant="secondary"
        className="h-auto min-h-10 w-full flex-col gap-0.5 py-2.5 text-center whitespace-normal"
        disabled
      >
        <span>📚 Base de Conocimiento (PDFs)</span>
        <span className="text-muted-foreground text-xs font-normal">
          Próximamente
        </span>
      </Button>
    </div>
  );
}

export function MinervaChatPage() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat();

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
      (last?.role !== "assistant" ||
        textFromParts(last).trim() === ""));

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

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border flex shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-4">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label="Abrir historial"
              />
            }
          >
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[min(100%,280px)] flex-col p-0">
            <SheetHeader className="border-border border-b px-4 py-3 text-left">
              <SheetTitle className="font-heading text-[#002147]">
                Minerva Chat
              </SheetTitle>
            </SheetHeader>
            <SidebarBody onSelectMock={() => {}} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[#002147]/15">
            <Image
              src="/images/module-chatbot.png"
              alt=""
              fill
              className="object-cover object-center"
              sizes="36px"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-[#002147] truncate text-base font-semibold sm:text-lg">
              Minerva AI Assistant
            </h1>
            <p className="text-muted-foreground truncate text-xs sm:text-sm">
              Asistente corporativo · respuestas concisas
            </p>
          </div>
        </div>

        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden shrink-0 sm:inline-flex"
          )}
        >
          <PanelLeftClose className="mr-1 size-4" />
          Portal
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "sm:hidden")}
          aria-label="Volver al portal"
        >
          <PanelLeftClose className="size-4" />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="border-border bg-muted/30 hidden w-64 shrink-0 flex-col border-r md:flex">
          <div className="border-border flex items-center gap-2 border-b px-4 py-3">
            <History className="text-muted-foreground size-4" />
            <span className="font-heading text-sm font-medium text-[#002147]">
              Conversaciones
            </span>
          </div>
          <SidebarBody />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1 px-3 py-4 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4 pb-4">
              {messages.length === 0 && (
                <div className="text-muted-foreground rounded-2xl border border-dashed border-[#002147]/20 bg-[#002147]/[0.03] px-4 py-8 text-center text-sm leading-relaxed">
                  Escribe una consulta. Minerva AI responde de forma breve y
                  profesional, alineada con el tono corporativo de Minerva Global.
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
                          : "rounded-bl-md border border-slate-200/90 bg-white text-foreground"
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
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
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

          <footer className="border-border bg-background shrink-0 border-t px-3 py-3 sm:px-6">
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
                className="min-h-11 max-h-[200px] resize-none rounded-xl border-[#002147]/20 py-3 text-sm"
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
                  className="shrink-0 rounded-xl bg-[#002147] text-white hover:bg-[#002147]/90"
                  aria-label="Enviar"
                >
                  <Send className="size-5" />
                </Button>
              )}
            </form>
          </footer>
        </div>
      </div>
    </div>
  );
}
