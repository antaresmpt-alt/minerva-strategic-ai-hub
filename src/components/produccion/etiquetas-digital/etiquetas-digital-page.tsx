"use client";

import {
  CalendarDays,
  Inbox,
  Package,
  Route,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";

import { EtiquetasComprasTab } from "@/components/produccion/etiquetas-digital/etiquetas-compras-tab";
import { EtiquetasHojaRutaTab } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-tab";
import { EtiquetasCalendarioMensualTab } from "@/components/produccion/etiquetas-digital/etiquetas-calendario-mensual-tab";
import { EtiquetasStockBobinasTab } from "@/components/produccion/etiquetas-digital/etiquetas-stock-bobinas-tab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabTriggerClass =
  "flex h-full min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";

export function EtiquetasDigitalPage() {
  const [tab, setTab] = useState("hoja-de-ruta");

  return (
    <div className="w-full min-w-0 max-w-[100vw] space-y-3 overflow-x-hidden">
      <header className="mb-0">
        <h1 className="font-heading text-xl font-bold leading-tight text-[#002147] md:text-2xl">
          Etiquetas digital
        </h1>
        <p
          className="mt-0.5 max-w-full truncate text-xs text-slate-600 sm:max-w-3xl"
          title="Departamento de impresión digital de etiquetas — Minerva Global"
        >
          Pool, hoja de ruta, compras, stock bobinas y planificación mensual ·{" "}
          <span className="font-medium text-[#002147]">www.minervaglobal.es</span>
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="w-full min-w-0 max-w-full overflow-x-hidden"
      >
        <div className="mb-2 flex w-full justify-start sm:mb-3">
          <TabsList className="box-border inline-flex h-auto min-h-9 w-fit max-w-full flex-wrap items-stretch gap-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
            <TabsTrigger value="pool-entrada" className={tabTriggerClass}>
              <Inbox className="size-4 shrink-0 opacity-90" aria-hidden />
              Pool entrada
            </TabsTrigger>
            <TabsTrigger value="hoja-de-ruta" className={tabTriggerClass}>
              <Route className="size-4 shrink-0 opacity-90" aria-hidden />
              Hoja de ruta
            </TabsTrigger>
            <TabsTrigger value="compras" className={tabTriggerClass}>
              <ShoppingCart className="size-4 shrink-0 opacity-90" aria-hidden />
              Compras
            </TabsTrigger>
            <TabsTrigger value="stock-bobinas" className={tabTriggerClass}>
              <Package className="size-4 shrink-0 opacity-90" aria-hidden />
              Stock bobinas
            </TabsTrigger>
            <TabsTrigger value="calendario-mensual" className={tabTriggerClass}>
              <CalendarDays className="size-4 shrink-0 opacity-90" aria-hidden />
              Calendario mensual
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pool-entrada" className="mt-0 outline-none">
          <Card
            size="sm"
            className="max-w-full min-w-0 overflow-x-hidden border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm"
          >
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base text-[#002147]">
                Pool entrada
              </CardTitle>
              <CardDescription className="text-xs">
                Aquí aparecerán las OT enviadas desde mesa de planificación para
                que el departamento las seleccione y pase a la hoja de ruta.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Contenido en construcción.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hoja-de-ruta" className="mt-0 outline-none">
          <EtiquetasHojaRutaTab />
        </TabsContent>

        <TabsContent value="compras" className="mt-0 outline-none">
          <EtiquetasComprasTab />
        </TabsContent>

        <TabsContent value="stock-bobinas" className="mt-0 outline-none">
          <EtiquetasStockBobinasTab />
        </TabsContent>

        <TabsContent value="calendario-mensual" className="mt-0 outline-none">
          <EtiquetasCalendarioMensualTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
