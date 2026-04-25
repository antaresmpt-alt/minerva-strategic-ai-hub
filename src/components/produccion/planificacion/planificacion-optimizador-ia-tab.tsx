"use client";

import { BrainCircuit } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PlanificacionOptimizadorIaTab() {
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg text-[#002147]">Optimizador IA</CardTitle>
        <CardDescription>
          Motor de ayuda para proponer secuencias óptimas según fecha, carga y
          restricciones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
          Próximamente: recomendaciones automáticas de planificación y detección
          de cuellos de botella.
        </p>
        <Button type="button" variant="outline" disabled>
          <BrainCircuit className="mr-1.5 size-4" aria-hidden />
          Próximamente
        </Button>
      </CardContent>
    </Card>
  );
}
