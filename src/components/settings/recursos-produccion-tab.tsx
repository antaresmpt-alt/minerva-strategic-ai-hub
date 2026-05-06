"use client";

import { Factory, Loader2, Plus, Route, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RecursosPlantillasRutasPanel } from "@/components/settings/recursos-plantillas-rutas-panel";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProdProcesoCatRow } from "@/types/prod-rutas-plantilla";

const SUBTAB_TRIGGER_CLASS =
  "flex h-full min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";

type TipoMaquina = "impresion" | "digital" | "troquelado" | "engomado";
type MaquinaRow = {
  id: string;
  codigo: string;
  nombre: string;
  tipo_maquina: TipoMaquina;
  activa: boolean;
  orden_visual: number;
  capacidad_horas_default_manana: number;
  capacidad_horas_default_tarde: number;
  notas: string | null;
};

const TIPOS: Array<{ id: TipoMaquina; label: string }> = [
  { id: "impresion", label: "Impresión" },
  { id: "digital", label: "Digital" },
  { id: "troquelado", label: "Troquelado" },
  { id: "engomado", label: "Engomado" },
];

function emptyDraft(): Omit<MaquinaRow, "id"> {
  return {
    codigo: "",
    nombre: "",
    tipo_maquina: "impresion",
    activa: true,
    orden_visual: 0,
    capacidad_horas_default_manana: 8,
    capacidad_horas_default_tarde: 8,
    notas: "",
  };
}

