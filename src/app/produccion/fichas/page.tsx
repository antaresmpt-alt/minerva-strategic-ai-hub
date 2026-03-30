import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProduccionFichasPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
          Generador de Fichas Técnicas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Parámetros base para generar o ajustar fichas (placeholder).
        </p>
      </header>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-[#002147]">
            Datos de impresión
          </CardTitle>
          <CardDescription>
            Busca una OT existente y define densidades CMYK de referencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="ot-base" className="text-slate-700">
              Buscar OT base
            </Label>
            <Input
              id="ot-base"
              name="otBase"
              placeholder="ej. OT-2026-0142"
              className="rounded-xl border-[#002147]/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dens-c" className="text-slate-700">
                Densidad Cian
              </Label>
              <Input
                id="dens-c"
                name="densidadCian"
                placeholder="ej. 1,40"
                className="rounded-xl border-[#002147]/20"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dens-m" className="text-slate-700">
                Densidad Magenta
              </Label>
              <Input
                id="dens-m"
                name="densidadMagenta"
                placeholder="ej. 1,35"
                className="rounded-xl border-[#002147]/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
