"use client";

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PlanificacionIaScope } from "@/types/planificacion-mesa";

export type PlanificacionIaMode = "rules" | "advanced" | "mixed";
export type PlanificacionIaDialogStatus = "idle" | "running" | "success" | "error";

export interface PlanificacionIaDialogState {
  open: boolean;
  status: PlanificacionIaDialogStatus;
  mode: PlanificacionIaMode;
  scope: PlanificacionIaScope;
  stepIndex: number;
  movedCount: number | null;
  reasons: string[];
  warnings: string[];
  error: string | null;
  modelUsed?: string;
  didFallback?: boolean;
  insights: string[];
}

const STEPS = [
  "Preparando draft de simulación",
  "Analizando barnices/acabados",
  "Agrupando papel, gramaje y formato",
  "Revisando tintas/Pantones",
  "Consultando modelo IA, si aplica",
  "Validando bloqueos, capacidad y alcance",
  "Aplicando propuesta al borrador",
];

function modeLabel(mode: PlanificacionIaMode): string {
  if (mode === "rules") return "Reglas";
  if (mode === "advanced") return "IA avanzada";
  return "Mixto recomendado";
}

function scopeLabel(scope: PlanificacionIaScope): string {
  if (scope === "dia") return "Día";
  if (scope === "dias_contiguos") return "Días contiguos";
  if (scope === "semana") return "Semana completa";
  return "Turno";
}

export function PlanificacionIaProgressDialog({
  state,
  onClose,
}: {
  state: PlanificacionIaDialogState;
  onClose: () => void;
}) {
  const running = state.status === "running";
  const progress =
    state.status === "success" || state.status === "error"
      ? 100
      : Math.round(((state.stepIndex + 1) / STEPS.length) * 100);

  return (
    <Dialog open={state.open} onOpenChange={(open) => (!open && !running ? onClose() : null)}>
      <DialogContent showCloseButton={!running} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ordenando planificación</DialogTitle>
          <DialogDescription>
            Modo {modeLabel(state.mode)} · Alcance {scopeLabel(state.scope)}
            {state.modelUsed ? ` · Modelo ${state.modelUsed}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          {state.insights.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">Análisis operativo</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {state.insights.slice(0, 6).map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Progress value={progress} />

          <div className="space-y-2">
            {STEPS.map((step, idx) => {
              const done = idx < state.stepIndex || state.status === "success";
              const active = idx === state.stepIndex && running;
              return (
                <div
                  key={step}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    active && "border-[#C69C2B]/60 bg-amber-50 text-amber-900",
                    done && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    !active && !done && "border-slate-200 bg-slate-50 text-slate-500",
                  )}
                >
                  {active ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <span className="size-4 rounded-full border border-current opacity-40" />
                  )}
                  {step}
                </div>
              );
            })}
          </div>

          {state.status === "success" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p className="font-semibold">
                Propuesta aplicada al borrador: {state.movedCount ?? 0} movimientos.
                {state.didFallback ? " Se usó fallback." : ""}
              </p>
              {state.reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {state.reasons.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {state.status === "error" && state.error ? (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </div>
          ) : null}

          {state.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-semibold">Avisos</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {state.warnings.slice(0, 5).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:flex-row sm:justify-end">
          <Button type="button" onClick={onClose} disabled={running}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
