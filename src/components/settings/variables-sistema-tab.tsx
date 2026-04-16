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
import {
  DEFAULT_OTS_COMPRAS_UMBRALES,
  mergeOtsComprasUmbralesDesdeFilas,
  SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA,
  SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO,
  SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK,
  SYS_PARAM_OTS_COMPRAS_CLAVES,
  type SysParamOtsComprasClave,
  type SysParametroOtsCompraRow,
} from "@/lib/sys-parametros-ots-compras";

const TITULO_PARAM: Record<SysParamOtsComprasClave, string> = {
  [SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO]: "Días crítico (semáforo rojo)",
  [SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA]: "Días aviso (semáforo naranja)",
  [SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK]: "Umbral sobrestock (icono 💶)",
};

const DESCRIPCION_FALLBACK: Record<SysParamOtsComprasClave, string> = {
  [SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO]:
    "Si los días naturales hasta la fecha de entrega de la OT son menores o iguales a este valor, el número de OT se muestra con fondo rojo.",
  [SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA]:
    "Si los días hasta entrega son mayores que el umbral rojo e inferiores o iguales a este valor, el badge es naranja; por encima, verde (o gris si no hay fecha).",
  [SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK]:
    "Si los días hasta entrega superan este umbral, junto al número de OT se muestra el icono de euro (sobrestock / entrega lejana).",
};

function draftToValores(
  draft: Record<SysParamOtsComprasClave, string>
): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const clave of SYS_PARAM_OTS_COMPRAS_CLAVES) {
    const raw = draft[clave].trim();
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    out[clave] = n;
  }
  return out;
}

export function VariablesSistemaTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metaByClave, setMetaByClave] = useState<
    Partial<Record<SysParamOtsComprasClave, SysParametroOtsCompraRow>>
  >({});
  const [draft, setDraft] = useState<Record<SysParamOtsComprasClave, string>>(
    () => ({
      [SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO]: String(
        DEFAULT_OTS_COMPRAS_UMBRALES.criticoRojo
      ),
      [SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA]: String(
        DEFAULT_OTS_COMPRAS_UMBRALES.avisoNaranja
      ),
      [SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK]: String(
        DEFAULT_OTS_COMPRAS_UMBRALES.sobrestockUmbral
      ),
    })
  );

  const applyRows = useCallback((rows: SysParametroOtsCompraRow[]) => {
    const map: Partial<Record<SysParamOtsComprasClave, SysParametroOtsCompraRow>> =
      {};
    for (const r of rows) {
      if (SYS_PARAM_OTS_COMPRAS_CLAVES.includes(r.clave as SysParamOtsComprasClave)) {
        map[r.clave as SysParamOtsComprasClave] = r;
      }
    }
    setMetaByClave(map);
    const merged = mergeOtsComprasUmbralesDesdeFilas(rows);
    setDraft({
      [SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO]: String(merged.criticoRojo),
      [SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA]: String(merged.avisoNaranja),
      [SYS_PARAM_CLAVE_OTS_COMPRAS_SOBRESTOCK]: String(merged.sobrestockUmbral),
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/sys-parametros");
      const data = (await res.json()) as {
        rows?: SysParametroOtsCompraRow[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? `Error ${res.status}`);
        applyRows([]);
        return;
      }
      applyRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setLoadError("No se pudo cargar la configuración.");
      applyRows([]);
    } finally {
      setLoading(false);
    }
  }, [applyRows]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const ordenSemanticoOk = useMemo(() => {
    const v = draftToValores(draft);
    if (!v) return false;
    const rojo = v[SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO]!;
    const nja = v[SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA]!;
    return rojo <= nja;
  }, [draft]);

  const valoresParseados = useMemo(() => draftToValores(draft), [draft]);

  const handleGuardar = useCallback(async () => {
    const valores = draftToValores(draft);
    if (!valores) {
      toast.error("Introduce números válidos (≥ 0) en los tres campos.");
      return;
    }
    if (
      valores[SYS_PARAM_CLAVE_OTS_COMPRAS_ROJO]! >
      valores[SYS_PARAM_CLAVE_OTS_COMPRAS_NARANJA]!
    ) {
      toast.error(
        "El umbral rojo debe ser menor o igual que el umbral naranja para que el semáforo tenga sentido."
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sys-parametros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valores }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Parámetros actualizados.");
      await fetchRows();
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [draft, fetchRows]);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Producción &gt; OTs &gt; Compras</CardTitle>
        <CardDescription>
          Umbrales de semáforo en tablas Despachadas y Compras, y aviso de
          sobrestock. Los valores se guardan en{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            public.sys_parametros
          </code>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Cargando parámetros…
          </div>
        ) : null}

        <div className="space-y-5">
          {SYS_PARAM_OTS_COMPRAS_CLAVES.map((clave) => {
            const meta = metaByClave[clave];
            const descripcion =
              meta?.descripcion?.trim() || DESCRIPCION_FALLBACK[clave];
            const updated = meta?.updated_at?.trim();
            return (
              <div key={clave} className="space-y-2">
                <Label
                  htmlFor={`sys-param-${clave}`}
                  className="text-sm font-medium"
                >
                  {TITULO_PARAM[clave]}
                </Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {descripcion}
                </p>
                <Input
                  id={`sys-param-${clave}`}
                  type="number"
                  min={0}
                  step={1}
                  className="max-w-[12rem] font-mono text-sm"
                  disabled={loading}
                  value={draft[clave]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [clave]: e.target.value }))
                  }
                />
                {updated ? (
                  <p className="text-[11px] text-muted-foreground">
                    Última actualización: {updated}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {!ordenSemanticoOk && valoresParseados ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            El valor rojo debe ser ≤ al naranja.
          </p>
        ) : null}

        <Button
          type="button"
          onClick={() => void handleGuardar()}
          disabled={
            loading || saving || !valoresParseados || !ordenSemanticoOk
          }
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
