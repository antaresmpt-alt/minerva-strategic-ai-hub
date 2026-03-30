import { Package } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProduccionAlmacenPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
          Almacén
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Inventario y movimientos (próximamente).
        </p>
      </header>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#002147]/10 text-[#002147]">
            <Package className="size-5" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-lg text-[#002147]">
              Módulo en preparación
            </CardTitle>
            <CardDescription>
              Aquí integraremos stock, ubicaciones y trazabilidad con el resto
              del hub.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Usa el menú lateral para ir a <strong>Órdenes</strong> o{" "}
            <strong>Fichas Técnicas</strong> mientras completamos esta sección.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
