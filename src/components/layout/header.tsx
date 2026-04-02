"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_GLOBAL_MODEL,
  type GlobalModelId,
  isGlobalModelId,
} from "@/lib/global-model";
import { useHubStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS: { value: GlobalModelId; label: string }[] = [
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (⚡)" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (📑)" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (🧠)" },
  { value: "gpt-4o", label: "GPT-4o (🤖)" },
];

function useGlobalModelSelectorLocked(): boolean {
  const pathname = usePathname();
  const activeMode = useHubStore((s) => s.activeMode);

  return useMemo(() => {
    if (pathname === "/chat" || pathname?.startsWith("/settings")) {
      return true;
    }
    if (pathname === "/sem") {
      return (
        activeMode === "creativo" ||
        activeMode === "metaProposal" ||
        activeMode === "semCreativeLab"
      );
    }
    return false;
  }, [pathname, activeMode]);
}

export type GlobalModelSelectorProps = {
  /** `row`: etiqueta y select en línea (cabeceras de módulo). `stack`: etiqueta encima (layouts estrechos). */
  layout?: "row" | "stack";
  className?: string;
};

/**
 * Selector de modelo de IA (Consola de Mando). Deshabilitado en Chat RAG, Ajustes
 * y pestañas SEM que fijan su propio flujo (Creativo, Meta Ads, Creative Lab).
 */
export function GlobalModelSelector({
  layout = "row",
  className,
}: GlobalModelSelectorProps) {
  const locked = useGlobalModelSelectorLocked();
  const globalModel = useHubStore((s) => s.globalModel);
  const setGlobalModel = useHubStore((s) => s.setGlobalModel);

  const value = locked ? DEFAULT_GLOBAL_MODEL : globalModel;

  return (
    <div
      className={cn(
        "pointer-events-auto",
        layout === "row"
          ? "flex flex-row flex-wrap items-center gap-2 sm:gap-3"
          : "flex flex-col gap-0.5",
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
          layout === "stack" && "hidden sm:block"
        )}
      >
        Modelo IA
      </span>
      <Select
        value={value}
        onValueChange={(v) => {
          if (!v || locked) return;
          if (isGlobalModelId(v)) setGlobalModel(v);
        }}
        disabled={locked}
      >
        <SelectTrigger
          size="sm"
          aria-label="Seleccionar modelo de IA"
          title={
            locked
              ? "Este módulo usa un modelo fijo (Gemini Flash) optimizado para su flujo."
              : "Modelo de IA para generación en Minerva"
          }
          className={cn(
            "h-9 max-w-[min(100vw-8rem,14rem)] min-w-[10.5rem] border-[var(--minerva-navy)]/25 bg-card/95 text-left text-xs shadow-sm backdrop-blur-sm",
            locked && "opacity-90"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[var(--anchor-width)]">
          {MODEL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
