"use client";

import { Bot, Rows3, Table2 } from "lucide-react";
import { useState } from "react";

import { PlanificacionMesaSecuenciacionTab } from "@/components/produccion/planificacion/planificacion-mesa-secuenciacion-tab";
import { PlanificacionOptimizadorIaTab } from "@/components/produccion/planificacion/planificacion-optimizador-ia-tab";
import { PlanificacionPoolOtsTab } from "@/components/produccion/planificacion/planificacion-pool-ots-tab-v2";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const SUBTAB_TRIGGER_CLASS =
  "flex h-full min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";

export function PlanificacionOtsPage() {
  const [subtab, setSubtab] = useState("pool");

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[#002147] md:text-xl">
          Planificación OT&apos;s
        </h2>
        <p className="text-xs text-slate-600 sm:text-sm">
          Preparación del pool, secuenciación diaria y soporte IA para decidir
          orden de producción.
        </p>
      </header>

      <Tabs value={subtab} onValueChange={setSubtab} className="w-full space-y-3">
        <TabsList className="box-border inline-flex h-auto min-h-9 w-fit max-w-full flex-wrap items-stretch gap-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
          <TabsTrigger value="pool" className={SUBTAB_TRIGGER_CLASS}>
            <Table2 className="size-4 shrink-0 opacity-90" aria-hidden />
            Pool de OT&apos;s
          </TabsTrigger>
          <TabsTrigger value="mesa" className={SUBTAB_TRIGGER_CLASS}>
            <Rows3 className="size-4 shrink-0 opacity-90" aria-hidden />
            Mesa de Secuenciación
          </TabsTrigger>
          <TabsTrigger value="ia" className={SUBTAB_TRIGGER_CLASS}>
            <Bot className="size-4 shrink-0 opacity-90" aria-hidden />
            Optimizador IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pool" className="mt-0 space-y-3 outline-none">
          <PlanificacionPoolOtsTab />
        </TabsContent>

        <TabsContent value="mesa" className="mt-0 space-y-3 outline-none">
          <PlanificacionMesaSecuenciacionTab />
        </TabsContent>

        <TabsContent value="ia" className="mt-0 space-y-3 outline-none">
          <PlanificacionOptimizadorIaTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
