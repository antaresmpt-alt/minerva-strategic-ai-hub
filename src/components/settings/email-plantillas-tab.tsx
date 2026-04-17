"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_EMAIL_PLANTILLA_COMPRAS,
  DEFAULT_EMAIL_PLANTILLA_EXTERNOS,
  fetchEmailPlantillasProduccion,
  TABLE_PROD_CONFIGURACION,
  TEMPLATE_COMPRAS_DETAIL,
  TEMPLATE_COMPRAS_FOOTER,
  TEMPLATE_COMPRAS_HEADER,
  TEMPLATE_COMPRAS_SUBJECT,
  TEMPLATE_EXTERNOS_DETAIL,
  TEMPLATE_EXTERNOS_FOOTER,
  TEMPLATE_EXTERNOS_HEADER,
  TEMPLATE_EXTERNOS_SUBJECT,
  type EmailPlantillaBloques,
} from "@/lib/email-plantillas-produccion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Draft = EmailPlantillaBloques;

function bloquesToRows(b: EmailPlantillaBloques, prefix: "externos" | "compras") {
  if (prefix === "externos") {
    return [
      { clave: TEMPLATE_EXTERNOS_SUBJECT, valor: b.subject },
      { clave: TEMPLATE_EXTERNOS_HEADER, valor: b.header },
      { clave: TEMPLATE_EXTERNOS_DETAIL, valor: b.detail },
      { clave: TEMPLATE_EXTERNOS_FOOTER, valor: b.footer },
    ];
  }
  return [
    { clave: TEMPLATE_COMPRAS_SUBJECT, valor: b.subject },
    { clave: TEMPLATE_COMPRAS_HEADER, valor: b.header },
    { clave: TEMPLATE_COMPRAS_DETAIL, valor: b.detail },
    { clave: TEMPLATE_COMPRAS_FOOTER, valor: b.footer },
  ];
}

export function EmailPlantillasTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [externos, setExternos] = useState<Draft>(() => ({
    ...DEFAULT_EMAIL_PLANTILLA_EXTERNOS,
  }));
  const [compras, setCompras] = useState<Draft>(() => ({
    ...DEFAULT_EMAIL_PLANTILLA_COMPRAS,
  }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { externos: e, compras: c } = await fetchEmailPlantillasProduccion(
        supabase
      );
      setExternos(e);
      setCompras(c);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar las plantillas.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardarExternos = useCallback(async () => {
    setSaving(true);
    try {
      const rows = bloquesToRows(externos, "externos").map((r) => ({
        clave: r.clave,
        valor: r.valor,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from(TABLE_PROD_CONFIGURACION)
        .upsert(rows, { onConflict: "clave" });
      if (error) throw error;
      toast.success("Plantilla Externos guardada.");
      void load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [externos, load, supabase]);

  const guardarCompras = useCallback(async () => {
    setSaving(true);
    try {
      const rows = bloquesToRows(compras, "compras").map((r) => ({
        clave: r.clave,
        valor: r.valor,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from(TABLE_PROD_CONFIGURACION)
        .upsert(rows, { onConflict: "clave" });
      if (error) throw error;
      toast.success("Plantilla Materiales guardada.");
      void load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [compras, load, supabase]);

  const restaurarExternos = useCallback(() => {
    setExternos({ ...DEFAULT_EMAIL_PLANTILLA_EXTERNOS });
    toast.message("Valores por defecto cargados en el formulario (guarda para persistir).");
  }, []);

  const restaurarCompras = useCallback(() => {
    setCompras({ ...DEFAULT_EMAIL_PLANTILLA_COMPRAS });
    toast.message("Valores por defecto cargados en el formulario (guarda para persistir).");
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Cargando plantillas…
      </div>
    );
  }

  return (
    <Tabs defaultValue="externos" className="w-full gap-4">
      <TabsList variant="line" className="w-full justify-start gap-1">
        <TabsTrigger value="externos">Plantilla Externos</TabsTrigger>
        <TabsTrigger value="compras">Plantilla Materiales</TabsTrigger>
      </TabsList>

      <TabsContent value="externos" className="mt-4 outline-none">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Correo a proveedores (Externos)</CardTitle>
            <CardDescription>
              Variables en asunto, cabecera, pie y línea de detalle:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {"{proveedor}"} {`{ot}`} {`{trabajo}`} {`{cantidad}`}{" "}
                {`{entrega}`}
              </code>
              . La línea de detalle se repite por cada OT seleccionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-ext-subject">Asunto del mail</Label>
              <Input
                id="tpl-ext-subject"
                value={externos.subject}
                onChange={(e) =>
                  setExternos((p) => ({ ...p, subject: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-ext-header">Cabecera (saludo)</Label>
              <Textarea
                id="tpl-ext-header"
                rows={5}
                value={externos.header}
                onChange={(e) =>
                  setExternos((p) => ({ ...p, header: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-ext-detail">Línea de detalle (por fila)</Label>
              <Textarea
                id="tpl-ext-detail"
                rows={4}
                value={externos.detail}
                onChange={(e) =>
                  setExternos((p) => ({ ...p, detail: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-ext-footer">Pie (despedida)</Label>
              <Textarea
                id="tpl-ext-footer"
                rows={5}
                value={externos.footer}
                onChange={(e) =>
                  setExternos((p) => ({ ...p, footer: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={() => void guardarExternos()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Guardar Externos
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={restaurarExternos}
                disabled={saving}
              >
                Cargar valores por defecto
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="compras" className="mt-4 outline-none">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Correo solicitud material (Compras)</CardTitle>
            <CardDescription>
              Variables:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {"{proveedor}"} {`{material}`} {`{cantidad}`} {`{gramaje}`}{" "}
                {`{formato}`} {`{ot_asociada}`}
              </code>
              . En asunto/cabecera/pie,{" "}
              <code className="text-xs">{`{ot_asociada}`}</code> lista las OT de
              la selección; en la línea de detalle corresponde a cada fila.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-com-subject">Asunto del mail</Label>
              <Input
                id="tpl-com-subject"
                value={compras.subject}
                onChange={(e) =>
                  setCompras((p) => ({ ...p, subject: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-com-header">Cabecera (saludo)</Label>
              <Textarea
                id="tpl-com-header"
                rows={5}
                value={compras.header}
                onChange={(e) =>
                  setCompras((p) => ({ ...p, header: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-com-detail">Línea de detalle (por fila)</Label>
              <Textarea
                id="tpl-com-detail"
                rows={4}
                value={compras.detail}
                onChange={(e) =>
                  setCompras((p) => ({ ...p, detail: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-com-footer">Pie (despedida)</Label>
              <Textarea
                id="tpl-com-footer"
                rows={5}
                value={compras.footer}
                onChange={(e) =>
                  setCompras((p) => ({ ...p, footer: e.target.value }))
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={() => void guardarCompras()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Guardar Materiales
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={restaurarCompras}
                disabled={saving}
              >
                Cargar valores por defecto
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