export function RecursosProduccionTab() {
  const [subtab, setSubtab] = useState("maquinas");
  const [rows, setRows] = useState<MaquinaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<Record<string, Omit<MaquinaRow, "id">>>(
    {},
  );
  const [procesos, setProcesos] = useState<ProdProcesoCatRow[]>([]);
  const [procesoDraft, setProcesoDraft] = useState({
    nombre: "",
    seccion_slug: "",
    tipo_planificacion: "troquelado" as TipoMaquina,
    es_externo: false,
    orden_sugerido: 0,
    activo: true,
  });
  const [procesoEditing, setProcesoEditing] = useState<
    Record<number, Omit<ProdProcesoCatRow, "id">>
  >({});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/prod-maquinas");
      const data = (await res.json()) as { rows?: MaquinaRow[]; error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? `Error ${res.status}`);
        setRows([]);
        return;
      }
      const next = Array.isArray(data.rows) ? data.rows : [];
      setRows(next);
      setEditing(
        Object.fromEntries(
          next.map((r) => [
            r.id,
            {
              codigo: r.codigo,
              nombre: r.nombre,
              tipo_maquina: r.tipo_maquina,
              activa: r.activa,
              orden_visual: r.orden_visual,
              capacidad_horas_default_manana: Number(
                r.capacidad_horas_default_manana ?? 8,
              ),
              capacidad_horas_default_tarde: Number(
                r.capacidad_horas_default_tarde ?? 8,
              ),
              notas: r.notas ?? "",
            },
          ]),
        ),
      );
      const resProcesos = await fetch("/api/admin/prod-procesos-cat");
      const dataProcesos = (await resProcesos.json()) as {
        rows?: ProdProcesoCatRow[];
      };
      setProcesos(Array.isArray(dataProcesos.rows) ? dataProcesos.rows : []);
      setProcesoEditing(
        Object.fromEntries(
          (Array.isArray(dataProcesos.rows) ? dataProcesos.rows : []).map((p) => [
            p.id,
            {
              nombre: p.nombre,
              seccion_slug: p.seccion_slug,
              tipo_planificacion: p.tipo_planificacion ?? "troquelado",
              es_externo: p.es_externo ?? false,
              orden_sugerido: p.orden_sugerido ?? 0,
              activo: p.activo ?? true,
            },
          ]),
        ),
      );
    } catch {
      setLoadError("No se pudo cargar recursos de producción.");
      setRows([]);
      setProcesos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const grouped = useMemo(() => {
    const map = new Map<TipoMaquina, MaquinaRow[]>();
    for (const t of TIPOS) map.set(t.id, []);
    for (const r of rows) map.get(r.tipo_maquina)?.push(r);
    return map;
  }, [rows]);

  const maquinasOrdenadas = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.tipo_maquina !== b.tipo_maquina) {
          return a.tipo_maquina.localeCompare(b.tipo_maquina, "es");
        }
        if (a.orden_visual !== b.orden_visual) return a.orden_visual - b.orden_visual;
        return a.nombre.localeCompare(b.nombre, "es");
      }),
    [rows],
  );

  const saveOne = useCallback(async (id: string) => {
    const d = editing[id];
    if (!d) return;
    if (!d.codigo.trim() || !d.nombre.trim()) {
      toast.error("Código y nombre son obligatorios.");
      return;
    }
    if (d.capacidad_horas_default_manana < 0 || d.capacidad_horas_default_tarde < 0) {
      toast.error("Las horas deben ser >= 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-maquinas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...d }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Máquina actualizada.");
      await fetchRows();
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [editing, fetchRows]);

  const createOne = useCallback(async () => {
    if (!newDraft.codigo.trim() || !newDraft.nombre.trim()) {
      toast.error("Código y nombre son obligatorios.");
      return;
    }
    if (
      newDraft.capacidad_horas_default_manana < 0 ||
      newDraft.capacidad_horas_default_tarde < 0
    ) {
      toast.error("Las horas deben ser >= 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-maquinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDraft),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear la máquina.");
        return;
      }
      toast.success("Máquina creada.");
      setNewDraft(emptyDraft());
      await fetchRows();
    } catch {
      toast.error("No se pudo crear la máquina.");
    } finally {
      setSaving(false);
    }
  }, [newDraft, fetchRows]);

  const deleteOne = useCallback(
    async (id: string) => {
      if (!window.confirm("¿Eliminar esta máquina?")) return;
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-maquinas", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo eliminar.");
          return;
        }
        toast.success("Máquina eliminada.");
        await fetchRows();
      } catch {
        toast.error("No se pudo eliminar.");
      } finally {
        setSaving(false);
      }
    },
    [fetchRows],
  );

  const createProceso = useCallback(async () => {
    if (!procesoDraft.nombre.trim() || !procesoDraft.seccion_slug.trim()) {
      toast.error("Nombre y slug son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-procesos-cat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(procesoDraft),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear el proceso.");
        return;
      }
      toast.success("Proceso creado.");
      setProcesoDraft({
        nombre: "",
        seccion_slug: "",
        tipo_planificacion: "troquelado",
        es_externo: false,
        orden_sugerido: 0,
        activo: true,
      });
      await fetchRows();
    } catch {
      toast.error("No se pudo crear el proceso.");
    } finally {
      setSaving(false);
    }
  }, [procesoDraft, fetchRows]);

  const saveProceso = useCallback(
    async (id: number) => {
      const d = procesoEditing[id];
      if (!d) return;
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-procesos-cat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...d }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo guardar el proceso.");
          return;
        }
        toast.success("Proceso actualizado.");
        await fetchRows();
      } catch {
        toast.error("No se pudo guardar.");
      } finally {
        setSaving(false);
      }
    },
    [procesoEditing, fetchRows],
  );

  const deleteProceso = useCallback(
    async (id: number) => {
      if (!window.confirm("¿Eliminar proceso? Si está en uso, se desactivará.")) {
        return;
      }
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-procesos-cat", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await res.json()) as { error?: string; deactivated?: boolean };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo eliminar.");
          return;
        }
        toast.success(
          data.deactivated ? "Proceso en uso: desactivado." : "Proceso eliminado.",
        );
        await fetchRows();
      } catch {
        toast.error("No se pudo eliminar.");
      } finally {
        setSaving(false);
      }
    },
    [fetchRows],
  );

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Recursos de Producción</CardTitle>
        <CardDescription>
          Configura máquinas por tipo y capacidades por turno; define plantillas
          rápidas de itinerario (orden de procesos) para el despacho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={subtab} onValueChange={setSubtab} className="w-full space-y-4">
          <TabsList className="box-border inline-flex h-auto min-h-9 w-fit max-w-full flex-wrap items-stretch gap-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
            <TabsTrigger value="maquinas" className={SUBTAB_TRIGGER_CLASS}>
              <Factory className="size-4 shrink-0 opacity-90" aria-hidden />
              Máquinas
            </TabsTrigger>
            <TabsTrigger value="plantillas" className={SUBTAB_TRIGGER_CLASS}>
              <Route className="size-4 shrink-0 opacity-90" aria-hidden />
              Plantillas / rutas
            </TabsTrigger>
            <TabsTrigger value="procesos" className={SUBTAB_TRIGGER_CLASS}>
              Procesos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="maquinas" className="mt-0 space-y-6 outline-none">
        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando máquinas...
          </div>
        ) : null}

        <section className="space-y-3 rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold">Nueva máquina</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Código (ej. SM-CD102)"
              value={newDraft.codigo}
              onChange={(e) =>
                setNewDraft((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))
              }
            />
            <Input
              placeholder="Nombre"
              value={newDraft.nombre}
              onChange={(e) => setNewDraft((p) => ({ ...p, nombre: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={newDraft.tipo_maquina}
              onChange={(e) =>
                setNewDraft((p) => ({
                  ...p,
                  tipo_maquina: e.target.value as TipoMaquina,
                }))
              }
            >
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Orden visual"
              value={newDraft.orden_visual}
              onChange={(e) =>
                setNewDraft((p) => ({ ...p, orden_visual: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="Horas mañana"
              value={newDraft.capacidad_horas_default_manana}
              onChange={(e) =>
                setNewDraft((p) => ({
                  ...p,
                  capacidad_horas_default_manana: Number(e.target.value) || 0,
                }))
              }
            />
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="Horas tarde"
              value={newDraft.capacidad_horas_default_tarde}
              onChange={(e) =>
                setNewDraft((p) => ({
                  ...p,
                  capacidad_horas_default_tarde: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <Textarea
            placeholder="Notas opcionales"
            value={newDraft.notas ?? ""}
            onChange={(e) => setNewDraft((p) => ({ ...p, notas: e.target.value }))}
          />
          <Button type="button" onClick={() => void createOne()} disabled={saving}>
            <Plus className="mr-1 size-4" /> Crear máquina
          </Button>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Máquinas existentes</h3>
          {maquinasOrdenadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin máquinas registradas.</p>
          ) : (
            <div className="space-y-2">
              {maquinasOrdenadas.map((r) => {
                const d = editing[r.id];
                if (!d) return null;
                return (
                  <div key={r.id} className="rounded-md border border-slate-200 p-3">
                    <div className="grid gap-2 md:grid-cols-8">
                      <Input
                        value={d.codigo}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, codigo: e.target.value.toUpperCase() },
                          }))
                        }
                        placeholder="Código"
                      />
                      <Input
                        value={d.nombre}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, nombre: e.target.value },
                          }))
                        }
                        placeholder="Nombre"
                      />
                      <select
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        value={d.tipo_maquina}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: {
                              ...p[r.id]!,
                              tipo_maquina: e.target.value as TipoMaquina,
                            },
                          }))
                        }
                      >
                        {TIPOS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={d.orden_visual}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, orden_visual: Number(e.target.value) || 0 },
                          }))
                        }
                        placeholder="Orden"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={d.capacidad_horas_default_manana}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: {
                              ...p[r.id]!,
                              capacidad_horas_default_manana: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="Horas mañana"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={d.capacidad_horas_default_tarde}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: {
                              ...p[r.id]!,
                              capacidad_horas_default_tarde: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        placeholder="Horas tarde"
                      />
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={d.activa}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: { ...p[r.id]!, activa: e.target.checked },
                            }))
                          }
                        />
                        Activa
                      </label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveOne(r.id)}
                          disabled={saving}
                        >
                          <Save className="mr-1 size-4" /> Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void deleteOne(r.id)}
                          disabled={saving}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Textarea
                        value={d.notas ?? ""}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, notas: e.target.value },
                          }))
                        }
                        placeholder="Notas"
                        rows={2}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
          </TabsContent>

          <TabsContent value="plantillas" className="mt-0 outline-none">
            <RecursosPlantillasRutasPanel />
          </TabsContent>

          <TabsContent value="procesos" className="mt-0 space-y-4 outline-none">
            <section className="space-y-3 rounded-md border border-slate-200 p-3">
              <h3 className="text-sm font-semibold">Nuevo proceso</h3>
              <div className="grid gap-2 md:grid-cols-6">
                <Input
                  placeholder="Nombre"
                  value={procesoDraft.nombre}
                  onChange={(e) =>
                    setProcesoDraft((p) => ({ ...p, nombre: e.target.value }))
                  }
                />
                <Input
                  placeholder="Sección slug"
                  value={procesoDraft.seccion_slug}
                  onChange={(e) =>
                    setProcesoDraft((p) => ({ ...p, seccion_slug: e.target.value }))
                  }
                />
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                  value={procesoDraft.tipo_planificacion}
                  onChange={(e) =>
                    setProcesoDraft((p) => ({
                      ...p,
                      tipo_planificacion: e.target.value as TipoMaquina,
                    }))
                  }
                >
                  {TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={procesoDraft.orden_sugerido}
                  onChange={(e) =>
                    setProcesoDraft((p) => ({
                      ...p,
                      orden_sugerido: Number(e.target.value) || 0,
                    }))
                  }
                />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={procesoDraft.es_externo}
                    onChange={(e) =>
                      setProcesoDraft((p) => ({ ...p, es_externo: e.target.checked }))
                    }
                  />
                  Externo
                </label>
                <Button type="button" onClick={() => void createProceso()} disabled={saving}>
                  <Plus className="mr-1 size-4" /> Crear
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Procesos existentes</h3>
              {procesos.map((row) => {
                const d = procesoEditing[row.id];
                if (!d) return null;
                return (
                  <div key={row.id} className="rounded-md border border-slate-200 p-3">
                    <div className="grid gap-2 md:grid-cols-7">
                      <Input
                        value={d.nombre}
                        onChange={(e) =>
                          setProcesoEditing((p) => ({
                            ...p,
                            [row.id]: { ...p[row.id]!, nombre: e.target.value },
                          }))
                        }
                      />
                      <Input
                        value={d.seccion_slug}
                        onChange={(e) =>
                          setProcesoEditing((p) => ({
                            ...p,
                            [row.id]: { ...p[row.id]!, seccion_slug: e.target.value },
                          }))
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        value={d.tipo_planificacion ?? "troquelado"}
                        onChange={(e) =>
                          setProcesoEditing((p) => ({
                            ...p,
                            [row.id]: {
                              ...p[row.id]!,
                              tipo_planificacion: e.target.value as TipoMaquina,
                            },
                          }))
                        }
                      >
                        {TIPOS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={d.orden_sugerido ?? 0}
                        onChange={(e) =>
                          setProcesoEditing((p) => ({
                            ...p,
                            [row.id]: {
                              ...p[row.id]!,
                              orden_sugerido: Number(e.target.value) || 0,
                            },
                          }))
                        }
                      />
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={d.es_externo ?? false}
                          onChange={(e) =>
                            setProcesoEditing((p) => ({
                              ...p,
                              [row.id]: { ...p[row.id]!, es_externo: e.target.checked },
                            }))
                          }
                        />
                        Externo
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={d.activo ?? true}
                          onChange={(e) =>
                            setProcesoEditing((p) => ({
                              ...p,
                              [row.id]: { ...p[row.id]!, activo: e.target.checked },
                            }))
                          }
                        />
                        Activo
                      </label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveProceso(row.id)}
                          disabled={saving}
                        >
                          <Save className="mr-1 size-4" /> Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void deleteProceso(row.id)}
                          disabled={saving}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
