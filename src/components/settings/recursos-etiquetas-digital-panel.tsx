"use client";

import { Loader2, Mail, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_EMAIL_PLANTILLA_ETIQUETAS_COMPRAS,
  fetchEmailPlantillasProduccion,
  TABLE_PROD_CONFIGURACION,
  TEMPLATE_ETIQUETAS_COMPRAS_DETAIL,
  TEMPLATE_ETIQUETAS_COMPRAS_FOOTER,
  TEMPLATE_ETIQUETAS_COMPRAS_HEADER,
  TEMPLATE_ETIQUETAS_COMPRAS_SUBJECT,
  type EmailPlantillaBloques,
} from "@/lib/email-plantillas-produccion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  PROD_ETIQUETAS_TIPO_LINEA_VALUES,
  type ProdEtiquetasCatalogCategoria,
  type ProdEtiquetasCatalogRow,
} from "@/types/prod-etiquetas-catalogo";

const CATEGORIA_LABEL: Record<ProdEtiquetasCatalogCategoria, string> = {
  tipo_linea: "Tipo de línea",
  producto: "Producto",
  tintas: "Tintas (colores)",
  equipo: "Equipo",
  marca: "Marca",
  propietario: "Propietario",
  prioridad: "Prioridad",
};

function emptyDraft(): {
  categoria: ProdEtiquetasCatalogCategoria;
  grupo: string;
  label: string;
  orden: number;
  activo: boolean;
} {
  return {
    categoria: "producto",
    grupo: "",
    label: "",
    orden: 0,
    activo: true,
  };
}

function bloquesEtiquetasComprasToRows(b: EmailPlantillaBloques) {
  return [
    { clave: TEMPLATE_ETIQUETAS_COMPRAS_SUBJECT, valor: b.subject },
    { clave: TEMPLATE_ETIQUETAS_COMPRAS_HEADER, valor: b.header },
    { clave: TEMPLATE_ETIQUETAS_COMPRAS_DETAIL, valor: b.detail },
    { clave: TEMPLATE_ETIQUETAS_COMPRAS_FOOTER, valor: b.footer },
  ];
}

export function RecursosEtiquetasDigitalPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [editing, setEditing] = useState<
    Record<string, { label: string; grupo: string; orden: number; activo: boolean }>
  >({});
  const [draft, setDraft] = useState(emptyDraft);
  const [emailText, setEmailText] = useState("");

  const [plantillaCorreo, setPlantillaCorreo] = useState<EmailPlantillaBloques>(
    () => ({ ...DEFAULT_EMAIL_PLANTILLA_ETIQUETAS_COMPRAS })
  );
  const [plantillaLoading, setPlantillaLoading] = useState(true);

  const loadPlantilla = useCallback(async () => {
    setPlantillaLoading(true);
    try {
      const { etiquetasCompras } =
        await fetchEmailPlantillasProduccion(supabase);
      setPlantillaCorreo(etiquetasCompras);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la plantilla de correo.");
    } finally {
      setPlantillaLoading(false);
    }
  }, [supabase]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [resCat, resMail] = await Promise.all([
        fetch("/api/admin/prod-etiquetas-catalogo"),
        fetch("/api/admin/sys-parametros-etiquetas-compras"),
      ]);
      const jCat = (await resCat.json()) as {
        rows?: ProdEtiquetasCatalogRow[];
        error?: string;
      };
      const jMail = (await resMail.json()) as { valor_text?: string; error?: string };
      if (!resCat.ok) {
        toast.error(jCat.error ?? "No se pudo cargar el catálogo.");
        setRows([]);
      } else {
        const list = Array.isArray(jCat.rows) ? jCat.rows : [];
        setRows(list);
        setEditing(
          Object.fromEntries(
            list.map((r) => [
              r.id,
              {
                label: r.label,
                grupo: r.grupo ?? "",
                orden: r.orden ?? 0,
                activo: r.activo ?? true,
              },
            ])
          )
        );
      }
      if (!resMail.ok) {
        toast.error(jMail.error ?? "No se pudieron cargar los correos.");
        setEmailText("");
      } else {
        setEmailText(String(jMail.valor_text ?? ""));
      }
    } catch {
      toast.error("Error de red al cargar recursos.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadPlantilla();
  }, [loadPlantilla]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ca = a.categoria.localeCompare(b.categoria, "es");
        if (ca !== 0) return ca;
        const ga = (a.grupo ?? "").localeCompare(b.grupo ?? "", "es");
        if (ga !== 0) return ga;
        if (a.orden !== b.orden) return a.orden - b.orden;
        return a.label.localeCompare(b.label, "es");
      }),
    [rows]
  );

  const saveEmails = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sys-parametros-etiquetas-compras", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor_text: emailText }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Destinatarios guardados.");
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [emailText]);

  const guardarPlantillaCorreo = useCallback(async () => {
    setSaving(true);
    try {
      const rowsUpsert = bloquesEtiquetasComprasToRows(plantillaCorreo).map(
        (r) => ({
          clave: r.clave,
          valor: r.valor,
          updated_at: new Date().toISOString(),
        })
      );
      const { error } = await supabase
        .from(TABLE_PROD_CONFIGURACION)
        .upsert(rowsUpsert, { onConflict: "clave" });
      if (error) throw error;
      toast.success("Plantilla de correo guardada.");
      void loadPlantilla();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [loadPlantilla, plantillaCorreo, supabase]);

  const restaurarPlantillaCorreo = useCallback(() => {
    setPlantillaCorreo({ ...DEFAULT_EMAIL_PLANTILLA_ETIQUETAS_COMPRAS });
    toast.message(
      "Valores por defecto cargados en el formulario (pulsa Guardar plantilla para persistir)."
    );
  }, []);

  const createCatalog = useCallback(async () => {
    const label = draft.label.trim();
    if (!label) {
      toast.error("El texto es obligatorio.");
      return;
    }
    if (draft.categoria === "marca" && !draft.grupo.trim()) {
      toast.error("Marca: indica el tipo de línea (grupo).");
      return;
    }
    if (draft.categoria !== "marca" && draft.grupo.trim()) {
      toast.error("Solo las marcas llevan tipo de línea.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-etiquetas-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: draft.categoria,
          grupo: draft.categoria === "marca" ? draft.grupo.trim() : null,
          label,
          orden: draft.orden,
          activo: draft.activo,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear.");
        return;
      }
      toast.success("Valor creado.");
      setDraft(emptyDraft());
      await loadAll();
    } catch {
      toast.error("No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }, [draft, loadAll]);

  const saveCatalogRow = useCallback(
    async (id: string, categoria: ProdEtiquetasCatalogCategoria) => {
      const d = editing[id];
      if (!d?.label.trim()) {
        toast.error("El texto es obligatorio.");
        return;
      }
      if (categoria === "marca" && !d.grupo.trim()) {
        toast.error("Marca: indica tipo de línea.");
        return;
      }
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-etiquetas-catalogo", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            categoria,
            label: d.label.trim(),
            orden: d.orden,
            activo: d.activo,
            grupo: categoria === "marca" ? d.grupo.trim() : null,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Actualizado.");
        await loadAll();
      } catch {
        toast.error("No se pudo guardar.");
      } finally {
        setSaving(false);
      }
    },
    [editing, loadAll]
  );

  const deleteCatalogRow = useCallback(
    async (id: string) => {
      if (!window.confirm("¿Eliminar este valor del catálogo?")) return;
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-etiquetas-catalogo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo eliminar.");
          return;
        }
        toast.success("Eliminado.");
        await loadAll();
      } catch {
        toast.error("No se pudo eliminar.");
      } finally {
        setSaving(false);
      }
    },
    [loadAll]
  );

  return (
    <Tabs defaultValue="catalogo" className="w-full space-y-4">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
        <TabsTrigger value="correo">Correo y plantilla</TabsTrigger>
      </TabsList>

      <TabsContent value="correo" className="space-y-6 outline-none">
        <section className="space-y-2 rounded-md border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-[#002147]" aria-hidden />
            <h3 className="text-sm font-semibold text-[#002147]">
              Destinatarios (Gmail)
            </h3>
          </div>
          <p className="text-xs text-slate-600">
            Direcciones separadas por coma o punto y coma. Se usan al abrir Gmail
            desde la pestaña Compras (Etiquetas digital).
          </p>
          <Textarea
            className="min-h-[4.5rem] text-xs"
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="digital@minervaglobal.es, jordi@minervaglobal.es"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void saveEmails()}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar correos"}
          </Button>
        </section>

        <section className="space-y-3 rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-[#002147]">
            Plantilla del mensaje
          </h3>
          <p className="text-xs text-slate-600">
            Variables en asunto y bloques:{" "}
            <code className="rounded bg-slate-100 px-1">{"{n_lineas}"}</code>{" "}
            (número de líneas del lote). En cada línea del detalle:{" "}
            <code className="rounded bg-slate-100 px-1">{"{producto}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{unidad}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{equipo}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{marca}"}</code>,{" "}
            <code className="rounded bg-slate-100 px-1">{"{prioridad}"}</code>.
          </p>
          {plantillaLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando plantilla…
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-1">
              <div className="grid gap-1">
                <Label className="text-xs">Asunto</Label>
                <Input
                  className="text-xs"
                  value={plantillaCorreo.subject}
                  onChange={(e) =>
                    setPlantillaCorreo((p) => ({ ...p, subject: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Cabecera</Label>
                <Textarea
                  className="min-h-[5rem] text-xs"
                  value={plantillaCorreo.header}
                  onChange={(e) =>
                    setPlantillaCorreo((p) => ({ ...p, header: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Línea de detalle (por producto)</Label>
                <Input
                  className="text-xs"
                  value={plantillaCorreo.detail}
                  onChange={(e) =>
                    setPlantillaCorreo((p) => ({ ...p, detail: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Pie</Label>
                <Textarea
                  className="min-h-[4rem] text-xs"
                  value={plantillaCorreo.footer}
                  onChange={(e) =>
                    setPlantillaCorreo((p) => ({ ...p, footer: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void guardarPlantillaCorreo()}
                >
                  <Save className="mr-1 size-3.5" aria-hidden />
                  Guardar plantilla
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={restaurarPlantillaCorreo}
                >
                  <RotateCcw className="mr-1 size-3.5" aria-hidden />
                  Valores por defecto
                </Button>
              </div>
            </div>
          )}
        </section>
      </TabsContent>

      <TabsContent value="catalogo" className="space-y-3 outline-none">
        <section className="space-y-3 rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-[#002147]">
            Catálogo (listas y sugerencias)
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </div>
          ) : null}

          <div className="space-y-2 rounded-md border border-dashed border-slate-200 p-2">
            <p className="text-xs font-medium text-slate-700">Nuevo valor</p>
            <div className="grid gap-2 md:grid-cols-6">
              <select
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                value={draft.categoria}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    categoria: e.target.value as ProdEtiquetasCatalogCategoria,
                    grupo: e.target.value === "marca" ? p.grupo : "",
                  }))
                }
              >
                {(Object.keys(CATEGORIA_LABEL) as ProdEtiquetasCatalogCategoria[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </option>
                  )
                )}
              </select>
              {draft.categoria === "marca" ? (
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                  value={draft.grupo}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, grupo: e.target.value }))
                  }
                >
                  <option value="">— Tipo línea —</option>
                  {PROD_ETIQUETAS_TIPO_LINEA_VALUES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <div />
              )}
              <Input
                className="text-xs md:col-span-2"
                placeholder="Texto (ej. FEDRIGONI)"
                value={draft.label}
                onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
              />
              <Input
                type="number"
                min={0}
                className="text-xs"
                value={draft.orden}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, orden: Number(e.target.value) || 0 }))
                }
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={draft.activo}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, activo: e.target.checked }))
                  }
                />
                Activo
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => void createCatalog()}
                disabled={saving}
              >
                <Plus className="mr-1 size-4" /> Crear
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">Valores existentes</p>
            {sorted.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin filas.</p>
            ) : (
              <div className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto pr-1">
                {sorted.map((row) => {
                  const d = editing[row.id];
                  if (!d) return null;
                  return (
                    <div
                      key={row.id}
                      className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-12 md:items-center"
                    >
                      <div className="text-[10px] font-medium text-slate-500 md:col-span-2">
                        {CATEGORIA_LABEL[row.categoria]}
                        {row.categoria === "marca" && row.grupo ? (
                          <span className="block text-[#002147]">{row.grupo}</span>
                        ) : null}
                      </div>
                      {row.categoria === "marca" ? (
                        <select
                          className="h-8 rounded border border-slate-300 bg-white px-1 text-xs md:col-span-2"
                          value={d.grupo}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [row.id]: { ...p[row.id]!, grupo: e.target.value },
                            }))
                          }
                        >
                          {PROD_ETIQUETAS_TIPO_LINEA_VALUES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="md:col-span-2" />
                      )}
                      <Input
                        className="h-8 text-xs md:col-span-3"
                        value={d.label}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [row.id]: { ...p[row.id]!, label: e.target.value },
                          }))
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs md:col-span-1"
                        value={d.orden}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [row.id]: {
                              ...p[row.id]!,
                              orden: Number(e.target.value) || 0,
                            },
                          }))
                        }
                      />
                      <label className="flex items-center gap-1 text-xs md:col-span-1">
                        <input
                          type="checkbox"
                          checked={d.activo}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [row.id]: { ...p[row.id]!, activo: e.target.checked },
                            }))
                          }
                        />
                        Act.
                      </label>
                      <div className="flex gap-1 md:col-span-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void saveCatalogRow(row.id, row.categoria)}
                          disabled={saving}
                        >
                          <Save className="mr-1 size-3" /> Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void deleteCatalogRow(row.id)}
                          disabled={saving}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </TabsContent>
    </Tabs>
  );
}
