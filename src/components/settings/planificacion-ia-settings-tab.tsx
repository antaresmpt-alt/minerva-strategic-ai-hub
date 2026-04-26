"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
  mapRowsToIaSettings,
  PLANIFICACION_IA_PARAM_KEYS,
} from "@/lib/planificacion-ia-settings";
import type { PlanificacionIaSettings } from "@/types/planificacion-mesa";

type Row = {
  clave: string;
  valor_num: number | string | null;
  valor_text: string | null;
  descripcion: string | null;
};

const FIELDS: Array<{
  key: keyof Omit<PlanificacionIaSettings, "promptBase">;
  clave: string;
  label: string;
}> = [
  { key: "pesoTintas", clave: PLANIFICACION_IA_PARAM_KEYS.pesoTintas, label: "Agrupar tintas/Pantones" },
  { key: "pesoCmyk", clave: PLANIFICACION_IA_PARAM_KEYS.pesoCmyk, label: "Agrupar CMYK" },
  { key: "pesoBarniz", clave: PLANIFICACION_IA_PARAM_KEYS.pesoBarniz, label: "Minimizar cambios de barniz/acabado" },
  { key: "pesoPapel", clave: PLANIFICACION_IA_PARAM_KEYS.pesoPapel, label: "Agrupar papel/material/formato" },
  { key: "pesoFechaEntrega", clave: PLANIFICACION_IA_PARAM_KEYS.pesoFechaEntrega, label: "Priorizar fecha entrega" },
  { key: "pesoBalanceCarga", clave: PLANIFICACION_IA_PARAM_KEYS.pesoBalanceCarga, label: "Balance de carga por turno" },
];

export function PlanificacionIaSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PlanificacionIaSettings | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/planificacion-ia-settings");
      const data = (await res.json()) as { rows?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar configuración IA.");
      setDraft(mapRowsToIaSettings(data.rows ?? []));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar configuración IA.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const valores: Record<string, number> = {};
      for (const f of FIELDS) valores[f.clave] = Number(draft[f.key]) || 0;
      const res = await fetch("/api/admin/planificacion-ia-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valores, promptBase: draft.promptBase }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      toast.success("Reglas IA de planificación actualizadas.");
      await fetchRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [draft, fetchRows]);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-lg">
          <Sparkles className="size-5 text-[#C69C2B]" />
          Planificación IA
        </CardTitle>
        <CardDescription>
          Pesos usados para ordenar el draft de simulación en la Mesa de Secuenciación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading || !draft ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando...
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-sm">{field.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft[field.key]}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, [field.key]: Number(e.target.value) } : prev,
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Prompt base / criterio operativo</Label>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.promptBase}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, promptBase: e.target.value } : prev)}
              />
            </div>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Guardar reglas IA
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
