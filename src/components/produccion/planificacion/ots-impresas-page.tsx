"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OtsImpresasPage() {
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg text-[#002147]">OT&apos;s Impresas</CardTitle>
        <CardDescription>
          Histórico de órdenes finalizadas para control y análisis de producción.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
          Próximamente: listado de OT&apos;s impresas con filtros por fecha, máquina y
          rendimiento.
        </p>
        <Button type="button" variant="outline" disabled>
          <Printer className="mr-1.5 size-4" aria-hidden />
          Próximamente
        </Button>
      </CardContent>
    </Card>
  );
}
