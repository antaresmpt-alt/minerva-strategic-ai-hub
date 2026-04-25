"use client";

import { Layers3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PlanificacionMesaSecuenciacionTab() {
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg text-[#002147]">
          Mesa de Secuenciación
        </CardTitle>
        <CardDescription>
          Vista de carga diaria de máquina para ordenar OT&apos;s por prioridad y
          disponibilidad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
          Próximamente: tablero de secuenciación diaria con arrastre y validación
          de capacidad.
        </p>
        <Button type="button" variant="outline" disabled>
          <Layers3 className="mr-1.5 size-4" aria-hidden />
          Próximamente
        </Button>
      </CardContent>
    </Card>
  );
}
