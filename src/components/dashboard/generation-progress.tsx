"use client";

import { MinervaThinkingLogo } from "@/components/brand/minerva-thinking-logo";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function progressStageLabel(value: number): string {
  if (value < 25)
    return "Analizando estructura web de la empresa...";
  if (value < 50)
    return "Ejecutando diagnóstico multi-agente (CMO, SEO, Ventas)...";
  if (value < 75)
    return "Generando informe estratégico y DAFO...";
  return "Finalizando tablas y plan de acción...";
}

export function GenerationProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const label = progressStageLabel(value);
  const rounded = Math.min(100, Math.round(value));

  return (
    <div className={cn("space-y-1", className)}>
      <Progress
        value={rounded}
        className="[&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:bg-[#002147]/12 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-[#002147] [&_[data-slot=progress-indicator]]:to-[#C69C2B]"
      >
        <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 max-w-[min(100%,28rem)] items-center gap-2 md:gap-3">
            <MinervaThinkingLogo size={36} />
            <ProgressLabel className="text-xs font-medium text-[#002147] md:text-sm">
              {label}
            </ProgressLabel>
          </div>
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {rounded}%
          </span>
        </div>
      </Progress>
    </div>
  );
}
