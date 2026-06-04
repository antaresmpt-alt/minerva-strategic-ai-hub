"use client";

import { useMemo, useState } from "react";

import { DatosProcesoForm } from "@/components/produccion/hoja-ruta/datos-proceso-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCamposConfigByProcesoId,
  type DatosProcesoGenerico,
} from "@/lib/hoja-ruta-campos-config";

const PROCESOS_TEST = [
  { id: 1, nombre: "Impresión Offset", grupo: "Producción" },
  { id: 2, nombre: "Impresión Digital (Plano)", grupo: "Producción" },
  { id: 3, nombre: "Plastificado (Ext)", grupo: "Externo: hojas" },
  { id: 4, nombre: "Stamping (Ext)", grupo: "Externo: hojas" },
  { id: 5, nombre: "UVI Serigrafía (Ext)", grupo: "Externo: hojas" },
  { id: 6, nombre: "Serigrafía Digital (MGI/Scodix)", grupo: "Externo: hojas" },
  { id: 7, nombre: "Contracolado Microcanal (Ext)", grupo: "Externo: contracolado" },
  { id: 8, nombre: "Relieve (Interno)", grupo: "Externo: hojas" },
  { id: 9, nombre: "Relieve (Ext)", grupo: "Externo: hojas" },
  { id: 10, nombre: "Troquelado", grupo: "Producción" },
  { id: 11, nombre: "Poner Ventana PVC (Ext)", grupo: "Externo: ventana" },
  { id: 12, nombre: "Engomado", grupo: "Producción" },
  { id: 13, nombre: "Forrado de Cajas (Ext)", grupo: "Externo: forrado" },
  { id: 14, nombre: "Encuadernación/Plegado (Ext)", grupo: "Externo: genérico" },
  { id: 15, nombre: "Manipulado/Encajado", grupo: "Producción" },
  { id: 17, nombre: "Guillotina", grupo: "Producción" },
  { id: 18, nombre: "Impresión_KONICA", grupo: "Etiquetas: fuera del motor" },
  { id: 19, nombre: "Troq_ETIQUETA", grupo: "Etiquetas: fuera del motor" },
  { id: 20, nombre: "Num_ETIQUETA", grupo: "Etiquetas: fuera del motor" },
  { id: 21, nombre: "Impresión EXTERNA", grupo: "Externo: genérico" },
];

export function HojaRutaTestPage() {
  const [procesoId, setProcesoId] = useState(1);
  const [datos, setDatos] = useState<DatosProcesoGenerico>({});

  const selectedProceso = useMemo(
    () => PROCESOS_TEST.find((p) => p.id === procesoId) ?? PROCESOS_TEST[0],
    [procesoId]
  );
  const config = useMemo(() => getCamposConfigByProcesoId(procesoId), [procesoId]);
  const jsonPreview = useMemo(() => JSON.stringify(datos, null, 2), [datos]);

  function handleProcesoChange(value: string | null) {
    if (value == null) return;
    setProcesoId(Number(value));
    setDatos({});
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hoja de Ruta Digital: test de campos
          </h1>
          <Badge variant="secondary">Temporal</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Pantalla de prueba para validar el motor de campos por proceso. No guarda
          datos en base de datos: solo renderiza el formulario y muestra el JSON que
          se guardaría en <code>prod_ot_pasos.datos_proceso</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proceso a probar</CardTitle>
          <CardDescription>
            Usa los IDs reales del catálogo <code>prod_procesos_cat</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(280px,420px)_1fr] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="proceso-test">Proceso</Label>
            <Select value={String(procesoId)} onValueChange={handleProcesoChange}>
              <SelectTrigger id="proceso-test">
                <SelectValue placeholder="Seleccionar proceso" />
              </SelectTrigger>
              <SelectContent>
                {PROCESOS_TEST.map((proceso) => (
                  <SelectItem key={proceso.id} value={String(proceso.id)}>
                    {proceso.id} - {proceso.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={config ? "default" : "outline"}>
              {config ? "Con formulario" : "Fuera del motor"}
            </Badge>
            <span>{selectedProceso.grupo}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Formulario dinámico</CardTitle>
            <CardDescription>
              Cambia de proceso para comprobar campos previsto/real, arrays,
              condicionales y familias de externos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config ? (
              <DatosProcesoForm
                key={procesoId}
                procesoId={procesoId}
                procesoNombre={config.procesoNombre}
                datosInicial={{}}
                onChange={setDatos}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Este proceso está fuera del motor de campos de cartoncillo/estuche.
                KONICA, Troq_ETIQUETA y Num_ETIQUETA se gestionarán mediante el
                Bloque 5 de integración con la hoja de ruta de etiquetas.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader>
            <CardTitle>JSON resultante</CardTitle>
            <CardDescription>
              Vista previa de <code>datos_proceso</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[620px] overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
              {jsonPreview}
            </pre>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
