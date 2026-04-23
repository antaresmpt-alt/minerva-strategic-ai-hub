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
  DEFAULT_OPTIMUS_IMPORT_PROMPT,
  fetchEmailPlantillasProduccion,
  fetchOptimusImportPromptProduccion,
  TABLE_PROD_CONFIGURACION,
  TEMPLATE_COMPRAS_DETAIL,
  TEMPLATE_COMPRAS_FOOTER,
  TEMPLATE_COMPRAS_HEADER,
  TEMPLATE_COMPRAS_SUBJECT,
  TEMPLATE_EXTERNOS_DETAIL,
  TEMPLATE_EXTERNOS_FOOTER,
  TEMPLATE_EXTERNOS_HEADER,
  TEMPLATE_EXTERNOS_SUBJECT,
  TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT,
  TEMPLATE_OPTIMUS_IMPORT_PROMPT,
  TEMPLATE_OPTIMUS_REGEX_RULES,
  type EmailPlantillaBloques,
} from "@/lib/email-plantillas-produccion";
import {
  DEFAULT_OPTIMUS_REGEX_RULES,
  type OptimusExtractionMode,
} from "@/lib/optimus-regex-rules";
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
  const [optimusPrompt, setOptimusPrompt] = useState(
    DEFAULT_OPTIMUS_IMPORT_PROMPT
  );
  const [optimusRulesJson, setOptimusRulesJson] = useState(() =>
    JSON.stringify(DEFAULT_OPTIMUS_REGEX_RULES, null, 2)
  );
  const [optimusModeDefault, setOptimusModeDefault] =
    useState<OptimusExtractionMode>("rules");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { externos: e, compras: c } = await fetchEmailPlantillasProduccion(
        supabase
      );
      const p = await fetchOptimusImportPromptProduccion(supabase);
      const { data: rulesRow } = await supabase
        .from(TABLE_PROD_CONFIGURACION)
        .select("valor")
        .eq("clave", TEMPLATE_OPTIMUS_REGEX_RULES)
        .maybeSingle();
      const { data: modeRow } = await supabase
        .from(TABLE_PROD_CONFIGURACION)
        .select("valor")
        .eq("clave", TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT)
        .maybeSingle();
      setExternos(e);
      setCompras(c);
      setOptimusPrompt(p);
      setOptimusRulesJson(
        String((rulesRow as { valor?: string | null } | null)?.valor ?? "").trim() ||
          JSON.stringify(DEFAULT_OPTIMUS_REGEX_RULES, null, 2)
      );
      const modeRaw = String((modeRow as { valor?: string | null } | null)?.valor ?? "")
        .trim()
        .toLowerCase();
      setOptimusModeDefault(modeRaw === "ai" ? "ai" : "rules");
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

  const guardarPromptOptimus = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from(TABLE_PROD_CONFIGURACION).upsert(
        [
          {
            clave: TEMPLATE_OPTIMUS_IMPORT_PROMPT,
            valor: optimusPrompt,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "clave" }
      );
      if (error) throw error;
      toast.success("Prompt de Importación Optimus guardado.");
      void load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [load, optimusPrompt, supabase]);

  const restaurarPromptOptimus = useCallback(() => {
    setOptimusPrompt(DEFAULT_OPTIMUS_IMPORT_PROMPT);
    toast.message("Prompt por defecto cargado en el formulario (guarda para persistir).");
  }, []);

  const guardarReglasOptimus = useCallback(async () => {
    setSaving(true);
    try {
      JSON.parse(optimusRulesJson);
      const { error } = await supabase.from(TABLE_PROD_CONFIGURACION).upsert(
        [
          {
            clave: TEMPLATE_OPTIMUS_REGEX_RULES,
            valor: optimusRulesJson,
            updated_at: new Date().toISOString(),
          },
          {
            clave: TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT,
            valor: optimusModeDefault,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "clave" }
      );
      if (error) throw error;
      toast.success("Reglas de Importación Optimus guardadas.");
      void load();
    } catch (e) {
      if (e instanceof SyntaxError) {
        toast.error("El JSON de reglas no es válido.");
      } else {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Error al guardar.");
      }
    } finally {
      setSaving(false);
    }
  }, [load, optimusModeDefault, optimusRulesJson, supabase]);

  const restaurarReglasOptimus = useCallback(() => {
    setOptimusRulesJson(JSON.stringify(DEFAULT_OPTIMUS_REGEX_RULES, null, 2));
    setOptimusModeDefault("rules");
    toast.message("Reglas por defecto cargadas (guarda para persistir).");
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
        <TabsTrigger value="prompt-optimus">Prompt Importación Optimus</TabsTrigger>
        <TabsTrigger value="rules-optimus">Reglas Importación Optimus</TabsTrigger>
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

      <TabsContent value="prompt-optimus" className="mt-4 outline-none">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prompt IA - Importación Optimus</CardTitle>
            <CardDescription>
              Prompt del extractor para albaranes Optimus (.txt). Puedes ajustar
              reglas de mapeo sin tocar código.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="optimus-import-prompt">System prompt</Label>
              <Textarea
                id="optimus-import-prompt"
                rows={16}
                value={optimusPrompt}
                onChange={(e) => setOptimusPrompt(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={() => void guardarPromptOptimus()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Guardar Prompt
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={restaurarPromptOptimus}
                disabled={saving}
              >
                Cargar prompt por defecto
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rules-optimus" className="mt-4 outline-none">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reglas Importación Optimus</CardTitle>
            <CardDescription>
              Configuración del parser local por regex/sinónimos y modo por
              defecto (sin IA o IA).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="optimus-default-mode">Modo por defecto</Label>
              <select
                id="optimus-default-mode"
                value={optimusModeDefault}
                onChange={(e) =>
                  setOptimusModeDefault(
                    e.target.value === "ai" ? "ai" : "rules"
                  )
                }
                className="border-input bg-background h-9 w-full max-w-[16rem] rounded-md border px-3 text-sm"
              >
                <option value="rules">Reglas (sin IA)</option>
                <option value="ai">IA</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="optimus-rules-json">JSON de reglas</Label>
              <Textarea
                id="optimus-rules-json"
                rows={18}
                value={optimusRulesJson}
                onChange={(e) => setOptimusRulesJson(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                onClick={() => void guardarReglasOptimus()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Guardar Reglas
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={restaurarReglasOptimus}
                disabled={saving}
              >
                Cargar reglas por defecto
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
