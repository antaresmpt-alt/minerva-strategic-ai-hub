"use client";

import { CalendarDays } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProduccionOrdenesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
          Gestión de órdenes de trabajo
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Listado de OT y planificación de producción (esqueleto).
        </p>
      </header>

      <Tabs defaultValue="listado" className="w-full">
        <TabsList
          variant="line"
          className="h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-slate-200/60 bg-slate-50/90 p-1 sm:w-fit"
        >
          <TabsTrigger value="listado" className="px-4 py-2 text-sm">
            Listado OT
          </TabsTrigger>
          <TabsTrigger value="planificador" className="px-4 py-2 text-sm">
            Planificador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listado" className="mt-6 outline-none">
          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="border-b border-slate-200/70 pb-4">
              <CardTitle className="text-lg text-[#002147]">
                Órdenes de trabajo
              </CardTitle>
              <CardDescription>
                Vista corporativa; los datos se conectarán al ERP / MES.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                      <TableHead className="min-w-[6rem] font-semibold text-[#002147]">
                        Nº OT
                      </TableHead>
                      <TableHead className="min-w-[10rem] font-semibold text-[#002147]">
                        Cliente
                      </TableHead>
                      <TableHead className="min-w-[12rem] font-semibold text-[#002147]">
                        Descripción
                      </TableHead>
                      <TableHead className="min-w-[9rem] font-semibold text-[#002147]">
                        Máquina Actual
                      </TableHead>
                      <TableHead className="min-w-[8rem] font-semibold text-[#002147]">
                        Estado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody />
                </Table>
              </div>
              <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">
                No hay órdenes cargadas.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planificador" className="mt-6 outline-none">
          <Card className="border border-dashed border-[#002147]/20 bg-white/80 shadow-sm backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <CalendarDays className="size-10" strokeWidth={1.25} aria-hidden />
              </div>
              <h2 className="font-heading text-xl font-semibold text-[#002147] md:text-2xl">
                Planificador de Producción Avanzado
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                Módulo en desarrollo. Próximamente: Diagramas de Gantt y
                asignación dinámica de máquinas.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
